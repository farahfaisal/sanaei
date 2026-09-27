-- ============================================================
-- Add email + password credentials to demo accounts
-- so they can log in via email/password (phone provider not enabled)
-- Customer:  +970599000001  →  customer@sanaei.app / 123456
-- Craftsman: +970599000002  →  craftsman@sanaei.app / 123456
-- ============================================================

DO $$
BEGIN
    -- Update demo customer: add email + password
    UPDATE auth.users
    SET
        email = 'customer@sanaei.app',
        encrypted_password = crypt('123456', gen_salt('bf', 10)),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
        updated_at = now()
    WHERE phone = '+970599000001'
      AND (email IS NULL OR email = '');

    -- Update demo craftsman: add email + password
    UPDATE auth.users
    SET
        email = 'craftsman@sanaei.app',
        encrypted_password = crypt('123456', gen_salt('bf', 10)),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
        updated_at = now()
    WHERE phone = '+970599000002'
      AND (email IS NULL OR email = '');

    RAISE NOTICE 'Demo accounts updated with email/password credentials';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Demo account update failed: %', SQLERRM;
END $$;
