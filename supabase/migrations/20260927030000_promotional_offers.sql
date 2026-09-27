-- Migration: Add promotional_offers table
-- Timestamp: 20260927030000

CREATE TABLE IF NOT EXISTS public.promotional_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  discount_percent INTEGER,
  image_url TEXT,
  badge_text TEXT,
  button_text TEXT DEFAULT 'اكتشف العرض',
  bg_color_from TEXT DEFAULT '#1B5E20',
  bg_color_to TEXT DEFAULT '#2E7D32',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promotional_offers_active ON public.promotional_offers(is_active, sort_order);

ALTER TABLE public.promotional_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_promotional_offers" ON public.promotional_offers;
CREATE POLICY "public_read_promotional_offers"
  ON public.promotional_offers
  FOR SELECT
  TO public
  USING (is_active = true);

DROP POLICY IF EXISTS "admin_manage_promotional_offers" ON public.promotional_offers;
CREATE POLICY "admin_manage_promotional_offers"
  ON public.promotional_offers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed with initial offers
DO $$
BEGIN
  INSERT INTO public.promotional_offers (title, description, discount_percent, image_url, badge_text, button_text, bg_color_from, bg_color_to, is_active, sort_order)
  VALUES
    (
      'خصم 20% على خدمات التكييف',
      'احصل على خصم حصري على جميع خدمات تركيب وصيانة التكييف',
      20,
      'https://img.rocket.new/generatedImages/rocket_gen_img_1122596dd-1785829864899.png',
      '🌬️ عرض الصيف',
      'اكتشف العرض',
      '#1B5E20',
      '#2E7D32',
      true,
      1
    ),
    (
      'خدمات السباكة بأسعار مخفضة',
      'إصلاح وصيانة السباكة مع ضمان الجودة',
      15,
      'https://img.rocket.new/generatedImages/rocket_gen_img_1122596dd-1785829864899.png',
      '🔧 عرض خاص',
      'احجز الآن',
      '#1565C0',
      '#1976D2',
      true,
      2
    ),
    (
      'كهربائي معتمد في منزلك',
      'خدمات كهربائية احترافية بأسعار تنافسية',
      10,
      'https://img.rocket.new/generatedImages/rocket_gen_img_1122596dd-1785829864899.png',
      '⚡ عرض محدود',
      'اطلب الخدمة',
      '#6A1B9A',
      '#7B1FA2',
      true,
      3
    )
  ON CONFLICT (id) DO NOTHING;
END $$;
