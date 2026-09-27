-- ============================================================
-- Update craftsman علي location to Riyadh coordinates
-- Location format: "lat,lng" required by parseLocation()
-- Riyadh center: 24.7136, 46.6753
-- ============================================================

DO $$
DECLARE
    ali_auth_id UUID;
    ali_profile_id UUID;
BEGIN
    -- Find علي by phone
    SELECT id INTO ali_auth_id
    FROM auth.users
    WHERE phone = '+970599000003'
    LIMIT 1;

    IF ali_auth_id IS NULL THEN
        -- Try by email
        SELECT id INTO ali_auth_id
        FROM auth.users
        WHERE email = '970599000003@sanaei.app'
        LIMIT 1;
    END IF;

    IF ali_auth_id IS NULL THEN
        RAISE NOTICE 'Craftsman علي not found in auth.users. Run previous migration first.';
        RETURN;
    END IF;

    -- Update user_profiles location to Riyadh coordinates
    UPDATE public.user_profiles
    SET
        location = '24.7136,46.6753',
        updated_at = now()
    WHERE id = ali_auth_id;

    -- Update craftsman_profiles location to Riyadh coordinates
    -- Also ensure is_online = true so he appears on the map
    UPDATE public.craftsman_profiles
    SET
        location = '24.7136,46.6753',
        is_online = true,
        is_verified = true,
        updated_at = now()
    WHERE user_id = ali_auth_id;

    GET DIAGNOSTICS ali_profile_id = ROW_COUNT;
    RAISE NOTICE 'Updated craftsman علي location to Riyadh (24.7136, 46.6753). Rows updated: %', ali_profile_id;

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Failed to update craftsman علي location: %', SQLERRM;
END $$;
