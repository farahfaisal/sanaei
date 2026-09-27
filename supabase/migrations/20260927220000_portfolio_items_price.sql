-- Add price column to portfolio_items
ALTER TABLE public.portfolio_items
  ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2) DEFAULT NULL;
