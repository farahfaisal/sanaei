-- ============================================================
-- Orders: who may change what + a working "open market" request flow
--
-- 1. Order rules (enforced in the database, for app users):
--    • Customer: cancel before payment; mark paid (pending/accepted only);
--      can never set "in progress"/"completed" without paying, never "completed",
--      never change the craftsman, the agreed amount after acceptance, or escrow.
--    • Craftsman: accept / decline pending requests; never payment, amount
--      or completion (progress steps go through set_order_progress()).
--    • Completion / escrow release / refunds: admins (dashboard) only.
-- 2. Open market requests (no craftsman chosen):
--    • can now be saved (craftsman_id was NOT NULL, so they always failed),
--    • matching craftsmen get a notification,
--    • craftsmen browse them with list_open_jobs() and pick one up with
--      claim_open_job() → the request is theirs and a chat opens for the quote.
-- 3. The marketplace views now respect row security (they exposed every
--    pending order, with addresses, to any signed-in user).
-- ============================================================

BEGIN;

ALTER TABLE public.orders ALTER COLUMN craftsman_id DROP NOT NULL;

ALTER VIEW IF EXISTS public.marketplace_jobs SET (security_invoker = true);
ALTER VIEW IF EXISTS public.marketplace_bookings SET (security_invoker = true);

-- Helpers (idempotent; also defined by earlier hardening migrations)
CREATE OR REPLACE FUNCTION public.is_client_request()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
    SELECT current_user IN ('authenticated', 'anon');
$$;

-- ── 1. Order rules ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_order_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_is_customer BOOLEAN;
    v_is_craftsman BOOLEAN;
    v_from TEXT;
    v_to TEXT;
BEGIN
    -- Server-side code (SECURITY DEFINER functions, dashboard SQL) and admins are trusted.
    IF NOT public.is_client_request() OR public.is_admin_user() THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.status := 'pending';
        NEW.escrow_status := 'none';
        NEW.progress_step := NULL;
        NEW.progress_updated_at := NULL;
        NEW.conversation_id := NULL;
        IF NEW.payment_status NOT IN ('pending', 'paid') THEN
            NEW.payment_status := 'pending';
        END IF;
        RETURN NEW;
    END IF;

    v_is_customer := (v_uid = OLD.customer_id);
    v_is_craftsman := EXISTS (
        SELECT 1 FROM craftsman_profiles cp WHERE cp.id = OLD.craftsman_id AND cp.user_id = v_uid
    );

    -- Never editable from the app
    NEW.customer_id := OLD.customer_id;
    NEW.craftsman_id := OLD.craftsman_id;          -- open requests are claimed via claim_open_job()
    NEW.progress_step := OLD.progress_step;        -- via set_order_progress()
    NEW.progress_updated_at := OLD.progress_updated_at;
    NEW.conversation_id := OLD.conversation_id;    -- via get_or_create_conversation()
    NEW.created_at := OLD.created_at;

    v_from := OLD.status::text;
    v_to := NEW.status::text;

    IF v_is_customer THEN
        -- Money: the agreed amount is fixed once the craftsman accepted.
        IF OLD.status <> 'pending' THEN
            NEW.amount := OLD.amount;
        END IF;
        -- Payment can only move forward to "paid"; escrow only to "held" together with it.
        IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
           AND NOT (OLD.payment_status = 'pending' AND NEW.payment_status = 'paid' AND v_from IN ('pending', 'accepted')) THEN
            RAISE EXCEPTION 'لا يمكن تعديل حالة الدفع' USING ERRCODE = '42501';
        END IF;
        IF NEW.escrow_status IS DISTINCT FROM OLD.escrow_status
           AND NOT (OLD.escrow_status = 'none' AND NEW.escrow_status = 'held' AND NEW.payment_status = 'paid') THEN
            RAISE EXCEPTION 'لا يمكن تعديل حالة المبلغ المحجوز' USING ERRCODE = '42501';
        END IF;

        IF v_to IS DISTINCT FROM v_from AND NOT (
               (v_from = 'pending'  AND v_to = 'cancelled')
            OR (v_from = 'accepted' AND v_to = 'cancelled' AND OLD.payment_status <> 'paid')
            OR (v_from = 'accepted' AND v_to = 'in_progress' AND NEW.payment_status = 'paid')
        ) THEN
            RAISE EXCEPTION 'لا يمكنك تغيير حالة الطلب إلى «%»', v_to USING ERRCODE = '42501';
        END IF;

    ELSIF v_is_craftsman THEN
        NEW.amount := OLD.amount;                  -- set through the quote flow
        NEW.payment_status := OLD.payment_status;
        NEW.payment_method := OLD.payment_method;
        NEW.escrow_status := OLD.escrow_status;

        IF v_to IS DISTINCT FROM v_from AND NOT (
               (v_from = 'pending'  AND v_to IN ('accepted', 'cancelled'))
            OR (v_from = 'accepted' AND v_to = 'cancelled' AND OLD.payment_status <> 'paid')
        ) THEN
            RAISE EXCEPTION 'لا يمكنك تغيير حالة الطلب إلى «%»', v_to USING ERRCODE = '42501';
        END IF;

    ELSE
        RAISE EXCEPTION 'لا يمكنك تعديل هذا الطلب' USING ERRCODE = '42501';
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_order_rules ON public.orders;
CREATE TRIGGER enforce_order_rules
    BEFORE INSERT OR UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.enforce_order_rules();

-- ── 2. Open market requests ─────────────────────────────────────────

-- Craftsmen who fit a request: same category (services or specialty),
-- preferring the same city; falls back to everyone if nobody matches.
DROP FUNCTION IF EXISTS public.matching_craftsmen_for_order(UUID, INT);
CREATE FUNCTION public.matching_craftsmen_for_order(p_order_id UUID, p_limit INT DEFAULT 100)
RETURNS TABLE (user_id UUID, craftsman_profile_id UUID, category_match BOOLEAN)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order orders%ROWTYPE;
    v_category TEXT;
    v_stem TEXT;
BEGIN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id;
    SELECT name INTO v_category FROM service_categories WHERE id = v_order.category_id;
    -- Rough Arabic stem so «كهرباء» matches «كهربائي», «سباكة» matches «سباك», «نجارة» → «نجار».
    v_stem := CASE WHEN length(v_category) > 3 THEN left(v_category, length(v_category) - 1) ELSE v_category END;

    RETURN QUERY
    WITH active AS (
        SELECT cp.id AS cp_id, cp.user_id AS u_id, cp.specialty, COALESCE(cp.location, up.location) AS loc, cp.is_online
        FROM craftsman_profiles cp
        JOIN user_profiles up ON up.id = cp.user_id
        WHERE up.role = 'craftsman' AND up.is_active
    ),
    scored AS (
        SELECT a.*,
            (
                (v_order.category_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM craftsman_services cs
                    WHERE cs.craftsman_id = a.cp_id AND cs.category_id = v_order.category_id AND cs.is_active))
                OR (v_stem IS NOT NULL AND a.specialty ILIKE '%' || v_stem || '%')
                OR (NULLIF(trim(v_order.service_type), '') IS NOT NULL AND a.specialty ILIKE '%' || trim(v_order.service_type) || '%')
            ) AS cat_match,
            (NULLIF(trim(v_order.city), '') IS NOT NULL AND a.loc ILIKE '%' || trim(v_order.city) || '%') AS city_match
        FROM active a
    ),
    pool AS (
        SELECT * FROM scored WHERE cat_match AND city_match
        UNION ALL
        SELECT * FROM scored WHERE cat_match AND NOT city_match
            AND NOT EXISTS (SELECT 1 FROM scored WHERE cat_match AND city_match)
        UNION ALL
        SELECT * FROM scored
            WHERE NOT EXISTS (SELECT 1 FROM scored WHERE cat_match)
    )
    SELECT p.u_id, p.cp_id, p.cat_match
    FROM pool p
    ORDER BY p.is_online DESC, p.city_match DESC
    LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.matching_craftsmen_for_order(UUID, INT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notify_open_job(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order orders%ROWTYPE;
    v_title TEXT;
    v_body TEXT;
    v_category TEXT;
BEGIN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id;
    SELECT name INTO v_category FROM service_categories WHERE id = v_order.category_id;
    v_title := CASE WHEN v_order.urgency = 'urgent' THEN 'طلب عاجل في السوق ⚡' ELSE 'طلب جديد في السوق 📢' END;
    v_body := COALESCE(NULLIF(trim(v_order.service_type), ''), v_category, 'طلب خدمة')
              || COALESCE(' في ' || NULLIF(trim(v_order.city), ''), '')
              || ' — كن أول من يستلمه';

    INSERT INTO notifications (user_id, title, body, type, order_id, url)
    SELECT m.user_id, v_title, v_body, 'open_job', v_order.id, '/incoming-requests?tab=market'
    FROM matching_craftsmen_for_order(p_order_id) m;
EXCEPTION WHEN OTHERS THEN
    -- Never block saving the customer's request because of a notification problem.
    RAISE WARNING 'notify_open_job failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_open_job(UUID) FROM PUBLIC, anon, authenticated;

-- What a craftsman sees in the market (no phone/exact address until they pick it up).
CREATE OR REPLACE FUNCTION public.list_open_jobs()
RETURNS TABLE (
    id UUID,
    created_at TIMESTAMPTZ,
    service_type TEXT,
    category_name TEXT,
    category_emoji TEXT,
    description TEXT,
    city TEXT,
    urgency TEXT,
    amount NUMERIC,
    scheduled_at TIMESTAMPTZ,
    image_count INT,
    customer_first_name TEXT,
    is_match BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cp_id UUID;
BEGIN
    SELECT cp.id INTO v_cp_id
    FROM craftsman_profiles cp JOIN user_profiles up ON up.id = cp.user_id
    WHERE cp.user_id = auth.uid() AND up.role = 'craftsman' AND up.is_active;
    IF v_cp_id IS NULL THEN
        RAISE EXCEPTION 'للحرفيين فقط' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT o.id, o.created_at, o.service_type, sc.name, sc.emoji, o.description, o.city, o.urgency,
           o.amount, o.scheduled_at, COALESCE(array_length(o.service_images, 1), 0),
           split_part(COALESCE(NULLIF(up.full_name, ''), 'زبون'), ' ', 1),
           EXISTS (SELECT 1 FROM matching_craftsmen_for_order(o.id, 1000) m
                   WHERE m.craftsman_profile_id = v_cp_id AND m.category_match)
    FROM orders o
    JOIN user_profiles up ON up.id = o.customer_id
    LEFT JOIN service_categories sc ON sc.id = o.category_id
    WHERE o.craftsman_id IS NULL AND o.status = 'pending'
    ORDER BY 13 DESC, (o.urgency = 'urgent') DESC, o.created_at DESC
    LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.list_open_jobs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_open_jobs() TO authenticated;

-- First craftsman to pick up an open request gets it; a chat opens for the quote.
CREATE OR REPLACE FUNCTION public.claim_open_job(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order orders%ROWTYPE;
    v_cp_id UUID;
    v_conversation_id UUID;
    v_name TEXT;
BEGIN
    SELECT cp.id, COALESCE(NULLIF(up.full_name, ''), 'الحرفي') INTO v_cp_id, v_name
    FROM craftsman_profiles cp JOIN user_profiles up ON up.id = cp.user_id
    WHERE cp.user_id = auth.uid() AND up.role = 'craftsman' AND up.is_active;
    IF v_cp_id IS NULL THEN
        RAISE EXCEPTION 'للحرفيين فقط' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'الطلب غير موجود' USING ERRCODE = 'P0002';
    END IF;
    IF v_order.craftsman_id IS NOT NULL OR v_order.status <> 'pending' THEN
        RAISE EXCEPTION 'استلم حرفي آخر هذا الطلب' USING ERRCODE = '22023';
    END IF;

    UPDATE orders SET craftsman_id = v_cp_id, updated_at = NOW() WHERE id = p_order_id;
    v_conversation_id := get_or_create_conversation(v_order.customer_id, auth.uid(), p_order_id);

    INSERT INTO messages (conversation_id, sender_id, content, message_type)
    VALUES (v_conversation_id, auth.uid(),
            '🙌 ' || v_name || ' استلم طلبك' || COALESCE(' «' || NULLIF(trim(v_order.service_type), '') || '»', '')
            || ' وسيرسل لك عرض السعر هنا', 'system');

    RETURN v_conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_open_job(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_open_job(UUID) TO authenticated;

-- Order notifications: + open-market requests and pick-ups
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
        ELSE
            -- Open market request: tell the craftsmen who can do it.
            PERFORM notify_open_job(NEW.id);
        END IF;
        RETURN NEW;
    END IF;

    -- A craftsman picked up an open market request → customer
    IF OLD.craftsman_id IS NULL AND NEW.craftsman_id IS NOT NULL AND NEW.status = 'pending' THEN
        PERFORM notify_user(NEW.customer_id, 'حرفي استلم طلبك 🙌',
            v_craftsman_name || ' استلم طلبك وسيرسل لك عرض السعر في المحادثة',
            'order_claimed', NEW.id,
            CASE WHEN NEW.conversation_id IS NOT NULL THEN '/chat?conversation_id=' || NEW.conversation_id ELSE v_customer_url END);
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


COMMIT;
