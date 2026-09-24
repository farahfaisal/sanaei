-- ============================================================
-- SANAEI APP - Full Schema Migration
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
CREATE TYPE public.message_type AS ENUM ('text', 'image', 'video', 'quote');

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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    content TEXT,
    message_type public.message_type NOT NULL DEFAULT 'text'::public.message_type,
    media_url TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
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
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON public.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_conversations_customer_id ON public.conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_craftsman_id ON public.conversations(craftsman_id);

-- ============================================================
-- 4. FUNCTIONS
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
    )
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
    )
)
WITH CHECK (
    customer_id = auth.uid() OR
    craftsman_id IN (
        SELECT id FROM public.craftsman_profiles WHERE user_id = auth.uid()
    )
);

-- conversations
DROP POLICY IF EXISTS "users_view_own_conversations" ON public.conversations;
CREATE POLICY "users_view_own_conversations" ON public.conversations
FOR SELECT TO authenticated
USING (customer_id = auth.uid() OR craftsman_id = auth.uid());

DROP POLICY IF EXISTS "users_create_conversations" ON public.conversations;
CREATE POLICY "users_create_conversations" ON public.conversations
FOR INSERT TO authenticated
WITH CHECK (customer_id = auth.uid() OR craftsman_id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_conversations" ON public.conversations;
CREATE POLICY "users_update_own_conversations" ON public.conversations
FOR UPDATE TO authenticated
USING (customer_id = auth.uid() OR craftsman_id = auth.uid())
WITH CHECK (customer_id = auth.uid() OR craftsman_id = auth.uid());

-- messages
DROP POLICY IF EXISTS "users_view_conversation_messages" ON public.messages;
CREATE POLICY "users_view_conversation_messages" ON public.messages
FOR SELECT TO authenticated
USING (
    conversation_id IN (
        SELECT id FROM public.conversations
        WHERE customer_id = auth.uid() OR craftsman_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "users_send_messages" ON public.messages;
CREATE POLICY "users_send_messages" ON public.messages
FOR INSERT TO authenticated
WITH CHECK (sender_id = auth.uid());

-- price_quotes
DROP POLICY IF EXISTS "users_view_own_quotes" ON public.price_quotes;
CREATE POLICY "users_view_own_quotes" ON public.price_quotes
FOR SELECT TO authenticated
USING (
    craftsman_id IN (
        SELECT id FROM public.craftsman_profiles WHERE user_id = auth.uid()
    ) OR
    order_id IN (
        SELECT id FROM public.orders WHERE customer_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "craftsmen_create_quotes" ON public.price_quotes;
CREATE POLICY "craftsmen_create_quotes" ON public.price_quotes
FOR INSERT TO authenticated
WITH CHECK (
    craftsman_id IN (
        SELECT id FROM public.craftsman_profiles WHERE user_id = auth.uid()
    )
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

DROP POLICY IF EXISTS "chat_media_auth_read" ON storage.objects;
CREATE POLICY "chat_media_auth_read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "chat_media_auth_upload" ON storage.objects;
CREATE POLICY "chat_media_auth_upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);

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

-- Demo users (phone OTP users)
DO $$
DECLARE
    customer_uuid UUID := gen_random_uuid();
    craftsman_uuid UUID := gen_random_uuid();
    craftsman2_uuid UUID := gen_random_uuid();
    craftsman_profile_id UUID := gen_random_uuid();
    craftsman_profile2_id UUID := gen_random_uuid();
    elec_cat_id UUID;
    ac_cat_id UUID;
    plumb_cat_id UUID;
    wallet_id_1 UUID := gen_random_uuid();
    wallet_id_2 UUID := gen_random_uuid();
    wallet_id_3 UUID := gen_random_uuid();
BEGIN
    -- Get category IDs
    SELECT id INTO elec_cat_id FROM public.service_categories WHERE slug = 'electricity' LIMIT 1;
    SELECT id INTO ac_cat_id FROM public.service_categories WHERE slug = 'ac' LIMIT 1;
    SELECT id INTO plumb_cat_id FROM public.service_categories WHERE slug = 'plumbing' LIMIT 1;

    -- Create demo auth users (phone-based)
    INSERT INTO auth.users (
        id, instance_id, aud, role, phone, phone_confirmed_at,
        created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
        is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
        recovery_token, recovery_sent_at, email_change_token_new, email_change,
        email_change_sent_at, email_change_token_current, email_change_confirm_status,
        reauthentication_token, reauthentication_sent_at, email, encrypted_password,
        phone_change, phone_change_token, phone_change_sent_at
    ) VALUES
        (customer_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         '+970599000001', now(), now(), now(),
         jsonb_build_object('full_name', 'محمد أحمد', 'role', 'customer', 'phone', '+970599000001'),
         jsonb_build_object('provider', 'phone', 'providers', ARRAY['phone']::TEXT[]),
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, null, '', '', null),
        (craftsman_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         '+970599000002', now(), now(), now(),
         jsonb_build_object('full_name', 'أحمد محمد', 'role', 'craftsman', 'phone', '+970599000002'),
         jsonb_build_object('provider', 'phone', 'providers', ARRAY['phone']::TEXT[]),
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, null, '', '', null),
        (craftsman2_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         '+970599000003', now(), now(), now(),
         jsonb_build_object('full_name', 'سامي الحربي', 'role', 'craftsman', 'phone', '+970599000003'),
         jsonb_build_object('provider', 'phone', 'providers', ARRAY['phone']::TEXT[]),
         false, false, '', null, '', null, '', '', null, '', 0, '', null, null, null, '', '', null)
    ON CONFLICT (id) DO NOTHING;

    -- Create craftsman profiles
    INSERT INTO public.craftsman_profiles (
        id, user_id, bio, specialty, experience_years, location,
        service_radius_km, is_online, is_verified, rating, total_reviews,
        completed_jobs, total_clients,
        avatar_url
    ) VALUES
        (craftsman_profile_id, craftsman_uuid,
         'متخصص في أعمال الكهرباء، وصيانة أجهزة التكييف، وأعمال إصلاح الأجهزة المنزلية. أقدم خدمة احترافية مع خبرة 6 سنوات.',
         'كهربائي وتكييف', 6, 'منطقة الرياض — حتى 15 كم', 15, true, true,
         4.9, 128, 350, 280,
         'https://img.rocket.new/generatedImages/rocket_gen_img_193df7de3-1782816308433.png'),
        (craftsman_profile2_id, craftsman2_uuid,
         'سباك محترف مع خبرة 8 سنوات في أعمال السباكة والصرف الصحي.',
         'سباكة', 8, 'الرياض', 12, true, true,
         4.8, 95, 290, 220,
         'https://img.rocket.new/generatedImages/rocket_gen_img_15b1c4f76-1772270756220.png')
    ON CONFLICT (id) DO NOTHING;

    -- Create services for craftsman 1
    INSERT INTO public.craftsman_services (craftsman_id, category_id, name, emoji, base_price, price_label) VALUES
        (craftsman_profile_id, elec_cat_id, 'تمديد كهرباء', '⚡', 100, 'ابتداء من 100 ريال'),
        (craftsman_profile_id, elec_cat_id, 'إصلاح أعطال كهربائية', '🔌', 80, 'ابتداء من 80 ريال'),
        (craftsman_profile_id, ac_cat_id, 'صيانة مكيف', '❄️', 120, 'ابتداء من 120 ريال'),
        (craftsman_profile_id, elec_cat_id, 'تركيب أجهزة', '📱', 150, 'ابتداء من 150 ريال')
    ON CONFLICT DO NOTHING;

    -- Create services for craftsman 2
    INSERT INTO public.craftsman_services (craftsman_id, category_id, name, emoji, base_price, price_label) VALUES
        (craftsman_profile2_id, plumb_cat_id, 'إصلاح تسريب مياه', '🔧', 90, 'ابتداء من 90 ريال'),
        (craftsman_profile2_id, plumb_cat_id, 'تركيب صنابير', '🚿', 70, 'ابتداء من 70 ريال')
    ON CONFLICT DO NOTHING;

    -- Portfolio items for craftsman 1
    INSERT INTO public.portfolio_items (craftsman_id, image_url, label) VALUES
        (craftsman_profile_id, 'https://img.rocket.new/generatedImages/rocket_gen_img_17181b72e-1767778680845.png', 'تركيب مكيف'),
        (craftsman_profile_id, 'https://img.rocket.new/generatedImages/rocket_gen_img_4f1262809-1788997980579.png', 'تمديد كهرباء كابل'),
        (craftsman_profile_id, 'https://img.rocket.new/generatedImages/rocket_gen_img_112e3dc67-1778778404784.png', 'صيانة توجة كهرباء')
    ON CONFLICT DO NOTHING;

    -- Create wallets
    INSERT INTO public.wallets (id, user_id, balance, locked_balance, total_earned, bank_account) VALUES
        (wallet_id_1, customer_uuid, 500, 0, 500, null),
        (wallet_id_2, craftsman_uuid, 8450, 1250, 128750, 'بنك الراجحي — ****9871'),
        (wallet_id_3, craftsman2_uuid, 3200, 400, 45000, 'بنك الأهلي — ****5432')
    ON CONFLICT (user_id) DO NOTHING;

    -- Wallet transactions for craftsman
    INSERT INTO public.wallet_transactions (wallet_id, transaction_type, amount, label, created_at) VALUES
        (wallet_id_2, 'income'::public.transaction_type, 120, 'دفعة خدمة — صيانة مكيف', NOW() - INTERVAL '2 hours'),
        (wallet_id_2, 'locked'::public.transaction_type, 240, 'دفعة معلقة — تركيب شباك', NOW() - INTERVAL '3 hours'),
        (wallet_id_2, 'withdrawal'::public.transaction_type, -340, 'سحب بنكي', NOW() - INTERVAL '1 day'),
        (wallet_id_2, 'income'::public.transaction_type, 180, 'دفعة خدمة — إصلاح عطل كهربائي', NOW() - INTERVAL '1 day 2 hours')
    ON CONFLICT DO NOTHING;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Seed data error: %', SQLERRM;
END $$;
