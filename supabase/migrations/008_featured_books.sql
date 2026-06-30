create table if not exists public.featured_books (
  id uuid default gen_random_uuid() primary key,
  image_url text not null,
  caption text,
  display_order int default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- Seed with 6 beautiful curated book images (using high-quality stock photography)
insert into public.featured_books (image_url, caption, display_order) values
('https://images.unsplash.com/photo-1519225495810-7512c696505a?w=800&auto=format&fit=crop', 'A magical summer celebration at the heritage valley house.', 1),
('https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=800&auto=format&fit=crop', 'Capturing the bride getting ready before the ceremony.', 2),
('https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop', 'Joyous family celebration at the garden reception.', 3),
('https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800&auto=format&fit=crop', 'Close-up details of customized table arrangements and lights.', 4),
('https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=800&auto=format&fit=crop', 'Unconditional love between the couple during their vows.', 5),
('https://images.unsplash.com/photo-1519225495810-7512c696505a?w=800&auto=format&fit=crop', 'A heart-warming toast proposed by the maid of honor.', 6);

-- Allow public read access to featured books
alter table public.featured_books enable row level security;
create policy "Allow public read access to active featured books"
  on public.featured_books for select
  using (active = true);
