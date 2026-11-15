-- ============================================================
-- Craftsman accounts always have a craftsman profile
--
-- Some craftsman accounts were created without a row in craftsman_profiles
-- (the signup skipped the registration form), so they never appeared in the
-- craftsmen lists. Now:
-- 1. Every craftsman account gets a craftsman profile automatically.
-- 2. Existing craftsmen without one get it now.
-- 3. complete_my_profile(): the app's "complete your account" form saves the
--    name, area, specialty and services in one step.
-- ============================================================

BEGIN;

-- One craftsman profile per account (keep the oldest if there are duplicates).
DELETE FROM public.craftsman_profiles cp
USING public.craftsman_profiles older
WHERE cp.user_id = older.user_id
  AND (older.created_at, older.id) < (cp.created_at, cp.id);

CREATE UNIQUE INDEX IF NOT EXISTS craftsman_profiles_user_id_key
    ON public.craftsman_profiles (user_id);

-- 1. Automatic profile ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_craftsman_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.role = 'craftsman' THEN
        INSERT INTO craftsman_profiles (user_id, location)
        VALUES (NEW.id, NULLIF(trim(NEW.location), ''))
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_craftsman_profile ON public.user_profiles;
CREATE TRIGGER ensure_craftsman_profile
    AFTER INSERT OR UPDATE OF role ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.ensure_craftsman_profile();

-- 2. Backfill ------------------------------------------------------------
INSERT INTO public.craftsman_profiles (user_id, location)
SELECT up.id, NULLIF(trim(up.location), '')
FROM public.user_profiles up
WHERE up.role = 'craftsman'
  AND NOT EXISTS (SELECT 1 FROM public.craftsman_profiles cp WHERE cp.user_id = up.id);

-- Specialties were saved as English keys ("electrical"); searches match the
-- Arabic service names, so store the Arabic label.
UPDATE public.craftsman_profiles
SET specialty = CASE specialty
    WHEN 'plumbing'   THEN 'سباكة'
    WHEN 'electrical' THEN 'كهرباء'
    WHEN 'carpentry'  THEN 'نجارة'
    WHEN 'painting'   THEN 'دهانات'
    WHEN 'ac'         THEN 'تكييف'
    WHEN 'cleaning'   THEN 'تنظيف'
    WHEN 'masonry'    THEN 'بناء وتشطيب'
END
WHERE specialty IN ('plumbing', 'electrical', 'carpentry', 'painting', 'ac', 'cleaning', 'masonry');

-- 3. Complete the account from the app ----------------------------------
CREATE OR REPLACE FUNCTION public.complete_my_profile(
    p_full_name TEXT,
    p_location TEXT DEFAULT NULL,
    p_specialty TEXT DEFAULT NULL,
    p_bio TEXT DEFAULT NULL,
    p_experience_years INT DEFAULT NULL,
    p_service_area TEXT DEFAULT NULL,
    p_service_radius_km INT DEFAULT NULL,
    p_category_id UUID DEFAULT NULL,
    p_services TEXT[] DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_role TEXT;
    v_cp_id UUID;
    v_service TEXT;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'يجب تسجيل الدخول' USING ERRCODE = '42501';
    END IF;
    IF length(trim(COALESCE(p_full_name, ''))) < 2 THEN
        RAISE EXCEPTION 'يرجى إدخال الاسم الكامل' USING ERRCODE = '22023';
    END IF;

    SELECT role::text INTO v_role FROM user_profiles WHERE id = v_uid;
    IF v_role IS NULL THEN
        RAISE EXCEPTION 'الحساب غير موجود' USING ERRCODE = 'P0002';
    END IF;

    UPDATE user_profiles
    SET full_name = trim(p_full_name),
        location = COALESCE(NULLIF(trim(p_location), ''), location),
        updated_at = NOW()
    WHERE id = v_uid;

    IF v_role <> 'craftsman' THEN
        RETURN;
    END IF;

    IF length(trim(COALESCE(p_specialty, ''))) < 2 THEN
        RAISE EXCEPTION 'يرجى اختيار التخصص' USING ERRCODE = '22023';
    END IF;

    INSERT INTO craftsman_profiles (user_id) VALUES (v_uid)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE craftsman_profiles
    SET specialty = trim(p_specialty),
        bio = COALESCE(NULLIF(trim(p_bio), ''), bio),
        experience_years = COALESCE(GREATEST(p_experience_years, 0), experience_years),
        location = COALESCE(NULLIF(trim(p_service_area), ''), NULLIF(trim(p_location), ''), location),
        service_radius_km = COALESCE(NULLIF(p_service_radius_km, 0), service_radius_km),
        updated_at = NOW()
    WHERE user_id = v_uid
    RETURNING id INTO v_cp_id;

    IF p_services IS NOT NULL THEN
        FOREACH v_service IN ARRAY p_services LOOP
            IF length(trim(COALESCE(v_service, ''))) >= 2
               AND NOT EXISTS (SELECT 1 FROM craftsman_services
                               WHERE craftsman_id = v_cp_id AND name = trim(v_service)) THEN
                INSERT INTO craftsman_services (craftsman_id, name, category_id, emoji)
                VALUES (v_cp_id, trim(v_service), p_category_id, '🔧');
            END IF;
        END LOOP;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_my_profile(TEXT, TEXT, TEXT, TEXT, INT, TEXT, INT, UUID, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_my_profile(TEXT, TEXT, TEXT, TEXT, INT, TEXT, INT, UUID, TEXT[]) TO authenticated;

COMMIT;
