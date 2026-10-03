-- ============================================================
-- SANAEI APP — Complete Schema Rebuild
-- Timestamp: 20261003223630
-- Combines all previous migrations into one idempotent file
-- ============================================================

-- ============================================================
-- 1. ENUM TYPES
-- ============================================================

DROP TYPE IF EXISTS public.user_role CASCADE;
CREATE TYPE public.user_role AS ENUM ('customer', 'craftsman', 'admin');

DROP TYPE IF EXISTS public.order_status CASCADE;
CREATE TYPE public.order_status AS ENUM ('pending', 'accepted', 'in_progress', 'completed', 'cancelled');

DROP TYPE IF EXISTS public.payment_method CASCADE;
CREATE TYPE public.payment_method AS ENUM ('card', 'cash', 'apple_pay', 'wallet');

DROP TYPE IF EXISTS public.payment_status CASCADE;
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'refunded', 'failed');

DROP TYPE IF EXISTS public.transaction_type CASCADE;
CREATE TYPE public.transaction_type AS ENUM ('income', 'withdrawal', 'locked', 'refund');

DROP TYPE IF EXISTS public.message_type CASCADE;
CREATE TYPE public.message_type AS ENUM ('text', 'image', 'video', 'quote', 'file');

-- ============================================================
-- 2. CORE TABLES
-- ============================================================

-- User profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone TEXT UNIQUE,
    full_name TEXT NOT NULL DEFAULT '',
    avatar_url TEXT,
    role public.user_role NOT NULL DEFAULT 'customer'::public.user_role,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    location TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service categories
CREATE TABLE IF NOT EXISTS public.service_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '🔧',
    slug TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Craftsman profiles
CREATE TABLE IF NOT EXISTS public.craftsman_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    bio TEXT,
    specialty TEXT,
    experience_years INTEGER NOT NULL DEFAULT 0,
    location TEXT,
    service_radius_km INTEGER NOT NULL DEFAULT 10,
    is_online BOOLEAN NOT NULL DEFAULT false,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    rating NUMERIC(3,2) NOT NULL DEFAULT 0,
    total_reviews INTEGER NOT NULL DEFAULT 0,
    completed_jobs INTEGER NOT NULL DEFAULT 0,
    total_clients INTEGER NOT NULL DEFAULT 0,
    cover_image_url TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Services offered by craftsmen
CREATE TABLE IF NOT EXISTS public.craftsman_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    craftsman_id UUID NOT NULL REFERENCES public.craftsman_profiles(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    emoji TEXT NOT NULL DEFAULT '🔧',
    base_price NUMERIC(10,2),
    price_label TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Portfolio items
CREATE TABLE IF NOT EXISTS public.portfolio_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    craftsman_id UUID NOT NULL REFERENCES public.craftsman_profiles(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    label TEXT,
    description TEXT,
    price NUMERIC(10,2) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orders / Service requests
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    craftsman_id UUID NOT NULL REFERENCES public.craftsman_profiles(id) ON DELETE CASCADE,
    service_id UUID REFERENCES public.craftsman_services(id) ON DELETE SET NULL,
    status public.order_status NOT NULL DEFAULT 'pending'::public.order_status,
    description TEXT,
    address TEXT,
    scheduled_at TIMESTAMPTZ,
    amount NUMERIC(10,2),
    payment_method public.payment_method DEFAULT 'cash'::public.payment_method,
    payment_status public.payment_status NOT NULL DEFAULT 'pending'::public.payment_status,
    notes TEXT,
    escrow_status TEXT NOT NULL DEFAULT 'none' CHECK (escrow_status IN ('none', 'held', 'released', 'refunded')),
    service_images TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Conversations
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    craftsman_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    customer_typing_at TIMESTAMPTZ,
    craftsman_typing_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from orders to conversations (after conversations table exists)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL;

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    content TEXT,
    message_type public.message_type NOT NULL DEFAULT 'text'::public.message_type,
    media_url TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    file_name TEXT,
    file_size INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Price quotes
CREATE TABLE IF NOT EXISTS public.price_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    craftsman_id UUID NOT NULL REFERENCES public.craftsman_profiles(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    description TEXT,
    is_accepted BOOLEAN,
    quote_status TEXT NOT NULL DEFAULT 'pending' CHECK (quote_status IN ('pending', 'accepted', 'rejected', 'modification_requested')),
    modification_note TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wallet
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    balance NUMERIC(10,2) NOT NULL DEFAULT 0,
    locked_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_earned NUMERIC(10,2) NOT NULL DEFAULT 0,
    bank_account TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Wallet transactions
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    transaction_type public.transaction_type NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    label TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reviews
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    craftsman_id UUID NOT NULL REFERENCES public.craftsman_profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'general',
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Push subscriptions (Web Push)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);

-- FCM tokens
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'android' CHECK (platform IN ('android', 'ios', 'web')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, token)
);

-- Promotional offers
CREATE TABLE IF NOT EXISTS public.promotional_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    discount_percent INTEGER,
    image_url TEXT,
    badge_text TEXT,
    button_text TEXT DEFAULT 'اكتشف العرض',
    bg_color_from TEXT DEFAULT '#1B5E20',
    bg_color_to TEXT DEFAULT '#2E7D32',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Saved addresses
CREATE TABLE IF NOT EXISTS public.saved_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    label TEXT NOT NULL DEFAULT 'المنزل',
    address_line TEXT NOT NULL,
    city TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment methods
CREATE TABLE IF NOT EXISTS public.payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    method_type TEXT NOT NULL DEFAULT 'card',
    label TEXT NOT NULL,
    last_four TEXT,
    expiry_month INTEGER,
    expiry_year INTEGER,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_phone ON public.user_profiles(phone);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_craftsman_profiles_user_id ON public.craftsman_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_craftsman_profiles_is_online ON public.craftsman_profiles(is_online);
CREATE INDEX IF NOT EXISTS idx_craftsman_services_craftsman_id ON public.craftsman_services(craftsman_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_craftsman_id ON public.orders(craftsman_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_conversation_id ON public.orders(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON public.messages(conversation_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_messages_read_at ON public.messages(conversation_id, read_at);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON public.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_conversations_customer_id ON public.conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_craftsman_id ON public.conversations(craftsman_id);
CREATE INDEX IF NOT EXISTS idx_conversations_order_id ON public.conversations(order_id);
CREATE INDEX IF NOT EXISTS idx_price_quotes_order_id ON public.price_quotes(order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON public.fcm_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_promotional_offers_active ON public.promotional_offers(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_saved_addresses_user_id ON public.saved_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON public.payment_methods(user_id);

-- ============================================================
-- 4. FUNCTIONS (must be before RLS policies that reference them)
-- ============================================================

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, phone, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'customer')::public.user_role
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Auto-create wallet for new user
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.wallets (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- Update craftsman rating after review
CREATE OR REPLACE FUNCTION public.update_craftsman_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.craftsman_profiles
    SET
        rating = (
            SELECT ROUND(AVG(rating)::NUMERIC, 2)
            FROM public.reviews
            WHERE craftsman_id = NEW.craftsman_id
        ),
        total_reviews = (
            SELECT COUNT(*) FROM public.reviews WHERE craftsman_id = NEW.craftsman_id
        )
    WHERE id = NEW.craftsman_id;
    RETURN NEW;
END;
$$;

-- Update conversation last message
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.conversations
    SET last_message = NEW.content,
        last_message_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$;

-- Notify craftsman on new order
CREATE OR REPLACE FUNCTION public.notify_craftsman_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    craftsman_user_id UUID;
    customer_name TEXT;
BEGIN
    SELECT user_id INTO craftsman_user_id
    FROM public.craftsman_profiles
    WHERE id = NEW.craftsman_id
    LIMIT 1;

    SELECT full_name INTO customer_name
    FROM public.user_profiles
    WHERE id = NEW.customer_id
    LIMIT 1;

    IF craftsman_user_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, title, body, type, order_id)
        VALUES (
            craftsman_user_id,
            'طلب جديد 🔔',
            COALESCE('لديك طلب جديد من ' || customer_name, 'لديك طلب خدمة جديد'),
            'new_order',
            NEW.id
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Notify customer on order status change
CREATE OR REPLACE FUNCTION public.notify_customer_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    status_label TEXT;
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    CASE NEW.status
        WHEN 'accepted'    THEN status_label := 'تم قبول طلبك ✅';
        WHEN 'in_progress' THEN status_label := 'الصنايعي في الطريق إليك 🚗';
        WHEN 'completed'   THEN status_label := 'تم إنجاز طلبك بنجاح 🎉';
        WHEN 'cancelled'   THEN status_label := 'تم إلغاء طلبك ❌';
        ELSE status_label := 'تم تحديث حالة طلبك';
    END CASE;

    INSERT INTO public.notifications (user_id, title, body, type, order_id)
    VALUES (
        NEW.customer_id,
        'تحديث الطلب',
        status_label,
        'order_status',
        NEW.id
    );

    RETURN NEW;
END;
$$;

-- Helper: check if user is conversation participant
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

-- Helper: check if user is admin
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

-- Mark messages as read
CREATE OR REPLACE FUNCTION public.mark_messages_read(p_conversation_id UUID, p_reader_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.messages
    SET is_read = true,
        read_at = NOW()
    WHERE conversation_id = p_conversation_id
      AND sender_id != p_reader_id
      AND is_read = false;
END;
$$;

-- ============================================================
-- 5. ENABLE RLS
-- ============================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.craftsman_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.craftsman_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotional_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================

-- user_profiles
DROP POLICY IF EXISTS "users_manage_own_profile" ON public.user_profiles;
CREATE POLICY "users_manage_own_profile" ON public.user_profiles
FOR ALL TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "users_view_all_profiles" ON public.user_profiles;
CREATE POLICY "users_view_all_profiles" ON public.user_profiles
FOR SELECT TO authenticated
USING (true);

-- service_categories (public read)
DROP POLICY IF EXISTS "public_read_categories" ON public.service_categories;
CREATE POLICY "public_read_categories" ON public.service_categories
FOR SELECT TO public
USING (true);

-- craftsman_profiles (public read, owner write)
DROP POLICY IF EXISTS "public_read_craftsman_profiles" ON public.craftsman_profiles;
CREATE POLICY "public_read_craftsman_profiles" ON public.craftsman_profiles
FOR SELECT TO public
USING (true);

DROP POLICY IF EXISTS "craftsmen_manage_own_profile" ON public.craftsman_profiles;
CREATE POLICY "craftsmen_manage_own_profile" ON public.craftsman_profiles
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- craftsman_services (public read, owner write)
DROP POLICY IF EXISTS "public_read_craftsman_services" ON public.craftsman_services;
CREATE POLICY "public_read_craftsman_services" ON public.craftsman_services
FOR SELECT TO public
USING (true);

DROP POLICY IF EXISTS "craftsmen_manage_own_services" ON public.craftsman_services;
CREATE POLICY "craftsmen_manage_own_services" ON public.craftsman_services
FOR ALL TO authenticated
USING (
    craftsman_id IN (
        SELECT id FROM public.craftsman_profiles WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    craftsman_id IN (
        SELECT id FROM public.craftsman_profiles WHERE user_id = auth.uid()
    )
);

-- portfolio_items (public read, owner write)
DROP POLICY IF EXISTS "public_read_portfolio" ON public.portfolio_items;
CREATE POLICY "public_read_portfolio" ON public.portfolio_items
FOR SELECT TO public
USING (true);

DROP POLICY IF EXISTS "craftsmen_manage_own_portfolio" ON public.portfolio_items;
CREATE POLICY "craftsmen_manage_own_portfolio" ON public.portfolio_items
FOR ALL TO authenticated
USING (
    craftsman_id IN (
        SELECT id FROM public.craftsman_profiles WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    craftsman_id IN (
        SELECT id FROM public.craftsman_profiles WHERE user_id = auth.uid()
    )
);

-- orders
DROP POLICY IF EXISTS "users_view_own_orders" ON public.orders;
CREATE POLICY "users_view_own_orders" ON public.orders
FOR SELECT TO authenticated
USING (
    customer_id = auth.uid() OR
    craftsman_id IN (
        SELECT id FROM public.craftsman_profiles WHERE user_id = auth.uid()
    ) OR
    public.is_admin_user()
);

DROP POLICY IF EXISTS "customers_create_orders" ON public.orders;
CREATE POLICY "customers_create_orders" ON public.orders
FOR INSERT TO authenticated
WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_orders" ON public.orders;
CREATE POLICY "users_update_own_orders" ON public.orders
FOR UPDATE TO authenticated
USING (
    customer_id = auth.uid() OR
    craftsman_id IN (
        SELECT id FROM public.craftsman_profiles WHERE user_id = auth.uid()
    ) OR
    public.is_admin_user()
)
WITH CHECK (
    customer_id = auth.uid() OR
    craftsman_id IN (
        SELECT id FROM public.craftsman_profiles WHERE user_id = auth.uid()
    ) OR
    public.is_admin_user()
);

-- conversations
DROP POLICY IF EXISTS "participants_view_conversations" ON public.conversations;
CREATE POLICY "participants_view_conversations" ON public.conversations
FOR SELECT TO authenticated
USING (
    customer_id = auth.uid()
    OR craftsman_id = auth.uid()
    OR public.is_admin_user()
);

DROP POLICY IF EXISTS "customers_create_conversations" ON public.conversations;
CREATE POLICY "customers_create_conversations" ON public.conversations
FOR INSERT TO authenticated
WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "participants_update_conversations" ON public.conversations;
CREATE POLICY "participants_update_conversations" ON public.conversations
FOR UPDATE TO authenticated
USING (customer_id = auth.uid() OR craftsman_id = auth.uid() OR public.is_admin_user())
WITH CHECK (customer_id = auth.uid() OR craftsman_id = auth.uid() OR public.is_admin_user());

-- messages
DROP POLICY IF EXISTS "participants_view_messages" ON public.messages;
CREATE POLICY "participants_view_messages" ON public.messages
FOR SELECT TO authenticated
USING (
    public.is_conversation_participant(conversation_id)
    OR public.is_admin_user()
);

DROP POLICY IF EXISTS "participants_send_messages" ON public.messages;
CREATE POLICY "participants_send_messages" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(conversation_id)
);

DROP POLICY IF EXISTS "participants_update_messages" ON public.messages;
CREATE POLICY "participants_update_messages" ON public.messages
FOR UPDATE TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- price_quotes
DROP POLICY IF EXISTS "quote_participants_view" ON public.price_quotes;
CREATE POLICY "quote_participants_view" ON public.price_quotes
FOR SELECT TO authenticated
USING (
    craftsman_id = (SELECT cp.id FROM public.craftsman_profiles cp WHERE cp.user_id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id = auth.uid())
    OR public.is_admin_user()
);

DROP POLICY IF EXISTS "craftsmen_create_quotes" ON public.price_quotes;
CREATE POLICY "craftsmen_create_quotes" ON public.price_quotes
FOR INSERT TO authenticated
WITH CHECK (
    craftsman_id = (SELECT cp.id FROM public.craftsman_profiles cp WHERE cp.user_id = auth.uid() LIMIT 1)
);

DROP POLICY IF EXISTS "quote_participants_update" ON public.price_quotes;
CREATE POLICY "quote_participants_update" ON public.price_quotes
FOR UPDATE TO authenticated
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

-- wallets
DROP POLICY IF EXISTS "users_view_own_wallet" ON public.wallets;
CREATE POLICY "users_view_own_wallet" ON public.wallets
FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_manage_own_wallet" ON public.wallets;
CREATE POLICY "users_manage_own_wallet" ON public.wallets
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- wallet_transactions
DROP POLICY IF EXISTS "users_view_own_transactions" ON public.wallet_transactions;
CREATE POLICY "users_view_own_transactions" ON public.wallet_transactions
FOR SELECT TO authenticated
USING (
    wallet_id IN (
        SELECT id FROM public.wallets WHERE user_id = auth.uid()
    )
);

-- reviews
DROP POLICY IF EXISTS "public_read_reviews" ON public.reviews;
CREATE POLICY "public_read_reviews" ON public.reviews
FOR SELECT TO public
USING (true);

DROP POLICY IF EXISTS "customers_create_reviews" ON public.reviews;
CREATE POLICY "customers_create_reviews" ON public.reviews
FOR INSERT TO authenticated
WITH CHECK (customer_id = auth.uid());

-- notifications
DROP POLICY IF EXISTS "users_manage_own_notifications" ON public.notifications;
CREATE POLICY "users_manage_own_notifications" ON public.notifications
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "service_role_insert_notifications" ON public.notifications;
CREATE POLICY "service_role_insert_notifications" ON public.notifications
FOR INSERT TO service_role
WITH CHECK (true);

-- push_subscriptions
DROP POLICY IF EXISTS "users_manage_own_push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "users_manage_own_push_subscriptions" ON public.push_subscriptions
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- fcm_tokens
DROP POLICY IF EXISTS "users_manage_own_fcm_tokens" ON public.fcm_tokens;
CREATE POLICY "users_manage_own_fcm_tokens" ON public.fcm_tokens
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "service_role_read_fcm_tokens" ON public.fcm_tokens;
CREATE POLICY "service_role_read_fcm_tokens" ON public.fcm_tokens
FOR SELECT TO service_role
USING (true);

DROP POLICY IF EXISTS "service_role_delete_fcm_tokens" ON public.fcm_tokens;
CREATE POLICY "service_role_delete_fcm_tokens" ON public.fcm_tokens
FOR DELETE TO service_role
USING (true);

-- promotional_offers
DROP POLICY IF EXISTS "public_read_promotional_offers" ON public.promotional_offers;
CREATE POLICY "public_read_promotional_offers" ON public.promotional_offers
FOR SELECT TO public
USING (is_active = true);

DROP POLICY IF EXISTS "admin_manage_promotional_offers" ON public.promotional_offers;
CREATE POLICY "admin_manage_promotional_offers" ON public.promotional_offers
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- saved_addresses
DROP POLICY IF EXISTS "users_manage_own_saved_addresses" ON public.saved_addresses;
CREATE POLICY "users_manage_own_saved_addresses" ON public.saved_addresses
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- payment_methods
DROP POLICY IF EXISTS "users_manage_own_payment_methods" ON public.payment_methods;
CREATE POLICY "users_manage_own_payment_methods" ON public.payment_methods
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================
-- 7. TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_user_profile_created ON public.user_profiles;
CREATE TRIGGER on_user_profile_created
    AFTER INSERT ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_wallet();

DROP TRIGGER IF EXISTS on_review_created ON public.reviews;
CREATE TRIGGER on_review_created
    AFTER INSERT ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.update_craftsman_rating();

DROP TRIGGER IF EXISTS on_message_created ON public.messages;
CREATE TRIGGER on_message_created
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

DROP TRIGGER IF EXISTS on_new_order_notify_craftsman ON public.orders;
CREATE TRIGGER on_new_order_notify_craftsman
    AFTER INSERT ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.notify_craftsman_new_order();

DROP TRIGGER IF EXISTS on_order_status_change_notify_customer ON public.orders;
CREATE TRIGGER on_order_status_change_notify_customer
    AFTER UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.notify_customer_order_status();

-- ============================================================
-- 8. STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('portfolio', 'portfolio', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime']),
    ('service-media', 'service-media', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
    ('chat-media', 'chat-media', false, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS "avatars_public_read" ON storage.objects;
CREATE POLICY "avatars_public_read" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_auth_upload" ON storage.objects;
CREATE POLICY "avatars_auth_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "portfolio_public_read" ON storage.objects;
CREATE POLICY "portfolio_public_read" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'portfolio');

DROP POLICY IF EXISTS "portfolio_auth_upload" ON storage.objects;
CREATE POLICY "portfolio_auth_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "service_media_public_read" ON storage.objects;
CREATE POLICY "service_media_public_read" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'service-media');

DROP POLICY IF EXISTS "service_media_auth_upload" ON storage.objects;
CREATE POLICY "service_media_auth_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'service-media');

DROP POLICY IF EXISTS "chat_media_read" ON storage.objects;
CREATE POLICY "chat_media_read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'chat-media' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "chat_media_upload" ON storage.objects;
CREATE POLICY "chat_media_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-media' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "chat_media_delete" ON storage.objects;
CREATE POLICY "chat_media_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'chat-media' AND (storage.foldername(name))[2] = auth.uid()::text);

-- ============================================================
-- 9. SEED DATA
-- ============================================================

-- Service categories
INSERT INTO public.service_categories (id, name, emoji, slug) VALUES
    (gen_random_uuid(), 'كهرباء', '⚡', 'electricity'),
    (gen_random_uuid(), 'تكييف', '❄️', 'ac'),
    (gen_random_uuid(), 'نجارة', '🪚', 'carpentry'),
    (gen_random_uuid(), 'سباكة', '🔧', 'plumbing'),
    (gen_random_uuid(), 'دهان', '🎨', 'painting'),
    (gen_random_uuid(), 'نقل', '🚛', 'transport'),
    (gen_random_uuid(), 'تنظيف', '🧹', 'cleaning'),
    (gen_random_uuid(), 'سيارات', '🚗', 'cars')
ON CONFLICT (slug) DO NOTHING;

-- Promotional offers
DO $$
BEGIN
    INSERT INTO public.promotional_offers (title, description, discount_percent, image_url, badge_text, button_text, bg_color_from, bg_color_to, is_active, sort_order)
    VALUES
        ('خصم 20% على خدمات التكييف', 'احصل على خصم حصري على جميع خدمات تركيب وصيانة التكييف', 20,
         'https://img.rocket.new/generatedImages/rocket_gen_img_1122596dd-1785829864899.png',
         '🌬️ عرض الصيف', 'اكتشف العرض', '#1B5E20', '#2E7D32', true, 1),
        ('خدمات السباكة بأسعار مخفضة', 'إصلاح وصيانة السباكة مع ضمان الجودة', 15,
         'https://img.rocket.new/generatedImages/rocket_gen_img_1122596dd-1785829864899.png',
         '🔧 عرض خاص', 'احجز الآن', '#1565C0', '#1976D2', true, 2),
        ('كهربائي معتمد في منزلك', 'خدمات كهربائية احترافية بأسعار تنافسية', 10,
         'https://img.rocket.new/generatedImages/rocket_gen_img_1122596dd-1785829864899.png',
         '⚡ عرض محدود', 'اطلب الخدمة', '#6A1B9A', '#7B1FA2', true, 3)
    ON CONFLICT (id) DO NOTHING;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Promotional offers seed skipped: %', SQLERRM;
END $$;

-- Demo accounts
-- ============================================================
-- Demo Credentials:
--   Customer:  970599000001@sanaei.app  /  123456
--   Craftsman: 970599000002@sanaei.app  /  123456
--   Craftsman علي: 970599000003@sanaei.app  /  123456
-- ============================================================

DO $$
DECLARE
    customer_id UUID;
    craftsman_id UUID;
    ali_id UUID;
    new_customer_id UUID := gen_random_uuid();
    new_craftsman_id UUID := gen_random_uuid();
    new_ali_id UUID := gen_random_uuid();
    craftsman_profile_id UUID;
    craftsman_profile2_id UUID;
    ali_profile_id UUID;
    new_craftsman_profile_id UUID := gen_random_uuid();
    new_craftsman_profile2_id UUID := gen_random_uuid();
    new_ali_profile_id UUID := gen_random_uuid();
    elec_cat_id UUID;
    ac_cat_id UUID;
    plumb_cat_id UUID;
    wallet_id_craftsman UUID := gen_random_uuid();
    wallet_id_craftsman2 UUID := gen_random_uuid();
BEGIN
    -- Get category IDs
    SELECT id INTO elec_cat_id FROM public.service_categories WHERE slug = 'electricity' LIMIT 1;
    SELECT id INTO ac_cat_id FROM public.service_categories WHERE slug = 'ac' LIMIT 1;
    SELECT id INTO plumb_cat_id FROM public.service_categories WHERE slug = 'plumbing' LIMIT 1;

    -- ── CUSTOMER ──────────────────────────────────────────────
    SELECT id INTO customer_id FROM auth.users WHERE phone = '+970599000001' LIMIT 1;

    IF customer_id IS NULL THEN
        INSERT INTO auth.users (
            id, instance_id, aud, role,
            email, encrypted_password, email_confirmed_at,
            phone, phone_confirmed_at,
            created_at, updated_at,
            raw_user_meta_data, raw_app_meta_data,
            is_sso_user, is_anonymous,
            confirmation_token, confirmation_sent_at,
            recovery_token, recovery_sent_at,
            email_change_token_new, email_change,
            email_change_sent_at, email_change_token_current,
            email_change_confirm_status,
            reauthentication_token, reauthentication_sent_at,
            phone_change, phone_change_token, phone_change_sent_at
        ) VALUES (
            new_customer_id, '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated',
            '970599000001@sanaei.app',
            crypt('123456', gen_salt('bf', 10)), now(),
            '+970599000001', now(), now(), now(),
            jsonb_build_object('full_name', 'أحمد الزبون', 'role', 'customer'),
            jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
            false, false, '', null, '', null, '', '', null, '', 0, '', null, '', '', null
        );
        customer_id := new_customer_id;

        INSERT INTO public.user_profiles (id, phone, full_name, role, is_active, is_verified, created_at, updated_at)
        VALUES (customer_id, '+970599000001', 'أحمد الزبون', 'customer'::public.user_role, true, true, now(), now())
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO public.wallets (user_id, balance, locked_balance, total_earned, updated_at)
        VALUES (customer_id, 500, 0, 500, now())
        ON CONFLICT (user_id) DO NOTHING;
    ELSE
        UPDATE auth.users SET
            email = '970599000001@sanaei.app',
            encrypted_password = crypt('123456', gen_salt('bf', 10)),
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
            updated_at = now()
        WHERE id = customer_id;
    END IF;

    -- ── CRAFTSMAN 1 (محمد الصنايعي) ──────────────────────────
    SELECT id INTO craftsman_id FROM auth.users WHERE phone = '+970599000002' LIMIT 1;

    IF craftsman_id IS NULL THEN
        INSERT INTO auth.users (
            id, instance_id, aud, role,
            email, encrypted_password, email_confirmed_at,
            phone, phone_confirmed_at,
            created_at, updated_at,
            raw_user_meta_data, raw_app_meta_data,
            is_sso_user, is_anonymous,
            confirmation_token, confirmation_sent_at,
            recovery_token, recovery_sent_at,
            email_change_token_new, email_change,
            email_change_sent_at, email_change_token_current,
            email_change_confirm_status,
            reauthentication_token, reauthentication_sent_at,
            phone_change, phone_change_token, phone_change_sent_at
        ) VALUES (
            new_craftsman_id, '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated',
            '970599000002@sanaei.app',
            crypt('123456', gen_salt('bf', 10)), now(),
            '+970599000002', now(), now(), now(),
            jsonb_build_object('full_name', 'أحمد محمد', 'role', 'craftsman'),
            jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
            false, false, '', null, '', null, '', '', null, '', 0, '', null, '', '', null
        );
        craftsman_id := new_craftsman_id;

        INSERT INTO public.user_profiles (id, phone, full_name, role, is_active, is_verified, created_at, updated_at)
        VALUES (craftsman_id, '+970599000002', 'أحمد محمد', 'craftsman'::public.user_role, true, true, now(), now())
        ON CONFLICT (id) DO NOTHING;
    ELSE
        UPDATE auth.users SET
            email = '970599000002@sanaei.app',
            encrypted_password = crypt('123456', gen_salt('bf', 10)),
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
            updated_at = now()
        WHERE id = craftsman_id;
    END IF;

    -- Craftsman 1 profile
    SELECT id INTO craftsman_profile_id FROM public.craftsman_profiles WHERE user_id = craftsman_id LIMIT 1;
    IF craftsman_profile_id IS NULL THEN
        INSERT INTO public.craftsman_profiles (
            id, user_id, bio, specialty, experience_years, location,
            service_radius_km, is_online, is_verified, rating, total_reviews,
            completed_jobs, total_clients, avatar_url
        ) VALUES (
            new_craftsman_profile_id, craftsman_id,
            'متخصص في أعمال الكهرباء، وصيانة أجهزة التكييف، وأعمال إصلاح الأجهزة المنزلية. أقدم خدمة احترافية مع خبرة 6 سنوات.',
            'كهربائي وتكييف', 6, '24.7136,46.6753', 15, true, true, 4.9, 128, 350, 280,
            'https://img.rocket.new/generatedImages/rocket_gen_img_193df7de3-1782816308433.png'
        ) ON CONFLICT (id) DO NOTHING;
        craftsman_profile_id := new_craftsman_profile_id;
    END IF;

    -- Services for craftsman 1
    INSERT INTO public.craftsman_services (craftsman_id, category_id, name, emoji, base_price, price_label) VALUES
        (craftsman_profile_id, elec_cat_id, 'تمديد كهرباء', '⚡', 100, 'ابتداء من 100 ريال'),
        (craftsman_profile_id, elec_cat_id, 'إصلاح أعطال كهربائية', '🔌', 80, 'ابتداء من 80 ريال'),
        (craftsman_profile_id, ac_cat_id, 'صيانة مكيف', '❄️', 120, 'ابتداء من 120 ريال'),
        (craftsman_profile_id, elec_cat_id, 'تركيب أجهزة', '📱', 150, 'ابتداء من 150 ريال')
    ON CONFLICT DO NOTHING;

    -- Portfolio for craftsman 1
    INSERT INTO public.portfolio_items (craftsman_id, image_url, label) VALUES
        (craftsman_profile_id, 'https://img.rocket.new/generatedImages/rocket_gen_img_17181b72e-1767778680845.png', 'تركيب مكيف'),
        (craftsman_profile_id, 'https://img.rocket.new/generatedImages/rocket_gen_img_4f1262809-1788997980579.png', 'تمديد كهرباء كابل'),
        (craftsman_profile_id, 'https://img.rocket.new/generatedImages/rocket_gen_img_112e3dc67-1778778404784.png', 'صيانة توجة كهرباء')
    ON CONFLICT DO NOTHING;

    -- Wallet for craftsman 1
    INSERT INTO public.wallets (id, user_id, balance, locked_balance, total_earned, bank_account)
    VALUES (wallet_id_craftsman, craftsman_id, 8450, 1250, 128750, 'بنك الراجحي — ****9871')
    ON CONFLICT (user_id) DO NOTHING;

    -- Wallet transactions for craftsman 1
    INSERT INTO public.wallet_transactions (wallet_id, transaction_type, amount, label, created_at) VALUES
        (wallet_id_craftsman, 'income'::public.transaction_type, 120, 'دفعة خدمة — صيانة مكيف', NOW() - INTERVAL '2 hours'),
        (wallet_id_craftsman, 'locked'::public.transaction_type, 240, 'دفعة معلقة — تركيب شباك', NOW() - INTERVAL '3 hours'),
        (wallet_id_craftsman, 'withdrawal'::public.transaction_type, -340, 'سحب بنكي', NOW() - INTERVAL '1 day'),
        (wallet_id_craftsman, 'income'::public.transaction_type, 180, 'دفعة خدمة — إصلاح عطل كهربائي', NOW() - INTERVAL '1 day 2 hours')
    ON CONFLICT DO NOTHING;

    -- ── CRAFTSMAN علي ─────────────────────────────────────────
    SELECT id INTO ali_id FROM auth.users WHERE phone = '+970599000003' LIMIT 1;

    IF ali_id IS NULL THEN
        INSERT INTO auth.users (
            id, instance_id, aud, role,
            email, encrypted_password, email_confirmed_at,
            phone, phone_confirmed_at,
            created_at, updated_at,
            raw_user_meta_data, raw_app_meta_data,
            is_sso_user, is_anonymous,
            confirmation_token, confirmation_sent_at,
            recovery_token, recovery_sent_at,
            email_change_token_new, email_change,
            email_change_sent_at, email_change_token_current,
            email_change_confirm_status,
            reauthentication_token, reauthentication_sent_at,
            phone_change, phone_change_token, phone_change_sent_at
        ) VALUES (
            new_ali_id, '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated',
            '970599000003@sanaei.app',
            crypt('123456', gen_salt('bf', 10)), now(),
            '+970599000003', now(), now(), now(),
            jsonb_build_object('full_name', 'علي', 'role', 'craftsman'),
            jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
            false, false, '', null, '', null, '', '', null, '', 0, '', null, '', '', null
        );
        ali_id := new_ali_id;

        INSERT INTO public.user_profiles (id, phone, full_name, role, is_active, is_verified, location, created_at, updated_at)
        VALUES (ali_id, '+970599000003', 'علي', 'craftsman'::public.user_role, true, true, '24.7136,46.6753', now(), now())
        ON CONFLICT (id) DO UPDATE SET
            full_name = 'علي',
            role = 'craftsman'::public.user_role,
            is_active = true,
            is_verified = true,
            location = '24.7136,46.6753',
            updated_at = now();
    ELSE
        UPDATE auth.users SET
            email = '970599000003@sanaei.app',
            encrypted_password = crypt('123456', gen_salt('bf', 10)),
            email_confirmed_at = COALESCE(email_confirmed_at, now()),
            raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
            updated_at = now()
        WHERE id = ali_id;

        UPDATE public.user_profiles SET
            location = '24.7136,46.6753',
            updated_at = now()
        WHERE id = ali_id;
    END IF;

    -- علي craftsman profile
    SELECT id INTO ali_profile_id FROM public.craftsman_profiles WHERE user_id = ali_id LIMIT 1;
    IF ali_profile_id IS NULL THEN
        INSERT INTO public.craftsman_profiles (
            id, user_id, bio, specialty, experience_years, location,
            service_radius_km, is_online, is_verified, rating, total_reviews,
            completed_jobs, total_clients
        ) VALUES (
            new_ali_profile_id, ali_id,
            'صنايعي محترف متاح للخدمة',
            'كهرباء وسباكة', 5, '24.7136,46.6753',
            15, true, true, 4.8, 12, 25, 20
        ) ON CONFLICT (id) DO NOTHING;
        ali_profile_id := new_ali_profile_id;
    ELSE
        UPDATE public.craftsman_profiles SET
            is_online = true,
            is_verified = true,
            location = '24.7136,46.6753',
            updated_at = now()
        WHERE id = ali_profile_id;
    END IF;

    -- Services for علي
    INSERT INTO public.craftsman_services (craftsman_id, category_id, name, emoji, base_price, price_label) VALUES
        (ali_profile_id, plumb_cat_id, 'إصلاح تسريب مياه', '🔧', 90, 'ابتداء من 90 ريال'),
        (ali_profile_id, plumb_cat_id, 'تركيب صنابير', '🚿', 70, 'ابتداء من 70 ريال')
    ON CONFLICT DO NOTHING;

    -- Wallet for علي
    INSERT INTO public.wallets (id, user_id, balance, locked_balance, total_earned, bank_account)
    VALUES (wallet_id_craftsman2, ali_id, 3200, 400, 45000, 'بنك الأهلي — ****5432')
    ON CONFLICT (user_id) DO NOTHING;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Seed data error: %', SQLERRM;
END $$;
