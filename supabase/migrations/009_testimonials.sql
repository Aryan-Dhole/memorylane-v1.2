create table if not exists public.testimonials (
  id uuid default gen_random_uuid() primary key,
  customer_name text not null,
  location text,
  review_text text not null,
  rating int default 5,
  book_type text,
  photo_url text,
  display_order int default 0,
  active boolean default true,
  created_at timestamptz default now()
);

-- Seed with 5 customer testimonials
insert into public.testimonials (customer_name, location, review_text, rating, book_type, photo_url, display_order) values
('Aditi Sharma', 'Mumbai', 'MemoryLane turned our 300 wedding photos into a breathtaking story in minutes. The caption style was poetic and beautiful.', 5, 'Classic', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop', 1),
('Rahul Kapoor', 'New Delhi', 'The captions were so emotional, my mother cried when reading the digital book. It is highly convenient to share via WhatsApp.', 5, 'Pro', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop', 2),
('Sneha Pillai', 'Bangalore', 'Incredibly fast curation. A must-have for family trips, baby showers, and birthdays. Highly recommend the free trial!', 5, 'Starter', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&auto=format&fit=crop', 3),
('Vikram Mehta', 'Pune', 'Absolutely flawless transition. We had duplicates and low light shots, and the AI filtered them out seamlessly.', 5, 'Classic', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop', 4),
('Meera Nair', 'Cochin', 'Having both the high-res printable PDF download and the online cinematic viewer was perfect for our vacation memories.', 5, 'Pro', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop', 5);

-- Allow public read access to testimonials
alter table public.testimonials enable row level security;
create policy "Allow public read access to active testimonials"
  on public.testimonials for select
  using (active = true);
