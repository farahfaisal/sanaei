-- Chat Flow Enhancements Migration
-- Adds missing columns and RLS policies for full chat + quote + payment escrow flow

-- 1. Add conversation_id to orders (link order to its conversation)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL;

-- 2. Add quote_status to price_quotes (pending/accepted/rejected/modification_requested)
ALTER TABLE public.price_quotes
ADD COLUMN IF NOT EXISTS quote_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (quote_status IN ('pending', 'accepted', 'rejected', 'modification_requested'));

-- 3. Add modification_note to price_quotes (customer note when requesting modification)
ALTER TABLE public.price_quotes
ADD COLUMN IF NOT EXISTS modification_note TEXT;

-- 4. Add escrow fields to orders
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS escrow_status TEXT NOT NULL DEFAULT 'none'
  CHECK (escrow_status IN ('none', 'held', 'released', 'refunded'));

-- 5. Add service_images array to orders (URLs of images uploaded by customer)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS service_images TEXT[] DEFAULT ARRAY[]::TEXT[];

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_customer_id ON public.conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_craftsman_id ON public.conversations(craftsman_id);
CREATE INDEX IF NOT EXISTS idx_conversations_order_id ON public.conversations(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_price_quotes_order_id ON public.price_quotes(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_conversation_id ON public.orders(conversation_id);

-- 7. Functions for RLS
CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conv_id
      AND (c.customer_id = auth.uid() OR c.craftsman_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'admin'
  );
$$;

-- 8. Enable RLS on conversations and messages (already enabled but ensure)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_quotes ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies for conversations
DROP POLICY IF EXISTS "participants_view_conversations" ON public.conversations;
CREATE POLICY "participants_view_conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  customer_id = auth.uid()
  OR craftsman_id = auth.uid()
  OR public.is_admin_user()
);

DROP POLICY IF EXISTS "customers_create_conversations" ON public.conversations;
CREATE POLICY "customers_create_conversations"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "participants_update_conversations" ON public.conversations;
CREATE POLICY "participants_update_conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (customer_id = auth.uid() OR craftsman_id = auth.uid() OR public.is_admin_user())
WITH CHECK (customer_id = auth.uid() OR craftsman_id = auth.uid() OR public.is_admin_user());

-- 10. RLS Policies for messages
DROP POLICY IF EXISTS "participants_view_messages" ON public.messages;
CREATE POLICY "participants_view_messages"
ON public.messages
FOR SELECT
TO authenticated
USING (
  public.is_conversation_participant(conversation_id)
  OR public.is_admin_user()
);

DROP POLICY IF EXISTS "participants_send_messages" ON public.messages;
CREATE POLICY "participants_send_messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND public.is_conversation_participant(conversation_id)
);

DROP POLICY IF EXISTS "participants_update_messages" ON public.messages;
CREATE POLICY "participants_update_messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- 11. RLS Policies for price_quotes
DROP POLICY IF EXISTS "quote_participants_view" ON public.price_quotes;
CREATE POLICY "quote_participants_view"
ON public.price_quotes
FOR SELECT
TO authenticated
USING (
  craftsman_id = (SELECT cp.id FROM public.craftsman_profiles cp WHERE cp.user_id = auth.uid() LIMIT 1)
  OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id = auth.uid())
  OR public.is_admin_user()
);

DROP POLICY IF EXISTS "craftsmen_create_quotes" ON public.price_quotes;
CREATE POLICY "craftsmen_create_quotes"
ON public.price_quotes
FOR INSERT
TO authenticated
WITH CHECK (
  craftsman_id = (SELECT cp.id FROM public.craftsman_profiles cp WHERE cp.user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "quote_participants_update" ON public.price_quotes;
CREATE POLICY "quote_participants_update"
ON public.price_quotes
FOR UPDATE
TO authenticated
USING (
  craftsman_id = (SELECT cp.id FROM public.craftsman_profiles cp WHERE cp.user_id = auth.uid() LIMIT 1)
  OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id = auth.uid())
  OR public.is_admin_user()
)
WITH CHECK (
  craftsman_id = (SELECT cp.id FROM public.craftsman_profiles cp WHERE cp.user_id = auth.uid() LIMIT 1)
  OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id = auth.uid())
  OR public.is_admin_user()
);

-- 12. Storage policy for chat-media bucket (public read, authenticated write)
-- Note: Storage policies are managed via Supabase dashboard or storage API
-- The chat-media bucket already exists per schema analysis
