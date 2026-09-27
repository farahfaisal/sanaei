-- ============================================================
-- Recreate demo auth users with correct email/password credentials
-- verifyOtp derives: strip non-digits from phone + @sanaei.app
-- +970599000001 → 970599000001@sanaei.app / 123456
-- +970599000002 → 970599000002@sanaei.app / 123456
-- ============================================================

DO $$
DECLARE
    customer_id UUID;
    craftsman_id UUID;
    new_customer_id UUID := gen_random_uuid();
    new_craftsman_id UUID := gen_random_uuid();
BEGIN
    -- Get existing IDs if accounts exist (by phone)
    SELECT id INTO customer_id FROM auth.users WHERE phone = '+970599000001' LIMIT 1;
    SELECT id INTO craftsman_id FROM auth.users WHERE phone = '+970599000002' LIMIT 1;

    -- --------------------------------------------------------
    -- Handle CUSTOMER account
    -- --------------------------------------------------------
    IF customer_id IS NOT NULL THEN
        -- Update existing account with correct email + password
        UPDATE auth.users
        SET
            email = '970599000001@sanaei.app',
            encrypted_password = crypt('123456', gen_salt('bf', 10)),
            email_confirmed_at = now(),
            confirmation_token = '',
            recovery_token = '',
            aud = 'authenticated',
            role = 'authenticated',
            raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
            updated_at = now()
        WHERE id = customer_id;

        RAISE NOTICE 'Updated demo customer: 970599000001@sanaei.app';
    ELSE
        -- Insert new customer account
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
            new_customer_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated',
            '970599000001@sanaei.app',
            crypt('123456', gen_salt('bf', 10)),
            now(),
            '+970599000001', now(),
            now(), now(),
            jsonb_build_object('full_name', 'أحمد الزبون', 'role', 'customer'),
            jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
            false, false,
            '', null, '', null, '', '', null, '', 0, '', null,
            '', '', null
        );
        customer_id := new_customer_id;

        -- Create user profile
        INSERT INTO public.user_profiles (
            id, phone, full_name, role, is_active, is_verified, created_at, updated_at
        ) VALUES (
            customer_id, '+970599000001', 'أحمد الزبون',
            'customer'::public.user_role, true, true, now(), now()
        ) ON CONFLICT (id) DO NOTHING;

        -- Create wallet
        INSERT INTO public.wallets (user_id, balance, locked_balance, total_earned, updated_at)
        VALUES (customer_id, 0, 0, 0, now())
        ON CONFLICT (user_id) DO NOTHING;

        RAISE NOTICE 'Created demo customer: 970599000001@sanaei.app';
    END IF;

    -- --------------------------------------------------------
    -- Handle CRAFTSMAN account
    -- --------------------------------------------------------
    IF craftsman_id IS NOT NULL THEN
        -- Update existing account with correct email + password
        UPDATE auth.users
        SET
            email = '970599000002@sanaei.app',
            encrypted_password = crypt('123456', gen_salt('bf', 10)),
            email_confirmed_at = now(),
            confirmation_token = '',
            recovery_token = '',
            aud = 'authenticated',
            role = 'authenticated',
            raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
            updated_at = now()
        WHERE id = craftsman_id;

        RAISE NOTICE 'Updated demo craftsman: 970599000002@sanaei.app';
    ELSE
        -- Insert new craftsman account
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
            new_craftsman_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated',
            '970599000002@sanaei.app',
            crypt('123456', gen_salt('bf', 10)),
            now(),
            '+970599000002', now(),
            now(), now(),
            jsonb_build_object('full_name', 'محمد الصنايعي', 'role', 'craftsman'),
            jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
            false, false,
            '', null, '', null, '', '', null, '', 0, '', null,
            '', '', null
        );
        craftsman_id := new_craftsman_id;

        -- Create user profile
        INSERT INTO public.user_profiles (
            id, phone, full_name, role, is_active, is_verified, created_at, updated_at
        ) VALUES (
            craftsman_id, '+970599000002', 'محمد الصنايعي',
            'craftsman'::public.user_role, true, true, now(), now()
        ) ON CONFLICT (id) DO NOTHING;

        -- Create wallet
        INSERT INTO public.wallets (user_id, balance, locked_balance, total_earned, updated_at)
        VALUES (craftsman_id, 0, 0, 0, now())
        ON CONFLICT (user_id) DO NOTHING;

        RAISE NOTICE 'Created demo craftsman: 970599000002@sanaei.app';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Demo account setup failed: %', SQLERRM;
END $$;
