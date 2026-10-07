-- ============================================================
-- Chat fixes (WhatsApp-style threads)
--
-- 1. 'system' message type: status messages ("تم قبول الطلب"…) were rejected
--    because the enum didn't have this value.
-- 2. One conversation per customer–craftsman pair. Previously every service
--    request created a new conversation. Existing duplicates are merged into
--    the oldest one (no message is lost) and duplicates are blocked from now on.
-- 3. get_or_create_conversation(): the single way the app opens a chat.
--    If an order is passed, the thread switches to that order (quotes/payment).
-- 4. Realtime for messages/conversations, so new messages appear instantly.
-- ============================================================

-- 1. Must run outside the transaction below.
ALTER TYPE public.message_type ADD VALUE IF NOT EXISTS 'system';

BEGIN;

-- 2a. Find duplicates: keep the oldest conversation of each pair.
CREATE TEMP TABLE conversation_dupes ON COMMIT DROP AS
SELECT id, keep_id
FROM (
    SELECT id,
           FIRST_VALUE(id) OVER (
               PARTITION BY customer_id, craftsman_id
               ORDER BY created_at, id
           ) AS keep_id
    FROM public.conversations
) ranked
WHERE id <> keep_id;

-- 2b. The kept thread follows the most recent order of the pair.
UPDATE public.conversations keep
SET order_id = latest.order_id
FROM (
    SELECT DISTINCT ON (c.customer_id, c.craftsman_id)
           c.customer_id, c.craftsman_id, o.id AS order_id
    FROM public.conversations c
    JOIN public.orders o ON o.id = c.order_id
    ORDER BY c.customer_id, c.craftsman_id, o.created_at DESC
) latest
WHERE keep.customer_id = latest.customer_id
  AND keep.craftsman_id = latest.craftsman_id
  AND keep.id NOT IN (SELECT id FROM conversation_dupes);

-- 2c. Move messages and order links into the kept thread, then drop duplicates.
UPDATE public.messages m
SET conversation_id = d.keep_id
FROM conversation_dupes d
WHERE m.conversation_id = d.id;

UPDATE public.orders o
SET conversation_id = d.keep_id
FROM conversation_dupes d
WHERE o.conversation_id = d.id;

DELETE FROM public.conversations c
USING conversation_dupes d
WHERE c.id = d.id;

-- 2d. Refresh each thread's last-message preview.
UPDATE public.conversations c
SET last_message = lm.preview,
    last_message_at = lm.created_at
FROM (
    SELECT DISTINCT ON (conversation_id)
           conversation_id,
           COALESCE(
               content,
               CASE message_type::text
                   WHEN 'image' THEN '📷 صورة'
                   WHEN 'video' THEN '🎥 فيديو'
                   WHEN 'file'  THEN '📎 ' || COALESCE(file_name, 'ملف')
                   ELSE ''
               END
           ) AS preview,
           created_at
    FROM public.messages
    ORDER BY conversation_id, created_at DESC
) lm
WHERE lm.conversation_id = c.id;

-- 2e. Never more than one conversation per pair.
DROP INDEX IF EXISTS public.idx_conversations_pair;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_customer_craftsman_unique
    ON public.conversations (customer_id, craftsman_id);

-- 3. Open (or create) the single thread between a customer and a craftsman.
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
    p_customer_id UUID,
    p_craftsman_id UUID,
    p_order_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_conversation_id UUID;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() NOT IN (p_customer_id, p_craftsman_id) THEN
        RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = p_craftsman_id AND role = 'craftsman') THEN
        RAISE EXCEPTION 'Recipient is not a craftsman' USING ERRCODE = '22023';
    END IF;

    IF p_order_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM orders o
        LEFT JOIN craftsman_profiles cp ON cp.id = o.craftsman_id
        WHERE o.id = p_order_id
          AND o.customer_id = p_customer_id
          AND (o.craftsman_id IS NULL OR cp.user_id = p_craftsman_id)
    ) THEN
        RAISE EXCEPTION 'Order does not belong to this conversation' USING ERRCODE = '22023';
    END IF;

    INSERT INTO conversations (customer_id, craftsman_id, order_id)
    VALUES (p_customer_id, p_craftsman_id, p_order_id)
    ON CONFLICT (customer_id, craftsman_id)
    DO UPDATE SET order_id = COALESCE(EXCLUDED.order_id, conversations.order_id)
    RETURNING id INTO v_conversation_id;

    IF p_order_id IS NOT NULL THEN
        UPDATE orders SET conversation_id = v_conversation_id WHERE id = p_order_id;
    END IF;

    RETURN v_conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_conversation(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(UUID, UUID, UUID) TO authenticated;

-- Preview text for images/files too, not only text messages.
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.conversations
    SET last_message = COALESCE(
            NEW.content,
            CASE NEW.message_type::text
                WHEN 'image' THEN '📷 صورة'
                WHEN 'video' THEN '🎥 فيديو'
                WHEN 'file'  THEN '📎 ' || COALESCE(NEW.file_name, 'ملف')
                ELSE ''
            END
        ),
        last_message_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;

-- 4. Realtime
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversations') THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
        END IF;
    END IF;
END $$;

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

COMMIT;
