-- ========================================================
-- MemoryLane Supabase Database Schema (Production Ready)
-- ========================================================

-- 1. Profiles Table (Extends Supabase Auth users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  is_photographer BOOLEAN DEFAULT FALSE,
  studio_name TEXT,
  studio_logo_s3 TEXT,
  studio_website TEXT,
  studio_location TEXT,
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
  -- status values: draft, paid, processing, ready, printing, qc, shipped, delivered, refunded, failed
  book_type TEXT NOT NULL,
  -- book_type: wedding, baby, travel, corporate, festival, classic
  tier TEXT NOT NULL,
  -- tier: free, basic, premium, photographer
  page_count INTEGER,
  total_price INTEGER NOT NULL DEFAULT 0,  -- in paise (₹499 = 49900)
  caption_style TEXT DEFAULT 'poetic',
  language TEXT DEFAULT 'English',
  book_title TEXT,
  event_name TEXT,
  event_date TEXT,
  event_location TEXT,
  event_slug TEXT UNIQUE,
  share_token TEXT,
  share_url TEXT,
  gallery_live BOOLEAN DEFAULT FALSE,
  view_count INTEGER DEFAULT 0,
  cover_photo_id UUID,
  allow_guest_uploads BOOLEAN DEFAULT FALSE,
  allow_reactions BOOLEAN DEFAULT TRUE,
  gallery_password TEXT,
  ready_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  processing_started_at TIMESTAMPTZ,
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

-- Public gallery access by slug (for gallery viewers)
CREATE POLICY "Public gallery access by slug"
  ON public.orders FOR SELECT
  USING (gallery_live = TRUE AND event_slug IS NOT NULL);

CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_event_slug ON public.orders(event_slug);


-- 3. Photo Batches Table
CREATE TABLE public.photo_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,  -- nullable for trial batches
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
    order_id IS NULL OR  -- allow trial batches
    auth.uid() = (SELECT user_id FROM public.orders WHERE id = order_id)
  );


-- 4. Gallery Moments Table (chapter/section groupings within a gallery)
CREATE TABLE public.gallery_moments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  cover_photo_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.gallery_moments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own moments"
  ON public.gallery_moments FOR ALL
  USING (
    auth.uid() = (SELECT user_id FROM public.orders WHERE id = order_id)
  );

-- Public read access for live galleries
CREATE POLICY "Public read access for live gallery moments"
  ON public.gallery_moments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND gallery_live = TRUE)
  );

CREATE INDEX idx_gallery_moments_order_id ON public.gallery_moments(order_id);


-- 5. Photos Table
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
  caption_v2 TEXT,  -- AI-generated caption (second generation)
  caption_edited TEXT,  -- user-edited caption override
  visual_analysis JSONB,  -- structured visual analysis from Vision API
  face_cluster_ids JSONB DEFAULT '[]'::jsonb,  -- array of cluster indices
  moment_id UUID REFERENCES public.gallery_moments(id) ON DELETE SET NULL,
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
CREATE INDEX idx_photos_moment_id ON public.photos(moment_id);


-- 6. Face Clusters Table (identity groupings across a gallery)
CREATE TABLE public.face_clusters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  cluster_index INTEGER NOT NULL,
  representative_face_crop_s3 TEXT,
  photo_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.face_clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access own face clusters"
  ON public.face_clusters FOR ALL
  USING (
    auth.uid() = (SELECT user_id FROM public.orders WHERE id = order_id)
  );

-- Public read access for live galleries
CREATE POLICY "Public read access for live gallery face clusters"
  ON public.face_clusters FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND gallery_live = TRUE)
  );

CREATE INDEX idx_face_clusters_order_id ON public.face_clusters(order_id);


-- 7. Photo Reactions Table (guest emoji reactions on gallery photos)
CREATE TABLE public.photo_reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  photo_id UUID REFERENCES public.photos(id) ON DELETE CASCADE NOT NULL,
  reaction_type TEXT NOT NULL,  -- heart, laugh, cry, wow
  session_id TEXT NOT NULL,  -- anonymous session identifier
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(photo_id, reaction_type, session_id)
);

ALTER TABLE public.photo_reactions ENABLE ROW LEVEL SECURITY;

-- Public insert/read access (anonymous reactions)
CREATE POLICY "Anyone can read reactions"
  ON public.photo_reactions FOR SELECT
  USING (TRUE);

CREATE POLICY "Anyone can insert reactions"
  ON public.photo_reactions FOR INSERT
  WITH CHECK (TRUE);

CREATE INDEX idx_photo_reactions_photo_id ON public.photo_reactions(photo_id);


-- 8. Guest Uploads Table (guest photo submissions to live galleries)
CREATE TABLE public.guest_uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  uploader_name TEXT DEFAULT 'Guest',
  uploader_session_id TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  quality_score FLOAT,
  status TEXT DEFAULT 'pending',  -- pending, approved, rejected
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.guest_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit guest uploads"
  ON public.guest_uploads FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Users can read own gallery uploads"
  ON public.guest_uploads FOR SELECT
  USING (
    auth.uid() = (SELECT user_id FROM public.orders WHERE id = order_id)
  );

CREATE INDEX idx_guest_uploads_order_session ON public.guest_uploads(order_id, uploader_session_id);


-- 9. Trial Sessions Table (anonymous free trial sessions)
CREATE TABLE public.trial_sessions (
  id UUID PRIMARY KEY,
  ip_address TEXT,
  event_type TEXT,
  status TEXT DEFAULT 'pending',  -- pending, processing, ready, expired
  s3_prefix TEXT,
  result_photos JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.trial_sessions ENABLE ROW LEVEL SECURITY;

-- Public access for trial sessions (anonymous)
CREATE POLICY "Anyone can create trial sessions"
  ON public.trial_sessions FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Anyone can read trial sessions"
  ON public.trial_sessions FOR SELECT
  USING (TRUE);

CREATE POLICY "Anyone can update trial sessions"
  ON public.trial_sessions FOR UPDATE
  USING (TRUE);


-- 10. Payments Table
CREATE TABLE public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT,
  razorpay_signature TEXT,
  amount INTEGER NOT NULL,  -- in paise
  status TEXT DEFAULT 'created',
  -- status: created, paid, failed, refunded
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own payments"
  ON public.payments FOR SELECT
  USING (
    auth.uid() = (SELECT user_id FROM public.orders WHERE id = order_id)
  );


-- 11. Shipments Table
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

-- ========================================================
-- Auto-create profile on user signup
-- ========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
