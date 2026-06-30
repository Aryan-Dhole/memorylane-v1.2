-- Add digital delivery fields to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS share_token TEXT DEFAULT gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS pdf_s3_key TEXT,
  ADD COLUMN IF NOT EXISTS zip_s3_key TEXT,
  ADD COLUMN IF NOT EXISTS share_url TEXT,
  ADD COLUMN IF NOT EXISTS pdf_download_url TEXT,
  ADD COLUMN IF NOT EXISTS book_title TEXT,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;

-- Update status constraint to digital-only values
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('draft', 'paid', 'processing', 'ready', 'failed', 'refunded'));

-- Add share token unique index
CREATE UNIQUE INDEX IF NOT EXISTS orders_share_token_idx ON public.orders(share_token);

-- Update tier constraint for new tiers
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_tier_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_tier_check
  CHECK (tier IN ('starter', 'classic', 'pro'));

-- Update total_price comment to reflect new pricing (in paise)
COMMENT ON COLUMN public.orders.total_price IS 'Amount in paise. Starter=29900, Classic=59900, Pro=99900';
