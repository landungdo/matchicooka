-- ============================================================
-- 0002_orders — orders, order_items, reviews, order-code generator, views
-- ============================================================

-- daily counter for order codes (D14-0007)
create table if not exists public.order_counters (
  day date primary key,
  seq integer not null default 0
);
alter table public.order_counters enable row level security;  -- no policies: definer functions only

-- ---------- orders ----------
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  order_no          text unique,
  subtotal          integer not null default 0 check (subtotal >= 0),
  note              text,
  phone             text,
  status            text not null default 'received'
                    check (status in ('received','making','ready','completed','cancelled')),
  cancel_reason     text,
  client_request_id text,
  created_at        timestamptz not null default now(),
  making_at         timestamptz,
  ready_at          timestamptz,
  completed_at      timestamptz,
  est_min           integer,
  est_max           integer,
  est_ready_at      timestamptz
);
create unique index if not exists orders_user_req_uidx
  on public.orders (user_id, client_request_id) where client_request_id is not null;

-- ---------- order items (one row per drink) ----------
create table if not exists public.order_items (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  product_id   text not null,
  product_name text not null,
  config       jsonb not null,
  qty          integer not null default 1 check (qty > 0 and qty <= 50),
  price        integer not null default 0 check (price >= 0),
  item_rating  integer check (item_rating between 1 and 5),
  item_comment text,
  created_at   timestamptz not null default now()
);

-- ---------- reviews (one per order) ----------
create table if not exists public.reviews (
  order_id   uuid primary key references public.orders(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  rating     integer not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- order code generator (VN day + zero-padded daily sequence) ----------
create or replace function public.next_order_no()
returns text language plpgsql security definer set search_path = public as $$
declare vn_day date := (now() at time zone 'Asia/Ho_Chi_Minh')::date; n integer;
begin
  insert into public.order_counters (day, seq) values (vn_day, 1)
  on conflict (day) do update set seq = public.order_counters.seq + 1
  returning seq into n;
  return 'D' || to_char(vn_day, 'DD') || '-' || lpad(n::text, 4, '0');
end $$;

create or replace function public.set_order_no()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.order_no is null then new.order_no := public.next_order_no(); end if;
  return new;
end $$;
drop trigger if exists trg_set_order_no on public.orders;
create trigger trg_set_order_no before insert on public.orders
  for each row execute function public.set_order_no();

-- ---------- RLS (writes go through RPCs in 0005; only selects here) ----------
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
alter table public.reviews     enable row level security;

drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select using (user_id=auth.uid() or public.is_owner());

drop policy if exists items_select on public.order_items;
create policy items_select on public.order_items for select using (user_id=auth.uid() or public.is_owner());

drop policy if exists reviews_select on public.reviews;
create policy reviews_select on public.reviews for select using (user_id=auth.uid() or public.is_owner());
-- reviews are written ONLY through submit_review() (see 0005); no direct insert/update policies.

-- ---------- realtime ----------
do $$ begin alter publication supabase_realtime add table public.orders;      exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.order_items; exception when duplicate_object then null; end $$;

-- ---------- analytics views ----------
create or replace view public.v_product_ratings as
select product_id, product_name,
       round(avg(item_rating)::numeric, 2) as avg_rating,
       count(item_rating) as total_ratings
from public.order_items
where item_rating is not null
group by product_id, product_name
order by avg_rating desc nulls last;

create or replace view public.v_order_timing as
select id, order_no,
       (created_at at time zone 'Asia/Ho_Chi_Minh')::date as vn_day,
       extract(hour from (created_at at time zone 'Asia/Ho_Chi_Minh')) as vn_hour,
       round(extract(epoch from (ready_at - created_at))/60.0, 1) as total_minutes,
       round(extract(epoch from (ready_at - making_at))/60.0, 1) as brew_minutes,
       status
from public.orders;

-- lock analytics views: respect caller RLS, no anon
alter view public.v_product_ratings set (security_invoker = true);
alter view public.v_order_timing    set (security_invoker = true);
revoke all on public.v_product_ratings from anon;
revoke all on public.v_order_timing    from anon;
