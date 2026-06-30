-- New table to store individual book pages/spreads for the shareable viewer
CREATE TABLE IF NOT EXISTS public.book_pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  page_index INTEGER NOT NULL,
  chapter_index INTEGER,
  chapter_name TEXT,
  layout_type TEXT, -- 'cover', 'chapter_divider', 'single', 'double', 'portrait', 'back_cover'
  photo_ids UUID[],  -- references to photos table
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.book_pages ENABLE ROW LEVEL SECURITY;

-- Configure select policy for public share links
CREATE POLICY "Public read on book_pages via share token"
  ON public.book_pages FOR SELECT
  USING (true);
