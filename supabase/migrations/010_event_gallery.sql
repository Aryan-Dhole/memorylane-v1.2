-- Rename concept from "orders" to "events" in logic (keep table name for compatibility)
-- Add event-specific fields to orders table

alter table public.orders
  add column if not exists event_slug text unique,
  -- e.g. "rahul-priya-wedding-2024" — URL-safe, user-editable, unique
  add column if not exists event_name text,
  -- e.g. "Rahul & Priya's Wedding"
  add column if not exists event_date date,
  add column if not exists event_location text,
  add column if not exists gallery_live boolean default false,
  add column if not exists gallery_password text,
  -- optional password for private galleries
  add column if not exists allow_guest_uploads boolean default false,
  add column if not exists allow_reactions boolean default true,
  add column if not exists caption_style text default 'cinematic',
  add column if not exists cover_photo_id uuid,
  -- references photos.id — the hero image for the gallery
  add column if not exists view_count integer default 0,
  add column if not exists expires_at timestamptz;

-- Gallery moments (replaces chapters concept, more flexible)
create table if not exists public.gallery_moments (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  name text not null,             -- "The Ceremony", "First Dance", "Family Portraits"
  display_order integer not null,
  cover_photo_id uuid,            -- hero photo for this moment
  photo_count integer default 0,
  created_at timestamptz default now()
);

alter table public.gallery_moments enable row level security;
create policy "Public read gallery_moments" on public.gallery_moments for select using (true);

-- Guest reactions
create table if not exists public.photo_reactions (
  id uuid default gen_random_uuid() primary key,
  photo_id uuid references public.photos(id) on delete cascade not null,
  reaction_type text not null check (reaction_type in ('heart', 'laugh', 'cry', 'wow')),
  session_id text not null,       -- anonymous session ID (localStorage UUID, no login needed)
  created_at timestamptz default now(),
  unique(photo_id, session_id, reaction_type)
);

alter table public.photo_reactions enable row level security;
create policy "Anyone can react" on public.photo_reactions for all using (true);

-- Guest uploads
create table if not exists public.guest_uploads (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  uploader_name text,
  uploader_session_id text not null,
  s3_key text not null,
  status text default 'pending',
  -- status: pending, approved, rejected (auto-approved if quality passes, else manual review)
  quality_score float,
  approved_at timestamptz,
  created_at timestamptz default now()
);

alter table public.guest_uploads enable row level security;
create policy "Anyone can submit guest upload" on public.guest_uploads for insert with check (true);
create policy "Gallery owner can manage guest uploads"
  on public.guest_uploads for all
  using (
    auth.uid() = (select user_id from public.orders where id = order_id)
  );

-- Face clusters (for "My Photos" filter)
create table if not exists public.face_clusters (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  cluster_index integer not null,
  representative_photo_id uuid,     -- photo to use as the face thumbnail in the filter UI
  representative_face_crop_s3 text, -- pre-cropped face thumbnail stored in S3
  photo_count integer default 0,
  created_at timestamptz default now()
);

alter table public.face_clusters enable row level security;
create policy "Public read face_clusters" on public.face_clusters for select using (true);

-- Add face_cluster_ids to photos table
alter table public.photos
  add column if not exists visual_analysis jsonb,  -- stores the full analysis JSON
  add column if not exists caption_v2 text,        -- new system caption
  add column if not exists caption_style text,     -- which style was used
  add column if not exists caption_edited text,    -- user-edited version (if they changed it)
  add column if not exists caption_regenerated_at timestamptz,
  add column if not exists face_cluster_ids integer[],
  -- array of cluster_index values — a photo can contain multiple faces/clusters
  add column if not exists moment_id uuid references public.gallery_moments(id),
  add column if not exists face_crops_s3 text[];

-- Add photographer profile columns to profiles
alter table public.profiles
  add column if not exists is_photographer boolean default false,
  add column if not exists studio_name text,
  add column if not exists studio_logo_s3 text,
  add column if not exists studio_website text,
  add column if not exists studio_location text;

-- Update tier constraints for new event gallery pricing tiers
alter table public.orders
  drop constraint if exists orders_tier_check,
  drop constraint if exists chk_order_tier;

alter table public.orders
  add constraint orders_tier_check
  check (tier in ('free', 'basic', 'premium', 'photographer'));
  -- S3 keys of individual face crops extracted from this photo
