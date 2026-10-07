-- ============================================================
-- Fix RLS INSERT policy on user_profiles
-- Timestamp: 20261007002200
-- Issue: "new row violates row-level security policy for table user_profiles"
-- Root cause: FOR ALL policy USING clause does not cover INSERT.
--             Need explicit INSERT policy + service_role bypass for trigger.
-- ============================================================

-- Drop the existing combined policy and replace with explicit per-operation policies
DROP POLICY IF EXISTS "users_manage_own_profile" ON public.user_profiles;

-- SELECT: authenticated users can read their own profile
DROP POLICY IF EXISTS "users_select_own_profile" ON public.user_profiles;
CREATE POLICY "users_select_own_profile" ON public.user_profiles
FOR SELECT TO authenticated
USING (id = auth.uid());

-- INSERT: authenticated users can insert their own profile row
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.user_profiles;
CREATE POLICY "users_insert_own_profile" ON public.user_profiles
FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

-- UPDATE: authenticated users can update their own profile
DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
CREATE POLICY "users_update_own_profile" ON public.user_profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- DELETE: authenticated users can delete their own profile
DROP POLICY IF EXISTS "users_delete_own_profile" ON public.user_profiles;
CREATE POLICY "users_delete_own_profile" ON public.user_profiles
FOR DELETE TO authenticated
USING (id = auth.uid());

-- Service role bypass: allows the handle_new_user trigger (SECURITY DEFINER) and
-- any server-side operations to insert/manage profiles without RLS restrictions
DROP POLICY IF EXISTS "service_role_manage_user_profiles" ON public.user_profiles;
CREATE POLICY "service_role_manage_user_profiles" ON public.user_profiles
FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Keep the existing view-all policy for authenticated users (needed for craftsman/customer lookups)
-- (already exists as "users_view_all_profiles", no change needed)
