-- ========================================================
-- Initial Table Structures Initialization for MemoryLane
-- ========================================================

-- 1. Profiles Table (Extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  book_type TEXT NOT NULL,
  tier TEXT NOT NULL,
  page_count INTEGER,
  total_price INTEGER NOT NULL,  -- in paise
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

-- 3. Photo Batches Table
CREATE TABLE IF NOT EXISTS public.photo_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  s3_prefix TEXT NOT NULL,
  total_uploaded INTEGER DEFAULT 0,
  total_processed INTEGER DEFAULT 0,
  ai_status TEXT DEFAULT 'pending',
  ai_progress INTEGER DEFAULT 0,
  pipeline_result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Photos Table
CREATE TABLE IF NOT EXISTS public.photos (
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
  ai_caption TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  amount INTEGER NOT NULL,
  status TEXT DEFAULT 'created',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Shipments Table
CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  courier TEXT,
  waybill_number TEXT,
  tracking_url TEXT,
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
