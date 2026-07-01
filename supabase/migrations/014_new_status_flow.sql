-- ============================================================
-- 014: Pay-First Async Gallery Flow — New Status & Columns
-- ============================================================
-- Updates order status constraint and adds review/publish tracking columns

-- 1. Drop old status constraint if exists
alter table public.orders
  drop constraint if exists orders_status_check;

-- 2. Add columns if not exists first (so ready_at/published_at columns exist for step 3)
alter table public.orders
  add column if not exists review_deadline timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists auto_published boolean default false,
  add column if not exists pipeline_completed_at timestamptz,
  add column if not exists pipeline_duration_seconds integer;

-- 3. Migrate existing 'ready' status orders to 'published' BEFORE constraint validation
-- (so existing live galleries keep working and don't violate the new check constraint)
update public.orders
  set status = 'published',
      gallery_live = true,
      published_at = coalesce(ready_at, now()),
      auto_published = false
  where status = 'ready';

-- 4. Add new status constraint with expanded values
alter table public.orders
  add constraint orders_status_check
  check (status in (
    'draft', 'paid', 'processing',
    'review_ready', 'published',
    'expired', 'failed', 'refunded'
  ));

