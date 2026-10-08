-- ============================================================
-- Admin dashboard: access rules
--
-- 1. Close privilege-escalation holes: nobody can make themselves an admin
--    (not at signup, not by editing their own profile).
-- 2. Lock trusted fields (role, active, verified, ratings, wallet balances)
--    against edits from the app; admins and the server are still allowed.
-- 3. Give admins the access the dashboard needs (verify/suspend users and
--    craftsmen, see payments, send broadcasts) and make offers admin-only.
-- ============================================================

BEGIN;

-- Helpers ------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid() AND up.role = 'admin' AND up.is_active
    );
$$;

-- True for statements sent by app users through the API; false for the
-- SQL editor, the service role and SECURITY DEFINER functions.
CREATE OR REPLACE FUNCTION public.is_client_request()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
    SELECT current_user IN ('authenticated', 'anon');
$$;

-- 1. Signup can only create customers or craftsmen -----------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    requested_role TEXT := NEW.raw_user_meta_data->>'role';
BEGIN
    INSERT INTO public.user_profiles (id, phone, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone'),
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        CASE WHEN requested_role = 'craftsman'
             THEN 'craftsman'::public.user_role
             ELSE 'customer'::public.user_role
        END
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

-- 2. Trusted fields ----------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_user_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF public.is_client_request() AND NOT public.is_admin_user() THEN
        IF TG_OP = 'INSERT' THEN
            IF NEW.role NOT IN ('customer', 'craftsman') THEN
                RAISE EXCEPTION 'Invalid role' USING ERRCODE = '42501';
            END IF;
            NEW.is_verified := false;
            NEW.is_active := true;
        ELSE
            IF NEW.role IS DISTINCT FROM OLD.role THEN
                RAISE EXCEPTION 'Account type cannot be changed' USING ERRCODE = '42501';
            END IF;
            NEW.is_verified := OLD.is_verified;
            NEW.is_active := OLD.is_active;
        END IF;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_user_profile_fields ON public.user_profiles;
CREATE TRIGGER protect_user_profile_fields
    BEFORE INSERT OR UPDATE ON public.user_profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_user_profile_fields();

CREATE OR REPLACE FUNCTION public.protect_craftsman_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF public.is_client_request() AND NOT public.is_admin_user() THEN
        IF TG_OP = 'INSERT' THEN
            NEW.is_verified := false;
            NEW.rating := 0;
            NEW.total_reviews := 0;
            NEW.completed_jobs := 0;
            NEW.total_clients := 0;
        ELSE
            NEW.user_id := OLD.user_id;
            NEW.is_verified := OLD.is_verified;
            NEW.rating := OLD.rating;
            NEW.total_reviews := OLD.total_reviews;
            NEW.completed_jobs := OLD.completed_jobs;
            NEW.total_clients := OLD.total_clients;
        END IF;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_craftsman_profile_fields ON public.craftsman_profiles;
CREATE TRIGGER protect_craftsman_profile_fields
    BEFORE INSERT OR UPDATE ON public.craftsman_profiles
    FOR EACH ROW EXECUTE FUNCTION public.protect_craftsman_profile_fields();

CREATE OR REPLACE FUNCTION public.protect_wallet_balances()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF public.is_client_request() THEN
        -- From the app, only the payout account can change — never money.
        NEW.user_id := OLD.user_id;
        NEW.balance := OLD.balance;
        NEW.locked_balance := OLD.locked_balance;
        NEW.total_earned := OLD.total_earned;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_wallet_balances ON public.wallets;
CREATE TRIGGER protect_wallet_balances
    BEFORE UPDATE ON public.wallets
    FOR EACH ROW EXECUTE FUNCTION public.protect_wallet_balances();

-- Users could create/delete wallets for themselves; only read + update now.
DROP POLICY IF EXISTS "users_manage_own_wallet" ON public.wallets;
DROP POLICY IF EXISTS "users_update_own_wallet" ON public.wallets;
CREATE POLICY "users_update_own_wallet" ON public.wallets
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 3. Admin access for the dashboard -------------------------------

DROP POLICY IF EXISTS "admin_update_user_profiles" ON public.user_profiles;
CREATE POLICY "admin_update_user_profiles" ON public.user_profiles
FOR UPDATE TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "admin_update_craftsman_profiles" ON public.craftsman_profiles;
CREATE POLICY "admin_update_craftsman_profiles" ON public.craftsman_profiles
FOR UPDATE TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "admin_read_wallets" ON public.wallets;
CREATE POLICY "admin_read_wallets" ON public.wallets
FOR SELECT TO authenticated
USING (public.is_admin_user());

DROP POLICY IF EXISTS "admin_read_wallet_transactions" ON public.wallet_transactions;
CREATE POLICY "admin_read_wallet_transactions" ON public.wallet_transactions
FOR SELECT TO authenticated
USING (public.is_admin_user());

DROP POLICY IF EXISTS "admin_read_push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "admin_read_push_subscriptions" ON public.push_subscriptions
FOR SELECT TO authenticated
USING (public.is_admin_user());

DROP POLICY IF EXISTS "admin_insert_notifications" ON public.notifications;
CREATE POLICY "admin_insert_notifications" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (public.is_admin_user());

-- Offers were editable by ANY signed-in user; now admins only.
DROP POLICY IF EXISTS "admin_manage_promotional_offers" ON public.promotional_offers;
CREATE POLICY "admin_manage_promotional_offers" ON public.promotional_offers
FOR ALL TO authenticated
USING (public.is_admin_user())
WITH CHECK (public.is_admin_user());

COMMIT;
