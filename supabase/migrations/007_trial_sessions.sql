create table if not exists public.trial_sessions (
  id uuid default gen_random_uuid() primary key,
  ip_address text,
  event_type text,
  status text default 'pending',
  -- status: pending, processing, ready, expired, converted
  s3_prefix text,
  result_photos jsonb,  -- stores up to 5 selected photos with captions
  converted_to_order_id uuid,  -- set when trial user converts to paid
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '24 hours'
);

-- No RLS needed — trial sessions are anonymous
-- Add index for cleanup job
create index on public.trial_sessions(expires_at);
create index on public.trial_sessions(ip_address);
