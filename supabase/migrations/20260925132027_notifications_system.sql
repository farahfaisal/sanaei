-- ============================================================
-- Notifications System Migration
-- ============================================================

-- 1. push_subscriptions table (stores Web Push endpoint per user)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- 2. notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

-- 4. Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "users_manage_own_notifications" ON public.notifications;
CREATE POLICY "users_manage_own_notifications"
  ON public.notifications FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "users_manage_own_push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "users_manage_own_push_subscriptions"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow service role to insert notifications (for triggers/edge functions)
DROP POLICY IF EXISTS "service_role_insert_notifications" ON public.notifications;
CREATE POLICY "service_role_insert_notifications"
  ON public.notifications FOR INSERT TO service_role
  WITH CHECK (true);

-- 6. Function: notify craftsman on new order
CREATE OR REPLACE FUNCTION public.notify_craftsman_new_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  craftsman_user_id UUID;
  customer_name TEXT;
BEGIN
  -- Get craftsman user_id from craftsman_profiles
  SELECT user_id INTO craftsman_user_id
  FROM public.craftsman_profiles
  WHERE id = NEW.craftsman_id
  LIMIT 1;

  -- Get customer name
  SELECT full_name INTO customer_name
  FROM public.user_profiles
  WHERE id = NEW.customer_id
  LIMIT 1;

  IF craftsman_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, order_id)
    VALUES (
      craftsman_user_id,
      'طلب جديد 🔔',
      COALESCE('لديك طلب جديد من ' || customer_name, 'لديك طلب خدمة جديد'),
      'new_order',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 7. Function: notify customer on order status change
CREATE OR REPLACE FUNCTION public.notify_customer_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  status_label TEXT;
BEGIN
  -- Only fire when status actually changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'accepted'    THEN status_label := 'تم قبول طلبك ✅';
    WHEN 'in_progress' THEN status_label := 'الصنايعي في الطريق إليك 🚗';
    WHEN 'completed'   THEN status_label := 'تم إنجاز طلبك بنجاح 🎉';
    WHEN 'cancelled'   THEN status_label := 'تم إلغاء طلبك ❌';
    ELSE status_label := 'تم تحديث حالة طلبك';
  END CASE;

  INSERT INTO public.notifications (user_id, title, body, type, order_id)
  VALUES (
    NEW.customer_id,
    'تحديث الطلب',
    status_label,
    'order_status',
    NEW.id
  );

  RETURN NEW;
END;
$$;

-- 8. Triggers
DROP TRIGGER IF EXISTS on_new_order_notify_craftsman ON public.orders;
CREATE TRIGGER on_new_order_notify_craftsman
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_craftsman_new_order();

DROP TRIGGER IF EXISTS on_order_status_change_notify_customer ON public.orders;
CREATE TRIGGER on_order_status_change_notify_customer
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_customer_order_status();
