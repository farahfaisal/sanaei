-- ============================================================
-- Price quotes inside the chat
--
-- 1. submit_quote(): the craftsman of the order sends a quote. Atomic:
--    replaces any earlier pending quote and posts the quote message.
-- 2. respond_to_quote(): the order's customer accepts / rejects / asks for a
--    change. Atomic: quote status + order amount/status + chat message.
-- 3. Status messages ("تم قبول الطلب"…) are posted once by the database when
--    an order's status changes — no more duplicates from both phones.
-- 4. Realtime for quotes and orders, so both sides see changes instantly.
-- ============================================================

BEGIN;

-- 1. Send a quote ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_quote(
    p_order_id UUID,
    p_amount NUMERIC,
    p_description TEXT DEFAULT NULL
)
RETURNS public.price_quotes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order orders%ROWTYPE;
    v_craftsman_profile_id UUID;
    v_quote price_quotes%ROWTYPE;
BEGIN
    SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'الطلب غير موجود' USING ERRCODE = 'P0002';
    END IF;

    SELECT cp.id INTO v_craftsman_profile_id
    FROM craftsman_profiles cp
    WHERE cp.user_id = auth.uid() AND cp.id = v_order.craftsman_id;
    IF v_craftsman_profile_id IS NULL THEN
        RAISE EXCEPTION 'لا يمكنك إرسال عرض سعر لهذا الطلب' USING ERRCODE = '42501';
    END IF;

    IF v_order.status <> 'pending' THEN
        RAISE EXCEPTION 'لا يمكن إرسال عرض سعر بعد قبول الطلب أو إلغائه' USING ERRCODE = '22023';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000 THEN
        RAISE EXCEPTION 'المبلغ غير صحيح' USING ERRCODE = '22023';
    END IF;

    -- A new quote replaces the previous one that is still waiting.
    UPDATE price_quotes SET quote_status = 'rejected'
    WHERE order_id = p_order_id AND quote_status = 'pending';

    INSERT INTO price_quotes (order_id, craftsman_id, amount, description, quote_status)
    VALUES (p_order_id, v_craftsman_profile_id, round(p_amount, 2), NULLIF(trim(p_description), ''), 'pending')
    RETURNING * INTO v_quote;

    IF v_order.conversation_id IS NOT NULL THEN
        INSERT INTO messages (conversation_id, sender_id, content, message_type)
        VALUES (
            v_order.conversation_id,
            auth.uid(),
            '💰 عرض سعر: ' || to_char(v_quote.amount, 'FM999G999G990D00') || ' ر.س'
                || COALESCE(E'\n' || v_quote.description, ''),
            'quote'
        );
    END IF;

    RETURN v_quote;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_quote(UUID, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_quote(UUID, NUMERIC, TEXT) TO authenticated;

-- 2. Answer a quote --------------------------------------------------
CREATE OR REPLACE FUNCTION public.respond_to_quote(
    p_quote_id UUID,
    p_action TEXT,
    p_note TEXT DEFAULT NULL
)
RETURNS public.price_quotes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_quote price_quotes%ROWTYPE;
    v_order orders%ROWTYPE;
    v_message TEXT;
BEGIN
    IF p_action NOT IN ('accepted', 'rejected', 'modification_requested') THEN
        RAISE EXCEPTION 'إجراء غير صالح' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_quote FROM price_quotes WHERE id = p_quote_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'عرض السعر غير موجود' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_order FROM orders WHERE id = v_quote.order_id FOR UPDATE;
    IF v_order.customer_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'لا يمكنك الرد على هذا العرض' USING ERRCODE = '42501';
    END IF;

    IF v_quote.quote_status <> 'pending' THEN
        RAISE EXCEPTION 'تم الرد على هذا العرض مسبقاً أو تم استبداله بعرض أحدث' USING ERRCODE = '22023';
    END IF;

    IF p_action = 'accepted' AND v_order.status <> 'pending' THEN
        RAISE EXCEPTION 'لا يمكن قبول العرض لأن الطلب لم يعد بانتظار الموافقة' USING ERRCODE = '22023';
    END IF;

    UPDATE price_quotes
    SET quote_status = p_action,
        modification_note = CASE WHEN p_action = 'modification_requested' THEN NULLIF(trim(p_note), '') ELSE modification_note END,
        is_accepted = (p_action = 'accepted')
    WHERE id = p_quote_id
    RETURNING * INTO v_quote;

    IF p_action = 'accepted' THEN
        UPDATE orders SET amount = v_quote.amount, status = 'accepted' WHERE id = v_order.id;
        v_message := '✅ تم قبول عرض السعر: ' || to_char(v_quote.amount, 'FM999G999G990D00') || ' ر.س';
    ELSIF p_action = 'rejected' THEN
        v_message := '❌ تم رفض عرض السعر';
    ELSE
        v_message := '🔄 طلب تعديل على عرض السعر' || COALESCE(': ' || NULLIF(trim(p_note), ''), '');
    END IF;

    IF v_order.conversation_id IS NOT NULL THEN
        INSERT INTO messages (conversation_id, sender_id, content, message_type)
        VALUES (v_order.conversation_id, auth.uid(), v_message, 'system');
    END IF;

    RETURN v_quote;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_quote(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_quote(UUID, TEXT, TEXT) TO authenticated;

-- 3. One status message per change, posted by the database -------------
CREATE OR REPLACE FUNCTION public.post_order_status_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_text TEXT;
BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.conversation_id IS NULL THEN
        RETURN NEW;
    END IF;

    v_text := CASE NEW.status::text
        WHEN 'accepted'    THEN '✅ تم قبول الطلب من قِبَل الحرفي'
        WHEN 'in_progress' THEN '🔧 بدأ تنفيذ الخدمة'
        WHEN 'completed'   THEN '🎉 اكتملت الخدمة بنجاح'
        WHEN 'cancelled'   THEN '❌ تم إلغاء الطلب'
        ELSE NULL
    END;

    IF v_text IS NOT NULL THEN
        INSERT INTO messages (conversation_id, sender_id, content, message_type)
        VALUES (NEW.conversation_id, NEW.customer_id, v_text, 'system');
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_status_post_chat_message ON public.orders;
CREATE TRIGGER on_order_status_post_chat_message
    AFTER UPDATE OF status ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.post_order_status_message();

-- Notification text: new brand wording.
CREATE OR REPLACE FUNCTION public.notify_customer_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    status_label TEXT;
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    CASE NEW.status
        WHEN 'accepted'    THEN status_label := 'تم قبول طلبك ✅';
        WHEN 'in_progress' THEN status_label := 'الحرفي في الطريق إليك 🚗';
        WHEN 'completed'   THEN status_label := 'تم إنجاز طلبك بنجاح 🎉';
        WHEN 'cancelled'   THEN status_label := 'تم إلغاء طلبك ❌';
        ELSE status_label := 'تم تحديث حالة طلبك';
    END CASE;

    INSERT INTO public.notifications (user_id, title, body, type, order_id)
    VALUES (NEW.customer_id, 'تحديث الطلب', status_label, 'order_status', NEW.id);

    RETURN NEW;
END;
$$;

-- 4. Realtime --------------------------------------------------------
DO $$
DECLARE
    t TEXT;
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        FOREACH t IN ARRAY ARRAY['price_quotes', 'orders', 'messages', 'conversations'] LOOP
            IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                           WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t) THEN
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
            END IF;
        END LOOP;
    END IF;
END $$;

ALTER TABLE public.price_quotes REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;

COMMIT;
