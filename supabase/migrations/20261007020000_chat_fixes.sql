-- ============================================================
-- Chat fixes
--  1. Publish conversations/messages to Supabase Realtime so new
--     messages appear in the open chat without a page refresh.
--  2. Only the two participants of a conversation can post in it.
--  3. Participants can mark messages as read.
-- ============================================================

-- 1. Realtime
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversations'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
        END IF;
    END IF;
END $$;

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

-- 2. Sending: you must be the sender AND a participant of the conversation.
DROP POLICY IF EXISTS "users_send_messages" ON public.messages;
CREATE POLICY "users_send_messages" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
    sender_id = auth.uid()
    AND conversation_id IN (
        SELECT id FROM public.conversations
        WHERE customer_id = auth.uid() OR craftsman_id = auth.uid()
    )
);

-- 3. Read receipts.
DROP POLICY IF EXISTS "participants_mark_messages_read" ON public.messages;
CREATE POLICY "participants_mark_messages_read" ON public.messages
FOR UPDATE TO authenticated
USING (
    conversation_id IN (
        SELECT id FROM public.conversations
        WHERE customer_id = auth.uid() OR craftsman_id = auth.uid()
    )
)
WITH CHECK (
    conversation_id IN (
        SELECT id FROM public.conversations
        WHERE customer_id = auth.uid() OR craftsman_id = auth.uid()
    )
);

-- The "last message" preview on conversations is updated by a trigger;
-- run it with owner rights so it works for both participants.
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.conversations
    SET last_message = COALESCE(NEW.content, CASE NEW.message_type WHEN 'image' THEN '📷 صورة' WHEN 'video' THEN '🎥 فيديو' ELSE '' END),
        last_message_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;

-- Note: conversations.customer_id and conversations.craftsman_id are
-- user_profiles ids (auth user ids) — NOT craftsman_profiles.id.
-- When starting a chat from a craftsman profile, use craftsman_profiles.user_id.
