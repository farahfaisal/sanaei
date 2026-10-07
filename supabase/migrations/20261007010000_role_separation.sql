-- ============================================================
-- Role separation & account hardening
--
-- An account is permanently either a customer or a craftsman.
--  * The role is chosen once, at signup, and can never be changed by the user.
--  * Only customers can create orders and reviews; only craftsmen can own a
--    craftsman profile and send quotes.
--  * Users can no longer edit trusted fields (role, verification, ratings,
--    wallet balances) from the client.
-- Changes to these fields are still possible with the service role key
-- (dashboard / backend) and from SECURITY DEFINER functions.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helpers
-- ------------------------------------------------------------

-- Role of the signed-in user (bypasses RLS so it can be used inside policies).
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- True when the statement comes straight from an app user through the API,
-- false for the service role, the dashboard and SECURITY DEFINER functions.
CREATE OR REPLACE FUNCTION public.is_client_request()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT current_user IN ('authenticated', 'anon');
$$;

-- ------------------------------------------------------------
-- 2. Signup: role comes from signup metadata, never 'admin'
-- ------------------------------------------------------------

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

-- ------------------------------------------------------------
-- 3. Protect trusted columns from client-side edits
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_user_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF public.is_client_request() THEN
        IF TG_OP = 'INSERT' THEN
            -- Fallback profile creation from the app: self-service roles only.
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
            NEW.phone := OLD.phone;
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
    IF public.is_client_request() THEN
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
        -- Users may only change their payout account, never money fields.
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

-- ------------------------------------------------------------
-- 4. Role-aware RLS policies
-- ------------------------------------------------------------

-- user_profiles: replace the catch-all policy (it also allowed DELETE).
DROP POLICY IF EXISTS "users_manage_own_profile" ON public.user_profiles;
DROP POLICY IF EXISTS "users_insert_own_profile" ON public.user_profiles;
CREATE POLICY "users_insert_own_profile" ON public.user_profiles
FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "users_update_own_profile" ON public.user_profiles;
CREATE POLICY "users_update_own_profile" ON public.user_profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- craftsman_profiles: only craftsman accounts can own one.
DROP POLICY IF EXISTS "craftsmen_manage_own_profile" ON public.craftsman_profiles;
CREATE POLICY "craftsmen_manage_own_profile" ON public.craftsman_profiles
FOR ALL TO authenticated
USING (user_id = auth.uid() AND public.current_user_role() = 'craftsman')
WITH CHECK (user_id = auth.uid() AND public.current_user_role() = 'craftsman');

-- orders: only customer accounts can place orders.
DROP POLICY IF EXISTS "customers_create_orders" ON public.orders;
CREATE POLICY "customers_create_orders" ON public.orders
FOR INSERT TO authenticated
WITH CHECK (customer_id = auth.uid() AND public.current_user_role() = 'customer');

-- reviews: only customers, and only for their own completed orders.
DROP POLICY IF EXISTS "customers_create_reviews" ON public.reviews;
CREATE POLICY "customers_create_reviews" ON public.reviews
FOR INSERT TO authenticated
WITH CHECK (
    customer_id = auth.uid()
    AND public.current_user_role() = 'customer'
    AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_id
          AND o.customer_id = auth.uid()
          AND o.craftsman_id = reviews.craftsman_id
          AND o.status = 'completed'
    )
);

-- price_quotes: only craftsman accounts.
DROP POLICY IF EXISTS "craftsmen_create_quotes" ON public.price_quotes;
CREATE POLICY "craftsmen_create_quotes" ON public.price_quotes
FOR INSERT TO authenticated
WITH CHECK (
    public.current_user_role() = 'craftsman'
    AND craftsman_id IN (SELECT id FROM public.craftsman_profiles WHERE user_id = auth.uid())
);

-- wallets: read own; update own (balances protected by trigger); no client insert/delete.
DROP POLICY IF EXISTS "users_manage_own_wallet" ON public.wallets;
DROP POLICY IF EXISTS "users_update_own_wallet" ON public.wallets;
CREATE POLICY "users_update_own_wallet" ON public.wallets
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
