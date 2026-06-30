-- Update glitched/broken image URLs in public.featured_books table
UPDATE public.featured_books
SET image_url = 'https://images.unsplash.com/photo-1519225495810-7512c696505a?w=800&auto=format&fit=crop'
WHERE image_url = 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800&auto=format&fit=crop';

UPDATE public.featured_books
SET image_url = 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&auto=format&fit=crop'
WHERE image_url = 'https://images.unsplash.com/photo-1507504038482-762103743ec1?w=800&auto=format&fit=crop';
