-- ============================================================
-- Move seeded craftsman/user locations from Riyadh to Ramallah.
-- Location format: "lat,lng" (parsed by parseLocation()).
-- Ramallah center: 31.9038, 35.2034
-- ============================================================

UPDATE public.user_profiles
SET location = '31.9038,35.2034', updated_at = now()
WHERE location = '24.7136,46.6753';

UPDATE public.craftsman_profiles
SET location = '31.9038,35.2034', updated_at = now()
WHERE location = '24.7136,46.6753';

-- Human-readable Riyadh labels (non-coordinate) -> Ramallah
UPDATE public.craftsman_profiles
SET location = REPLACE(location, 'الرياض', 'رام الله')
WHERE location LIKE '%الرياض%';
