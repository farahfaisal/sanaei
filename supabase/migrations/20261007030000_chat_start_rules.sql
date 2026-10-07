-- ============================================================
-- Chat: only a customer can start a conversation, and only with a craftsman.
-- ============================================================

DROP POLICY IF EXISTS "users_create_conversations" ON public.conversations;
CREATE POLICY "users_create_conversations" ON public.conversations
FOR INSERT TO authenticated
WITH CHECK (
    customer_id = auth.uid()
    AND public.current_user_role() = 'customer'
    AND EXISTS (
        SELECT 1 FROM public.user_profiles p
        WHERE p.id = craftsman_id AND p.role = 'craftsman'
    )
);

CREATE INDEX IF NOT EXISTS idx_conversations_pair
    ON public.conversations (customer_id, craftsman_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
    ON public.messages (conversation_id, created_at DESC);
