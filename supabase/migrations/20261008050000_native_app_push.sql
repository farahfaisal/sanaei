-- ============================================================
-- Android / iOS app (Capacitor): phone push tokens
--
-- A phone has one FCM token. When someone signs in with another account on
-- the same phone, the token moves to that account — otherwise the previous
-- account's notifications would keep arriving on this phone.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.register_fcm_token(p_token TEXT, p_platform TEXT DEFAULT 'android')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'يجب تسجيل الدخول' USING ERRCODE = '42501';
    END IF;
    IF p_token IS NULL OR length(p_token) < 20 OR length(p_token) > 4096 THEN
        RAISE EXCEPTION 'رمز غير صالح' USING ERRCODE = '22023';
    END IF;

    DELETE FROM fcm_tokens WHERE token = p_token AND user_id <> auth.uid();

    INSERT INTO fcm_tokens (user_id, token, platform, updated_at)
    VALUES (
        auth.uid(),
        p_token,
        CASE WHEN p_platform IN ('android', 'ios', 'web') THEN p_platform ELSE 'android' END,
        NOW()
    )
    ON CONFLICT (user_id, token)
    DO UPDATE SET platform = EXCLUDED.platform, updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.unregister_fcm_token(p_token TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    DELETE FROM fcm_tokens WHERE token = p_token AND user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.register_fcm_token(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unregister_fcm_token(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_fcm_token(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_fcm_token(TEXT) TO authenticated;

COMMIT;
