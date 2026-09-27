-- ============================================================
-- Add craftsman علي with online/available status
-- Phone: +970599000003  |  Email: 970599000003@sanaei.app  |  Password: 123456
-- ============================================================

DO $$
DECLARE
    ali_auth_id UUID;
    ali_profile_id UUID;
    new_ali_id UUID := gen_random_uuid();
    new_ali_profile_id UUID := gen_random_uuid();
BEGIN
    -- Check if علي already exists by phone
    SELECT id INTO ali_auth_id
    FROM auth.users
    WHERE phone = '+970599000003'
    LIMIT 1;

    -- --------------------------------------------------------
    -- Create auth user for علي (if not exists)
    -- --------------------------------------------------------
    IF ali_auth_id IS NULL THEN
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
            new_ali_id,
            '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated',
            '970599000003@sanaei.app',
            crypt('123456', gen_salt('bf', 10)),
            now(),
            '+970599000003', now(),
            now(), now(),
            jsonb_build_object('full_name', 'علي', 'role', 'craftsman'),
            jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
            false, false,
            '', null, '', null, '', '', null, '', 0, '', null,
            '', '', null
        );
        ali_auth_id := new_ali_id;
        RAISE NOTICE 'Created auth user for علي: %', ali_auth_id;
    ELSE
        RAISE NOTICE 'Auth user for علي already exists: %', ali_auth_id;
    END IF;

    -- --------------------------------------------------------
    -- Create user_profile for علي (if not exists)
    -- --------------------------------------------------------
    INSERT INTO public.user_profiles (
        id, phone, full_name, role, is_active, is_verified, created_at, updated_at
    ) VALUES (
        ali_auth_id,
        '+970599000003',
        'علي',
        'craftsman'::public.user_role,
        true,
        true,
        now(),
        now()
    ) ON CONFLICT (id) DO UPDATE SET
        full_name = 'علي',
        role = 'craftsman'::public.user_role,
        is_active = true,
        is_verified = true,
        updated_at = now();

    -- --------------------------------------------------------
    -- Create craftsman_profile for علي with is_online = true
    -- --------------------------------------------------------
    -- Check if craftsman profile already exists
    SELECT id INTO ali_profile_id
    FROM public.craftsman_profiles
    WHERE user_id = ali_auth_id
    LIMIT 1;

    IF ali_profile_id IS NULL THEN
        INSERT INTO public.craftsman_profiles (
            id,
            user_id,
            bio,
            specialty,
            experience_years,
            location,
            service_radius_km,
            is_online,
            is_verified,
            rating,
            total_reviews,
            completed_jobs,
            total_clients,
            created_at,
            updated_at
        ) VALUES (
            new_ali_profile_id,
            ali_auth_id,
            'صنايعي محترف متاح للخدمة',
            'كهرباء وسباكة',
            5,
            'رام الله',
            15,
            true,
            true,
            4.8,
            12,
            25,
            20,
            now(),
            now()
        );
        ali_profile_id := new_ali_profile_id;
        RAISE NOTICE 'Created craftsman profile for علي: %', ali_profile_id;
    ELSE
        -- Update existing profile to be online
        UPDATE public.craftsman_profiles
        SET
            is_online = true,
            is_verified = true,
            updated_at = now()
        WHERE id = ali_profile_id;
        RAISE NOTICE 'Updated craftsman profile for علي to online: %', ali_profile_id;
    END IF;

    -- --------------------------------------------------------
    -- Create wallet for علي (if not exists)
    -- --------------------------------------------------------
    INSERT INTO public.wallets (user_id, balance, locked_balance, total_earned, updated_at)
    VALUES (ali_auth_id, 0, 0, 0, now())
    ON CONFLICT (user_id) DO NOTHING;

    RAISE NOTICE 'Craftsman علي setup complete. Login: 970599000003@sanaei.app / 123456';

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Setup for علي failed: %', SQLERRM;
END $$;
