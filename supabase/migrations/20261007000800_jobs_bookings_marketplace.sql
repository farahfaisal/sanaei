-- ============================================================
-- SANAEI APP — Jobs & Bookings Marketplace Enhancement
-- Timestamp: 20261007000800
-- Adds: service_type, location coords to orders (jobs)
--       bookings table for craftsman-customer matches
-- ============================================================

-- ============================================================
-- 1. ENHANCE ORDERS TABLE (Jobs)
-- Add service_type, city, latitude, longitude columns
-- ============================================================

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS service_type TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS urgency TEXT NOT NULL DEFAULT 'normal'
    CHECK (urgency IN ('normal', 'urgent', 'scheduled')),
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL;

-- ============================================================
-- 2. BOOKINGS TABLE (Craftsman-Customer Matches)
-- Formal booking record created when craftsman accepts a job
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    craftsman_id UUID NOT NULL REFERENCES public.craftsman_profiles(id) ON DELETE CASCADE,
    -- Booking lifecycle
    booking_status TEXT NOT NULL DEFAULT 'confirmed'
        CHECK (booking_status IN ('confirmed', 'craftsman_arrived', 'work_started', 'work_completed', 'cancelled')),
    -- Scheduling
    scheduled_date DATE,
    scheduled_time_slot TEXT,
    -- Location snapshot at booking time
    service_address TEXT,
    service_city TEXT,
    service_latitude NUMERIC(10, 7),
    service_longitude NUMERIC(10, 7),
    -- Service details snapshot
    service_type TEXT,
    service_description TEXT,
    -- Pricing
    agreed_amount NUMERIC(10, 2),
    -- Timestamps
    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    craftsman_arrived_at TIMESTAMPTZ,
    work_started_at TIMESTAMPTZ,
    work_completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_orders_service_type ON public.orders(service_type);
CREATE INDEX IF NOT EXISTS idx_orders_city ON public.orders(city);
CREATE INDEX IF NOT EXISTS idx_orders_category_id ON public.orders(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_location ON public.orders(latitude, longitude) WHERE latitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_order_id ON public.bookings(order_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON public.bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_craftsman_id ON public.bookings(craftsman_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(booking_status);
CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_date ON public.bookings(scheduled_date);

-- ============================================================
-- 4. UPDATED_AT TRIGGER FOR BOOKINGS
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_bookings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON public.bookings;
CREATE TRIGGER trg_bookings_updated_at
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_bookings_updated_at();

-- ============================================================
-- 5. FUNCTION: Create booking when order is accepted
-- Automatically creates a booking record when order status
-- changes to 'accepted'
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_order_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_craftsman_profile_id UUID;
BEGIN
    -- Only trigger when status changes to 'accepted'
    IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
        -- Get craftsman profile id (orders.craftsman_id references craftsman_profiles.id)
        v_craftsman_profile_id := NEW.craftsman_id;

        -- Create booking record if not already exists for this order
        INSERT INTO public.bookings (
            order_id,
            customer_id,
            craftsman_id,
            booking_status,
            service_address,
            service_city,
            service_latitude,
            service_longitude,
            service_type,
            service_description,
            agreed_amount,
            confirmed_at
        )
        SELECT
            NEW.id,
            NEW.customer_id,
            v_craftsman_profile_id,
            'confirmed',
            NEW.address,
            NEW.city,
            NEW.latitude,
            NEW.longitude,
            COALESCE(NEW.service_type, NEW.description),
            NEW.description,
            NEW.amount,
            NOW()
        WHERE NOT EXISTS (
            SELECT 1 FROM public.bookings WHERE order_id = NEW.id
        );
    END IF;

    -- Sync booking_status with order status progression
    IF NEW.status = 'in_progress' AND OLD.status = 'accepted' THEN
        UPDATE public.bookings
        SET booking_status = 'work_started',
            work_started_at = NOW()
        WHERE order_id = NEW.id AND booking_status = 'confirmed';
    END IF;

    IF NEW.status = 'completed' AND OLD.status = 'in_progress' THEN
        UPDATE public.bookings
        SET booking_status = 'work_completed',
            work_completed_at = NOW()
        WHERE order_id = NEW.id AND booking_status = 'work_started';
    END IF;

    IF NEW.status = 'cancelled' THEN
        UPDATE public.bookings
        SET booking_status = 'cancelled',
            cancelled_at = NOW()
        WHERE order_id = NEW.id AND booking_status NOT IN ('work_completed', 'cancelled');
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_accepted_create_booking ON public.orders;
CREATE TRIGGER trg_order_accepted_create_booking
    AFTER UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_order_accepted();

-- ============================================================
-- 6. ENABLE RLS ON BOOKINGS
-- ============================================================

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLS POLICIES FOR BOOKINGS
-- ============================================================

-- Customers can view their own bookings
DROP POLICY IF EXISTS "customers_view_own_bookings" ON public.bookings;
CREATE POLICY "customers_view_own_bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (customer_id = auth.uid());

-- Craftsmen can view bookings assigned to them
DROP POLICY IF EXISTS "craftsmen_view_own_bookings" ON public.bookings;
CREATE POLICY "craftsmen_view_own_bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (
    craftsman_id IN (
        SELECT id FROM public.craftsman_profiles WHERE user_id = auth.uid()
    )
);

-- Craftsmen can update booking status (arrival, work start, etc.)
DROP POLICY IF EXISTS "craftsmen_update_own_bookings" ON public.bookings;
CREATE POLICY "craftsmen_update_own_bookings"
ON public.bookings
FOR UPDATE
TO authenticated
USING (
    craftsman_id IN (
        SELECT id FROM public.craftsman_profiles WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    craftsman_id IN (
        SELECT id FROM public.craftsman_profiles WHERE user_id = auth.uid()
    )
);

-- System (trigger) can insert bookings — allow authenticated users to insert
-- (the trigger runs as SECURITY DEFINER so this covers trigger-created bookings)
DROP POLICY IF EXISTS "system_insert_bookings" ON public.bookings;
CREATE POLICY "system_insert_bookings"
ON public.bookings
FOR INSERT
TO authenticated
WITH CHECK (
    customer_id = auth.uid()
    OR craftsman_id IN (
        SELECT id FROM public.craftsman_profiles WHERE user_id = auth.uid()
    )
);

-- Admin full access
DROP POLICY IF EXISTS "admin_full_access_bookings" ON public.bookings;
CREATE POLICY "admin_full_access_bookings"
ON public.bookings
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND role = 'admin'
    )
);

-- ============================================================
-- 8. MARKETPLACE VIEW: Active Jobs (open orders seeking craftsmen)
-- ============================================================

CREATE OR REPLACE VIEW public.marketplace_jobs AS
SELECT
    o.id,
    o.customer_id,
    up.full_name AS customer_name,
    up.avatar_url AS customer_avatar,
    o.service_type,
    o.description,
    o.address,
    o.city,
    o.latitude,
    o.longitude,
    o.urgency,
    o.amount,
    o.payment_method,
    o.scheduled_at,
    o.service_images,
    o.status,
    o.created_at,
    sc.name AS category_name,
    sc.emoji AS category_emoji
FROM public.orders o
JOIN public.user_profiles up ON o.customer_id = up.id
LEFT JOIN public.service_categories sc ON o.category_id = sc.id
WHERE o.status = 'pending';

-- ============================================================
-- 9. MARKETPLACE VIEW: Confirmed Bookings with full details
-- ============================================================

CREATE OR REPLACE VIEW public.marketplace_bookings AS
SELECT
    b.id,
    b.order_id,
    b.booking_status,
    b.scheduled_date,
    b.scheduled_time_slot,
    b.service_address,
    b.service_city,
    b.service_latitude,
    b.service_longitude,
    b.service_type,
    b.service_description,
    b.agreed_amount,
    b.confirmed_at,
    b.craftsman_arrived_at,
    b.work_started_at,
    b.work_completed_at,
    b.cancelled_at,
    b.created_at,
    -- Customer info
    b.customer_id,
    cup.full_name AS customer_name,
    cup.avatar_url AS customer_avatar,
    cup.phone AS customer_phone,
    -- Craftsman info
    b.craftsman_id,
    crup.full_name AS craftsman_name,
    cp.avatar_url AS craftsman_avatar,
    cp.rating AS craftsman_rating,
    cp.specialty AS craftsman_specialty,
    crup.phone AS craftsman_phone
FROM public.bookings b
JOIN public.user_profiles cup ON b.customer_id = cup.id
JOIN public.craftsman_profiles cp ON b.craftsman_id = cp.id
JOIN public.user_profiles crup ON cp.user_id = crup.id;
