-- ============================================================
-- Push notifications (FCM + Web Push) for customers and craftsmen
--
-- Everything is sent from the database, so it works no matter which screen
-- (or phone) triggered the change, and nobody can send pushes from the app.
--
--   event (order / quote / progress / chat)
--     → row in public.notifications (in-app bell)   [except chat messages]
--     → public.queue_push() → pg_net → Edge Function send-push-notification
--     → FCM (native app) + Web Push (browser / PWA)
--
-- One-time setup (see the instructions that come with this file):
--   select vault.create_secret('https://<project>.supabase.co', 'project_url');
--   select vault.create_secret('<service_role key>', 'service_role_key');
-- Until those secrets exist, notifications are still saved in-app; pushes are skipped.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;

BEGIN;

-- ── Core: send one push ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.queue_push(
    p_user_id UUID,
    p_title TEXT,
    p_body TEXT,
    p_url TEXT DEFAULT '/',
    p_order_id UUID DEFAULT NULL,
    p_tag TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_project_url TEXT;
    v_service_key TEXT;
BEGIN
    IF p_user_id IS NULL THEN RETURN; END IF;

    SELECT decrypted_secret INTO v_project_url FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
    SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
    IF v_project_url IS NULL OR v_service_key IS NULL THEN
        RETURN; -- push not configured yet; the in-app notification still exists
    END IF;

    PERFORM net.http_post(
        url := rtrim(v_project_url, '/') || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
        ),
        body := jsonb_build_object(
            'userId', p_user_id,
            'title', p_title,
            'body', p_body,
            'url', COALESCE(p_url, '/'),
            'orderId', p_order_id,
            'tag', p_tag
        )
    );
EXCEPTION WHEN OTHERS THEN
    -- A push problem must never break the order/chat action that caused it.
    RAISE WARNING 'queue_push failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_push(UUID, TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- ── In-app notification + push ──────────────────────────────────────
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS url TEXT;

CREATE OR REPLACE FUNCTION public.notify_user(
    p_user_id UUID,
    p_title TEXT,
    p_body TEXT,
    p_type TEXT,
    p_order_id UUID DEFAULT NULL,
    p_url TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_user_id IS NULL THEN RETURN; END IF;
    INSERT INTO notifications (user_id, title, body, type, order_id, url)
    VALUES (p_user_id, p_title, p_body, p_type, p_order_id, p_url);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_user(UUID, TEXT, TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- Every in-app notification (from triggers, admin broadcasts, …) is also pushed.
CREATE OR REPLACE FUNCTION public.push_on_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.queue_push(
        NEW.user_id, NEW.title, NEW.body,
        COALESCE(NEW.url, CASE WHEN NEW.order_id IS NOT NULL THEN '/order-live-status?id=' || NEW.order_id ELSE '/' END),
        NEW.order_id,
        CASE WHEN NEW.order_id IS NOT NULL THEN 'order-' || NEW.order_id ELSE NULL END
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_notification_push ON public.notifications;
CREATE TRIGGER on_notification_push
    AFTER INSERT ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.push_on_notification();

-- ── Craftsman job progress ("في الطريق" …) ──────────────────────────
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS progress_step TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS progress_updated_at TIMESTAMPTZ;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_progress_step_check') THEN
        ALTER TABLE public.orders ADD CONSTRAINT orders_progress_step_check
            CHECK (progress_step IS NULL OR progress_step IN ('on_the_way', 'arrived', 'work_started', 'work_done'));
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_order_progress(p_order_id UUID, p_step TEXT)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order orders%ROWTYPE;
    v_steps TEXT[] := ARRAY['on_the_way', 'arrived', 'work_started', 'work_done'];
    v_current INT;
    v_next INT;
BEGIN
    SELECT o.* INTO v_order
    FROM orders o JOIN craftsman_profiles cp ON cp.id = o.craftsman_id
    WHERE o.id = p_order_id AND cp.user_id = auth.uid()
    FOR UPDATE OF o;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'لا يمكنك تحديث هذا الطلب' USING ERRCODE = '42501';
    END IF;
    IF v_order.status NOT IN ('accepted', 'in_progress') THEN
        RAISE EXCEPTION 'يمكن تحديث مراحل العمل بعد قبول الطلب فقط' USING ERRCODE = '22023';
    END IF;

    v_next := array_position(v_steps, p_step);
    v_current := COALESCE(array_position(v_steps, v_order.progress_step), 0);
    IF v_next IS NULL THEN
        RAISE EXCEPTION 'مرحلة غير صالحة' USING ERRCODE = '22023';
    END IF;
    IF v_next <= v_current THEN
        RAISE EXCEPTION 'تم تسجيل هذه المرحلة مسبقاً' USING ERRCODE = '22023';
    END IF;

    UPDATE orders SET progress_step = p_step, progress_updated_at = NOW()
    WHERE id = p_order_id
    RETURNING * INTO v_order;
    RETURN v_order;
END;
$$;

REVOKE ALL ON FUNCTION public.set_order_progress(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_order_progress(UUID, TEXT) TO authenticated;

-- ── Order events → notify the other side ────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_order_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor UUID := auth.uid();
    v_craftsman_user UUID;
    v_craftsman_name TEXT;
    v_customer_name TEXT;
    v_service TEXT;
    v_amount TEXT;
    v_customer_url TEXT := '/order-live-status?id=' || NEW.id;
    v_craftsman_url TEXT := CASE WHEN NEW.conversation_id IS NOT NULL
                                 THEN '/chat?conversation_id=' || NEW.conversation_id
                                 ELSE '/craftsman-orders' END;
    v_chat_text TEXT;
BEGIN
    SELECT cp.user_id, NULLIF(up.full_name, '') INTO v_craftsman_user, v_craftsman_name
    FROM craftsman_profiles cp JOIN user_profiles up ON up.id = cp.user_id
    WHERE cp.id = NEW.craftsman_id;
    SELECT NULLIF(full_name, '') INTO v_customer_name FROM user_profiles WHERE id = NEW.customer_id;
    SELECT name INTO v_service FROM craftsman_services WHERE id = NEW.service_id;
    v_craftsman_name := COALESCE(v_craftsman_name, 'الحرفي');
    v_customer_name := COALESCE(v_customer_name, 'زبون');
    v_amount := CASE WHEN NEW.amount IS NOT NULL THEN to_char(NEW.amount, 'FM999G999G990D00') || ' ر.س' END;

    -- New request → craftsman
    IF TG_OP = 'INSERT' THEN
        IF v_craftsman_user IS NOT NULL THEN
            PERFORM notify_user(v_craftsman_user, 'طلب خدمة جديد 🔔',
                v_customer_name || ' أرسل لك طلب' || COALESCE(' «' || v_service || '»', ' خدمة') || ' — بانتظار ردك',
                'new_order', NEW.id, '/incoming-requests');
        END IF;
        RETURN NEW;
    END IF;

    -- Status changes
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        CASE NEW.status::text
            WHEN 'accepted' THEN
                IF v_actor IS DISTINCT FROM NEW.customer_id THEN
                    PERFORM notify_user(NEW.customer_id, 'تم قبول طلبك ✅',
                        v_craftsman_name || ' قبل طلبك' || COALESCE(' بقيمة ' || v_amount, ''),
                        'order_accepted', NEW.id, v_customer_url);
                END IF;
                IF v_actor = NEW.customer_id THEN
                    PERFORM notify_user(v_craftsman_user, 'تم قبول عرض السعر 🎉',
                        v_customer_name || ' وافق على عرضك' || COALESCE(' بقيمة ' || v_amount, '') || ' — بانتظار الدفع',
                        'quote_accepted', NEW.id, v_craftsman_url);
                ELSIF v_actor IS DISTINCT FROM v_craftsman_user THEN
                    -- Assigned by the admin / system
                    PERFORM notify_user(v_craftsman_user, 'تم إسناد طلب إليك 📋',
                        'طلب ' || v_customer_name || COALESCE(' «' || v_service || '»', '') || ' أصبح من مسؤوليتك',
                        'order_assigned', NEW.id, v_craftsman_url);
                END IF;
            WHEN 'in_progress' THEN
                PERFORM notify_user(v_craftsman_user, 'تم الدفع 💳',
                    v_customer_name || ' أكمل الدفع — يمكنك التوجه لتنفيذ الخدمة',
                    'order_paid', NEW.id, v_craftsman_url);
                IF v_actor IS DISTINCT FROM NEW.customer_id THEN
                    PERFORM notify_user(NEW.customer_id, 'بدأ تنفيذ طلبك 🔧',
                        'تم تأكيد الدفع وبدأ ' || v_craftsman_name || ' بتنفيذ طلبك',
                        'order_in_progress', NEW.id, v_customer_url);
                END IF;
            WHEN 'completed' THEN
                PERFORM notify_user(NEW.customer_id, 'اكتملت الخدمة 🎉',
                    'شكراً لاستخدامك حِرَفي — قيّم ' || v_craftsman_name, 'order_completed', NEW.id, v_customer_url);
                PERFORM notify_user(v_craftsman_user, 'تم إغلاق الطلب ✅',
                    'اكتمل طلب ' || v_customer_name || COALESCE(' وسيُحوَّل مبلغ ' || v_amount || ' إلى محفظتك', ''),
                    'order_completed', NEW.id, '/wallet-earnings-dashboard');
            WHEN 'cancelled' THEN
                IF v_actor IS DISTINCT FROM NEW.customer_id THEN
                    PERFORM notify_user(NEW.customer_id, 'تم إلغاء الطلب ❌',
                        CASE WHEN v_actor = v_craftsman_user THEN v_craftsman_name || ' اعتذر عن الطلب' ELSE 'تم إلغاء طلبك' END,
                        'order_cancelled', NEW.id, v_customer_url);
                END IF;
                IF v_actor IS DISTINCT FROM v_craftsman_user THEN
                    PERFORM notify_user(v_craftsman_user, 'تم إلغاء الطلب ❌',
                        'تم إلغاء طلب ' || v_customer_name, 'order_cancelled', NEW.id, '/craftsman-orders');
                END IF;
            ELSE NULL;
        END CASE;
    END IF;

    -- Craftsman progress → customer (+ chat message)
    IF NEW.progress_step IS DISTINCT FROM OLD.progress_step AND NEW.progress_step IS NOT NULL THEN
        v_chat_text := CASE NEW.progress_step
            WHEN 'on_the_way'   THEN '🚗 الحرفي في الطريق إليك'
            WHEN 'arrived'      THEN '📍 وصل الحرفي إلى موقعك'
            WHEN 'work_started' THEN '🔧 بدأ الحرفي العمل'
            WHEN 'work_done'    THEN '✅ أنهى الحرفي العمل'
        END;
        PERFORM notify_user(NEW.customer_id, v_chat_text,
            CASE NEW.progress_step
                WHEN 'on_the_way'   THEN v_craftsman_name || ' في الطريق إليك الآن'
                WHEN 'arrived'      THEN v_craftsman_name || ' وصل إلى موقعك'
                WHEN 'work_started' THEN v_craftsman_name || ' بدأ تنفيذ العمل'
                WHEN 'work_done'    THEN v_craftsman_name || ' أنهى العمل — راجع الخدمة وقيّمها'
            END,
            'order_progress', NEW.id, v_customer_url);
        IF NEW.conversation_id IS NOT NULL THEN
            INSERT INTO messages (conversation_id, sender_id, content, message_type)
            VALUES (NEW.conversation_id, v_craftsman_user, v_chat_text, 'system');
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- Replace the old, partial notification triggers (avoid duplicates).
DROP TRIGGER IF EXISTS on_new_order_notify_craftsman ON public.orders;
DROP TRIGGER IF EXISTS on_order_status_change_notify_customer ON public.orders;
DROP TRIGGER IF EXISTS on_order_events_notify ON public.orders;
CREATE TRIGGER on_order_events_notify
    AFTER INSERT OR UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.notify_order_events();

-- ── Quotes → notify ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_quote_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order orders%ROWTYPE;
    v_craftsman_user UUID;
    v_craftsman_name TEXT;
    v_customer_name TEXT;
    v_chat_url TEXT;
    v_amount TEXT := to_char(NEW.amount, 'FM999G999G990D00') || ' ر.س';
BEGIN
    SELECT * INTO v_order FROM orders WHERE id = NEW.order_id;
    SELECT cp.user_id, COALESCE(NULLIF(up.full_name, ''), 'الحرفي') INTO v_craftsman_user, v_craftsman_name
    FROM craftsman_profiles cp JOIN user_profiles up ON up.id = cp.user_id
    WHERE cp.id = NEW.craftsman_id;
    SELECT COALESCE(NULLIF(full_name, ''), 'الزبون') INTO v_customer_name FROM user_profiles WHERE id = v_order.customer_id;
    v_chat_url := CASE WHEN v_order.conversation_id IS NOT NULL
                       THEN '/chat?conversation_id=' || v_order.conversation_id
                       ELSE '/order-live-status?id=' || v_order.id END;

    IF TG_OP = 'INSERT' AND NEW.quote_status = 'pending' THEN
        PERFORM notify_user(v_order.customer_id, 'عرض سعر جديد 💰',
            v_craftsman_name || ' أرسل عرض سعر: ' || v_amount, 'quote_received', v_order.id, v_chat_url);
    ELSIF TG_OP = 'UPDATE' AND NEW.quote_status IS DISTINCT FROM OLD.quote_status AND OLD.quote_status = 'pending' THEN
        -- Acceptance is announced by the order trigger; replaced quotes need no alert.
        IF NEW.quote_status = 'modification_requested' THEN
            PERFORM notify_user(v_craftsman_user, 'طلب تعديل على عرضك 🔄',
                v_customer_name || ' طلب تعديل العرض' || COALESCE(': ' || NEW.modification_note, ''),
                'quote_modification', v_order.id, v_chat_url);
        ELSIF NEW.quote_status = 'rejected' AND auth.uid() = v_order.customer_id THEN
            PERFORM notify_user(v_craftsman_user, 'تم رفض عرض السعر ❌',
                v_customer_name || ' رفض عرضك بقيمة ' || v_amount, 'quote_rejected', v_order.id, v_chat_url);
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_quote_events_notify ON public.price_quotes;
CREATE TRIGGER on_quote_events_notify
    AFTER INSERT OR UPDATE ON public.price_quotes
    FOR EACH ROW EXECUTE FUNCTION public.notify_quote_events();

-- ── New chat message → push to the other person (no bell entry) ───────
CREATE OR REPLACE FUNCTION public.push_on_chat_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_conv conversations%ROWTYPE;
    v_recipient UUID;
    v_sender_name TEXT;
    v_preview TEXT;
BEGIN
    -- Status / quote messages already have their own notification.
    IF NEW.message_type::text IN ('system', 'quote') THEN RETURN NEW; END IF;

    SELECT * INTO v_conv FROM conversations WHERE id = NEW.conversation_id;
    v_recipient := CASE WHEN NEW.sender_id = v_conv.customer_id THEN v_conv.craftsman_id ELSE v_conv.customer_id END;
    SELECT COALESCE(NULLIF(full_name, ''), 'رسالة جديدة') INTO v_sender_name FROM user_profiles WHERE id = NEW.sender_id;
    v_preview := COALESCE(
        left(NEW.content, 120),
        CASE NEW.message_type::text WHEN 'image' THEN '📷 صورة' WHEN 'video' THEN '🎥 فيديو' WHEN 'file' THEN '📎 ملف' ELSE 'رسالة جديدة' END
    );

    PERFORM queue_push(v_recipient, v_sender_name, v_preview,
        '/chat?conversation_id=' || NEW.conversation_id, NULL, 'chat-' || NEW.conversation_id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_chat_message_push ON public.messages;
CREATE TRIGGER on_chat_message_push
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.push_on_chat_message();

-- Admin broadcast: insert notifications for many users at once (each one is pushed).
CREATE OR REPLACE FUNCTION public.broadcast_notification(p_title TEXT, p_body TEXT, p_role TEXT DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    IF NOT public.is_admin_user() THEN
        RAISE EXCEPTION 'للمشرفين فقط' USING ERRCODE = '42501';
    END IF;
    IF COALESCE(trim(p_title), '') = '' OR COALESCE(trim(p_body), '') = '' THEN
        RAISE EXCEPTION 'العنوان والنص مطلوبان' USING ERRCODE = '22023';
    END IF;
    INSERT INTO notifications (user_id, title, body, type, url)
    SELECT id, trim(p_title), trim(p_body), 'broadcast', '/'
    FROM user_profiles
    WHERE is_active AND role <> 'admin' AND (p_role IS NULL OR role::text = p_role);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.broadcast_notification(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.broadcast_notification(TEXT, TEXT, TEXT) TO authenticated;

-- Quote answers are shown as status pills in the chat (they have their own push).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'respond_to_quote') THEN
        EXECUTE replace(
            pg_get_functiondef('public.respond_to_quote(uuid,text,text)'::regprocedure),
            'VALUES (v_order.conversation_id, auth.uid(), v_message, ''text'');',
            'VALUES (v_order.conversation_id, auth.uid(), v_message, ''system'');'
        );
    END IF;
END $$;

COMMIT;
