-- ============================================================
-- DEMO ACCOUNTS: Customer + Craftsman
-- ============================================================
-- Customer:  +970599000001  |  OTP: 123456
-- Craftsman: +970599000002  |  OTP: 123456
-- ============================================================

DO $$
DECLARE
    customer_uuid UUID := gen_random_uuid();
    craftsman_uuid UUID := gen_random_uuid();
    craftsman_profile_uuid UUID := gen_random_uuid();
    existing_customer_id UUID;
    existing_craftsman_id UUID;
BEGIN
    -- Check if demo accounts already exist (idempotent)
    SELECT id INTO existing_customer_id
    FROM auth.users
    WHERE phone = '+970599000001'
    LIMIT 1;

    SELECT id INTO existing_craftsman_id
    FROM auth.users
    WHERE phone = '+970599000002'
    LIMIT 1;

    -- --------------------------------------------------------
    -- Create demo CUSTOMER account (if not exists)
    -- --------------------------------------------------------
    IF existing_customer_id IS NULL THEN
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
            customer_uuid,
            '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated',
            NULL, NULL, NULL,
            '+970599000001', now(),
            now(), now(),
            jsonb_build_object('full_name', 'أحمد الزبون', 'role', 'customer'),
            jsonb_build_object('provider', 'phone', 'providers', ARRAY['phone']::TEXT[]),
            false, false,
            '', null, '', null, '', '', null, '', 0, '', null,
            '', '', null
        );

        -- Create user profile for customer
        INSERT INTO public.user_profiles (
            id, phone, full_name, role, is_active, is_verified, created_at, updated_at
        ) VALUES (
            customer_uuid,
            '+970599000001',
            'أحمد الزبون',
            'customer'::public.user_role,
            true, true,
            now(), now()
        ) ON CONFLICT (id) DO NOTHING;

        -- Create wallet for customer
        INSERT INTO public.wallets (
            user_id, balance, locked_balance, total_earned, updated_at
        ) VALUES (
            customer_uuid, 0, 0, 0, now()
        ) ON CONFLICT (user_id) DO NOTHING;

        RAISE NOTICE 'Demo customer account created: +970599000001';
    ELSE
        customer_uuid := existing_customer_id;
        RAISE NOTICE 'Demo customer account already exists: +970599000001';
    END IF;

    -- --------------------------------------------------------
    -- Create demo CRAFTSMAN account (if not exists)
    -- --------------------------------------------------------
    IF existing_craftsman_id IS NULL THEN
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
            craftsman_uuid,
            '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated',
            NULL, NULL, NULL,
            '+970599000002', now(),
            now(), now(),
            jsonb_build_object('full_name', 'محمد الصنايعي', 'role', 'craftsman'),
            jsonb_build_object('provider', 'phone', 'providers', ARRAY['phone']::TEXT[]),
            false, false,
            '', null, '', null, '', '', null, '', 0, '', null,
            '', '', null
        );

        -- Create user profile for craftsman
        INSERT INTO public.user_profiles (
            id, phone, full_name, role, is_active, is_verified, created_at, updated_at
        ) VALUES (
            craftsman_uuid,
            '+970599000002',
            'محمد الصنايعي',
            'craftsman'::public.user_role,
            true, true,
            now(), now()
        ) ON CONFLICT (id) DO NOTHING;

        -- Create craftsman profile
        INSERT INTO public.craftsman_profiles (
            id, user_id, bio, specialty, experience_years,
            location, service_radius_km, is_online, is_verified,
            rating, total_reviews, completed_jobs, total_clients,
            created_at, updated_at
        ) VALUES (
            craftsman_profile_uuid,
            craftsman_uuid,
            'صنايعي محترف متخصص في الكهرباء والسباكة وأعمال البناء',
            'كهرباء وسباكة',
            8,
            'رام الله، فلسطين',
            15,
            true, true,
            4.8, 24, 47, 38,
            now(), now()
        ) ON CONFLICT (id) DO NOTHING;

        -- Create wallet for craftsman
        INSERT INTO public.wallets (
            user_id, balance, locked_balance, total_earned, updated_at
        ) VALUES (
            craftsman_uuid, 0, 0, 0, now()
        ) ON CONFLICT (user_id) DO NOTHING;

        RAISE NOTICE 'Demo craftsman account created: +970599000002';
    ELSE
        RAISE NOTICE 'Demo craftsman account already exists: +970599000002';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Demo account creation failed: %', SQLERRM;
END $$;
