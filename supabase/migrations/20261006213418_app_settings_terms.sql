-- Migration: app_settings table for terms & conditions management
-- Timestamp: 20261006213418

CREATE TABLE IF NOT EXISTS public.app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_app_settings_key ON public.app_settings(key);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Public read access (terms visible to all users)
DROP POLICY IF EXISTS "public_read_app_settings" ON public.app_settings;
CREATE POLICY "public_read_app_settings"
ON public.app_settings
FOR SELECT
TO public
USING (true);

-- Admin write access using auth metadata
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
)
$$;

DROP POLICY IF EXISTS "admin_manage_app_settings" ON public.app_settings;
CREATE POLICY "admin_manage_app_settings"
ON public.app_settings
FOR ALL
TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

-- Seed default terms & conditions row
DO $$
BEGIN
    INSERT INTO public.app_settings (key, value)
    VALUES ('terms_and_conditions', '')
    ON CONFLICT (key) DO NOTHING;
END $$;
