-- ============================================================
-- Fix demo account emails to match phone-derived format used by verifyOtp
-- verifyOtp strips non-digits from phone and appends @sanaei.app
-- +970599000001 → 970599000001@sanaei.app
-- +970599000002 → 970599000002@sanaei.app
-- ============================================================

DO $$
BEGIN
    -- Fix demo customer email: customer@sanaei.app → 970599000001@sanaei.app
    UPDATE auth.users
    SET
        email = '970599000001@sanaei.app',
        encrypted_password = crypt('123456', gen_salt('bf', 10)),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
        updated_at = now()
    WHERE phone = '+970599000001';

    -- Fix demo craftsman email: craftsman@sanaei.app → 970599000002@sanaei.app
    UPDATE auth.users
    SET
        email = '970599000002@sanaei.app',
        encrypted_password = crypt('123456', gen_salt('bf', 10)),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
        updated_at = now()
    WHERE phone = '+970599000002';

    RAISE NOTICE 'Demo account emails updated to phone-derived format';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Demo account email fix failed: %', SQLERRM;
END $$;
