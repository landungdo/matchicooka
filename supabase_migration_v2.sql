-- ============================================================
-- matchicooka — schema v2 (normalized, DA-friendly)
-- Run once in Supabase → SQL Editor.
-- This DROPS existing orders (demo data) and rebuilds them
-- normalized: orders + order_items + reviews.
-- profiles / messages are left untouched.
-- ============================================================

-- ---- wipe old demo orders (safe: demo only) ----
drop table if exists public.reviews cascade;
drop table if exists public.order_items cascade;
drop table if exists public.orders cascade;

-- ---- daily order counter (for codes like D14-0007) ----
create table if not exists public.order_counters (
  day date primary key,
  seq integer not null default 0
);
alter table public.order_counters enable row level security;
-- (no policies -> only accessed via SECURITY DEFINER function below)

-- ---- ORDERS ----
create table public.orders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  order_no   text unique,                     -- e.g. D14-0007 (day + seq, VN time)
  subtotal   integer not null default 0,
  note       text,                            -- customer note at checkout
  status     text not null default 'received'
             check (status in ('received','making','ready','cancelled')),
  created_at timestamptz not null default now(),
  making_at  timestamptz,                     -- set when owner starts making
  ready_at   timestamptz                      -- set when owner marks ready
);

-- ---- ORDER ITEMS (one row per drink -> clean group-by for DA) ----
create table public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade, -- denormalized for RLS
  product_id   text not null,
  product_name text not null,
  config       jsonb not null,
  qty          integer not null default 1,
  price        integer not null default 0,     -- unit price at time of order
  item_rating  integer check (item_rating between 1 and 5),
  item_comment text,
  created_at   timestamptz not null default now()
);

-- ---- REVIEWS (one per order: overall rating) ----
create table public.reviews (
  order_id   uuid primary key references public.orders(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  rating     integer not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- order code generator (VN day + zero-padded daily sequence) ----
create or replace function public.next_order_no()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  vn_day date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  n integer;
begin
  insert into public.order_counters (day, seq) values (vn_day, 1)
  on conflict (day) do update set seq = public.order_counters.seq + 1
  returning seq into n;
  return 'D' || to_char(vn_day, 'DD') || '-' || lpad(n::text, 4, '0');
end $$;

-- assign order_no automatically on insert
create or replace function public.set_order_no()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.order_no is null then new.order_no := public.next_order_no(); end if;
  return new;
end $$;
drop trigger if exists trg_set_order_no on public.orders;
create trigger trg_set_order_no before insert on public.orders
  for each row execute function public.set_order_no();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
alter table public.reviews     enable row level security;

-- orders
create policy orders_insert on public.orders
  for insert with check (user_id = auth.uid());
create policy orders_select on public.orders
  for select using (user_id = auth.uid() or public.is_owner());
create policy orders_update on public.orders
  for update using (public.is_owner() or user_id = auth.uid());

-- order_items
create policy items_insert on public.order_items
  for insert with check (user_id = auth.uid());
create policy items_select on public.order_items
  for select using (user_id = auth.uid() or public.is_owner());
create policy items_update on public.order_items
  for update using (user_id = auth.uid() or public.is_owner());

-- reviews (customer can review own delivered orders; everyone-owner can read)
create policy reviews_select on public.reviews
  for select using (user_id = auth.uid() or public.is_owner());
create policy reviews_upsert on public.reviews
  for insert with check (user_id = auth.uid());
create policy reviews_update on public.reviews
  for update using (user_id = auth.uid());

-- ---- realtime ----
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;

-- ============================================================
-- Handy analytics views (for later DA work)
-- ============================================================

-- rating per product: avg + count
create or replace view public.v_product_ratings as
select product_id, product_name,
       round(avg(item_rating)::numeric, 2) as avg_rating,
       count(item_rating)                  as total_ratings
from public.order_items
where item_rating is not null
group by product_id, product_name
order by avg_rating desc nulls last;

-- prep time per order (minutes), VN-day bucket
create or replace view public.v_order_timing as
select id, order_no,
       (created_at at time zone 'Asia/Ho_Chi_Minh')::date as vn_day,
       extract(hour from (created_at at time zone 'Asia/Ho_Chi_Minh')) as vn_hour,
       round(extract(epoch from (ready_at - created_at))/60.0, 1) as total_minutes,
       round(extract(epoch from (ready_at - making_at))/60.0, 1) as brew_minutes,
       status
from public.orders;
