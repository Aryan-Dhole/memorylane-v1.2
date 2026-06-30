-- ========================================================
-- MemoryLane Supabase Database Schema
-- ========================================================

-- 1. Profiles Table (Extends Supabase Auth users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);


-- 2. Orders Table
CREATE TABLE public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  -- status values: draft, paid, processing, printing, qc, shipped, delivered, refunded
  book_type TEXT NOT NULL,
  -- book_type: wedding, baby, travel, corporate, festival, classic
  tier TEXT NOT NULL,
  -- tier: good (₹999), better (₹2499), best (₹4999), ultra (₹9999)
  page_count INTEGER,
  total_price INTEGER NOT NULL,  -- in paise (₹2499 = 249900)
  caption_style TEXT DEFAULT 'poetic',
  language TEXT DEFAULT 'English',
  shipping_name TEXT,
  shipping_address TEXT,
  shipping_city TEXT,
  shipping_pincode TEXT,
  shipping_phone TEXT,
  estimated_delivery DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own orders"
  ON public.orders FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);


-- 3. Photo Batches Table
CREATE TABLE public.photo_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  s3_prefix TEXT NOT NULL,
  total_uploaded INTEGER DEFAULT 0,
  total_processed INTEGER DEFAULT 0,
  ai_status TEXT DEFAULT 'pending',
  -- ai_status: pending, running, completed, failed
  ai_progress INTEGER DEFAULT 0,  -- 0–100
  pipeline_result JSONB,  -- stores full pipeline output
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.photo_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own batches"
  ON public.photo_batches FOR ALL
  USING (
    auth.uid() = (SELECT user_id FROM public.orders WHERE id = order_id)
  );


-- 4. Photos Table
CREATE TABLE public.photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID REFERENCES public.photo_batches(id) ON DELETE CASCADE NOT NULL,
  s3_key TEXT NOT NULL,
  original_filename TEXT,
  quality_score FLOAT,
  face_score FLOAT,
  aesthetic_score FLOAT,
  final_rank FLOAT,
  is_selected BOOLEAN DEFAULT FALSE,
  sequence_index INTEGER,
  chapter_index INTEGER,
  scene_label TEXT,
  caption TEXT,
  ai_caption TEXT,  -- original AI caption, in case user edits
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own photos"
  ON public.photos FOR ALL
  USING (
    auth.uid() = (
      SELECT o.user_id FROM public.orders o
      JOIN public.photo_batches pb ON pb.order_id = o.id
      WHERE pb.id = batch_id
    )
  );

CREATE INDEX idx_photos_batch_id ON public.photos(batch_id);
CREATE INDEX idx_photos_batch_rank ON public.photos(batch_id, final_rank DESC);
CREATE INDEX idx_photos_batch_selected ON public.photos(batch_id, is_selected);


-- 5. Payments Table
CREATE TABLE public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  amount INTEGER NOT NULL,  -- in paise
  status TEXT DEFAULT 'created',
  -- status: created, paid, failed
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own payments"
  ON public.payments FOR SELECT
  USING (
    auth.uid() = (SELECT user_id FROM public.orders WHERE id = order_id)
  );


-- 6. Shipments Table
CREATE TABLE public.shipments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  courier TEXT,
  waybill_number TEXT,
  tracking_url TEXT,
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own shipments"
  ON public.shipments FOR SELECT
  USING (
    auth.uid() = (SELECT user_id FROM public.orders WHERE id = order_id)
  );


-- ========================================================
-- Enable Realtime for Live Progress Tracking
-- ========================================================
-- To run in Supabase SQL editor:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.photo_batches;
