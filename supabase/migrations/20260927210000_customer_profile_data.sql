-- Customer Profile: Saved Addresses & Payment Methods
-- Migration: 20260927210000_customer_profile_data.sql

-- ── SAVED ADDRESSES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.saved_addresses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  label         TEXT NOT NULL DEFAULT 'المنزل',
  address_line  TEXT NOT NULL,
  city          TEXT,
  is_default    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_addresses_user_id ON public.saved_addresses(user_id);

ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_saved_addresses" ON public.saved_addresses;
CREATE POLICY "users_manage_own_saved_addresses"
  ON public.saved_addresses
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── PAYMENT METHODS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  method_type   TEXT NOT NULL DEFAULT 'card',
  label         TEXT NOT NULL,
  last_four     TEXT,
  expiry_month  INTEGER,
  expiry_year   INTEGER,
  is_default    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON public.payment_methods(user_id);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_payment_methods" ON public.payment_methods;
CREATE POLICY "users_manage_own_payment_methods"
  ON public.payment_methods
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
