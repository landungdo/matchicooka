-- ============================================================
-- matchicooka — Step 4: pickup phone + 'completed' status
-- Run once in Supabase → SQL Editor.
-- ============================================================

-- pickup phone (note column already exists from schema v2)
alter table public.orders add column if not exists phone text;

-- allow a 'completed' (picked up) status in addition to the others
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('received','making','ready','completed','cancelled'));

-- optional: record pickup time when completed (for DA later)
alter table public.orders add column if not exists completed_at timestamptz;
