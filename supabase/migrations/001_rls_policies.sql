-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Table Policies
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- 2. Orders Table Policies
CREATE POLICY "Users can read own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own orders"
  ON public.orders FOR UPDATE
  USING (auth.uid() = user_id);

-- 3. Photo Batches Table Policies
CREATE POLICY "Users can access own batches"
  ON public.photo_batches FOR ALL
  USING (
    auth.uid() = (SELECT user_id FROM public.orders WHERE id = order_id)
  );

-- 4. Photos Table Policies
CREATE POLICY "Users can access own photos"
  ON public.photos FOR ALL
  USING (
    auth.uid() = (
      SELECT o.user_id FROM public.orders o
      JOIN public.photo_batches pb ON pb.order_id = o.id
      WHERE pb.id = batch_id
    )
  );

-- 5. Payments Table Policies
CREATE POLICY "Users can read own payments"
  ON public.payments FOR SELECT
  USING (
    auth.uid() = (SELECT user_id FROM public.orders WHERE id = order_id)
  );

-- 6. Shipments Table Policies
CREATE POLICY "Users can read own shipments"
  ON public.shipments FOR SELECT
  USING (
    auth.uid() = (SELECT user_id FROM public.orders WHERE id = order_id)
  );
