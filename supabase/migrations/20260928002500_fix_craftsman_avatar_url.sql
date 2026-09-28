-- Fix: Add missing avatar_url column to craftsman_profiles
-- This column is referenced in queries but was missing from the table definition

ALTER TABLE public.craftsman_profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Update existing craftsmen with their avatar URLs from seed data
DO $$
BEGIN
  -- Update craftsman profiles that have avatar URLs stored in user_profiles
  -- or set them from known seed data if they exist
  UPDATE public.craftsman_profiles cp
  SET avatar_url = up.avatar_url
  FROM public.user_profiles up
  WHERE cp.user_id = up.id
    AND cp.avatar_url IS NULL
    AND up.avatar_url IS NOT NULL;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Avatar URL update skipped: %', SQLERRM;
END $$;
