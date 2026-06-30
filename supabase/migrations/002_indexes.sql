-- Create performance indexes for relational foreign keys and query status filters
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

CREATE INDEX IF NOT EXISTS idx_photo_batches_order_id ON public.photo_batches(order_id);

CREATE INDEX IF NOT EXISTS idx_photos_batch_id ON public.photos(batch_id);
CREATE INDEX IF NOT EXISTS idx_photos_batch_rank ON public.photos(batch_id, final_rank DESC);
CREATE INDEX IF NOT EXISTS idx_photos_batch_selected ON public.photos(batch_id, is_selected);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON public.shipments(order_id);
