BEGIN;

-- ============================================================
-- One conversation per customer–craftsman pair (like WhatsApp).
-- 1. Merge existing duplicate conversations into the oldest one.
-- 2. Prevent duplicates from being created again.
-- ============================================================

-- 1. Merge duplicates
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

-- Move every message into the conversation we keep (before deleting, so nothing is lost).
UPDATE public.messages m
SET conversation_id = d.keep_id
FROM conversation_dupes d
WHERE m.conversation_id = d.id;

DELETE FROM public.conversations c
USING conversation_dupes d
WHERE c.id = d.id;

-- Refresh the "last message" preview of every conversation.
UPDATE public.conversations c
SET last_message = lm.content,
    last_message_at = lm.created_at
FROM (
    SELECT DISTINCT ON (conversation_id)
           conversation_id,
           COALESCE(content, CASE message_type WHEN 'image' THEN '📷 صورة' WHEN 'video' THEN '🎥 فيديو' ELSE '' END) AS content,
           created_at
    FROM public.messages
    ORDER BY conversation_id, created_at DESC
) lm
WHERE lm.conversation_id = c.id;

-- 2. Never again more than one conversation per pair
DROP INDEX IF EXISTS public.idx_conversations_pair;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_customer_craftsman_unique
    ON public.conversations (customer_id, craftsman_id);

COMMIT;
