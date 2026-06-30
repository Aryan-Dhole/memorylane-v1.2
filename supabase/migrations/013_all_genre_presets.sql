-- Truncate and re-seed featured books with the final set of working multi-genre URLs
TRUNCATE TABLE public.featured_books CASCADE;

INSERT INTO public.featured_books (image_url, caption, display_order) VALUES
('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&auto=format&fit=crop', 'Embark on scenic mountain road trips with custom curation.', 1),
('https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&auto=format&fit=crop', 'Relive energetic music festivals and live performance beats.', 2),
('https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800&auto=format&fit=crop', 'Commemorate intimate birthday parties and colorful balloon decor.', 3),
('https://images.unsplash.com/photo-1505678261036-a3fcc5e884ee?w=800&auto=format&fit=crop', 'Track cute baby steps and family milestones.', 4),
('https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=800&auto=format&fit=crop', 'Celebrate academic graduation achievement milestones.', 5);
