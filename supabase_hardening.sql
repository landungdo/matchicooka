-- ============================================================
-- matchicooka — HARDENING (consolidated). Run once in SQL Editor.
-- Safe/idempotent on the current DB. Brings it to the final safe state:
--  * server-side prices (client can no longer decide price)
--  * atomic place_order (order + items in one transaction)
--  * owner state-machine transitions (no illegal status jumps)
--  * reviews allowed after 'completed'
--  * value constraints
-- ============================================================

-- ---------- helper (idempotent) ----------
create or replace function public.is_owner()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role='owner');
$$;

-- ---------- server-side menu (source of truth for prices) ----------
create table if not exists public.menu_products (id text primary key, name text not null, base integer not null);
create table if not exists public.menu_milks    (id text primary key, price integer not null default 0);
create table if not exists public.menu_extras   (id text primary key, price integer not null default 0);

insert into public.menu_products (id,name,base) values
 ('classic','Classic Matcha Latte',55000),
 ('strawberry','Strawberry Matcha',60000),
 ('coconut','Coconut Matcha',62000),
 ('cloud','Matcha Cloud',65000),
 ('dirty','Dirty Matcha',68000),
 ('espresso','Matcha Espresso',66000),
 ('strawcloud','Matcha Strawberry Cloud',70000)
on conflict (id) do update set name=excluded.name, base=excluded.base;

insert into public.menu_milks (id,price) values
 ('fresh',0),('oat',10000),('soy',8000),('almond',12000),('coconut',10000)
on conflict (id) do update set price=excluded.price;

insert into public.menu_extras (id,price) values
 ('matchaFoam',10000),('creamCheeseFoam',12000),('redBean',8000),('brownSugarJelly',8000),('extraShot',12000)
on conflict (id) do update set price=excluded.price;

-- read-only to clients
alter table public.menu_products enable row level security;
alter table public.menu_milks    enable row level security;
alter table public.menu_extras   enable row level security;
drop policy if exists menu_products_read on public.menu_products;
create policy menu_products_read on public.menu_products for select using (true);
drop policy if exists menu_milks_read on public.menu_milks;
create policy menu_milks_read on public.menu_milks for select using (true);
drop policy if exists menu_extras_read on public.menu_extras;
create policy menu_extras_read on public.menu_extras for select using (true);

-- ---------- columns / status ----------
alter table public.orders add column if not exists phone text;
alter table public.orders add column if not exists completed_at timestamptz;
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('received','making','ready','completed','cancelled'));

-- value constraints (guarded so re-run doesn't error)
do $$ begin
  alter table public.order_items add constraint oi_qty_pos check (qty > 0 and qty <= 50);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.order_items add constraint oi_price_nonneg check (price >= 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.orders add constraint o_subtotal_nonneg check (subtotal >= 0);
exception when duplicate_object then null; end $$;

-- ---------- lock down direct writes (only RPCs may create/change orders) ----------
drop policy if exists orders_insert on public.orders;   -- customers create via place_order()
drop policy if exists orders_update on public.orders;   -- owner changes via transition_order_status()
drop policy if exists items_insert on public.order_items;
drop policy if exists items_update on public.order_items;
-- selects remain: customer sees own, owner sees all (from earlier setup)

-- ============================================================
-- RPC: place_order  (atomic, server-priced)
-- p_items: [{"config":{...}, "qty":2}, ...]
-- ============================================================
create or replace function public.place_order(p_items jsonb, p_phone text, p_note text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_order uuid; v_sub int := 0;
  v_it jsonb; v_cfg jsonb; v_pid text; v_qty int;
  v_base int; v_milk int; v_extra int; v_price int; v_ex text; v_name text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty'; end if;
  if length(coalesce(p_phone,'')) < 6 or length(coalesce(p_phone,'')) > 20 then raise exception 'Please enter a valid phone number'; end if;
  if length(coalesce(p_note,'')) > 300 then raise exception 'Note is too long'; end if;

  insert into public.orders (user_id, subtotal, phone, note)
  values (auth.uid(), 0, p_phone, nullif(p_note,'')) returning id into v_order;

  for v_it in select * from jsonb_array_elements(p_items) loop
    v_cfg := v_it->'config';
    v_qty := coalesce((v_it->>'qty')::int, 1);
    if v_qty < 1 or v_qty > 50 then raise exception 'Invalid quantity'; end if;
    v_pid := v_cfg->>'productId';

    select base, name into v_base, v_name from public.menu_products where id = v_pid;
    if v_base is null then raise exception 'Unknown product: %', v_pid; end if;

    select coalesce(price,0) into v_milk from public.menu_milks where id = (v_cfg->>'milk');
    v_milk := coalesce(v_milk, 0);

    v_extra := 0;
    for v_ex in select jsonb_array_elements_text(coalesce(v_cfg->'extras','[]'::jsonb)) loop
      v_extra := v_extra + coalesce((select price from public.menu_extras where id = v_ex), 0);
    end loop;

    v_price := v_base + v_milk + v_extra;
    insert into public.order_items (order_id, user_id, product_id, product_name, config, qty, price)
    values (v_order, auth.uid(), v_pid, v_name, v_cfg, v_qty, v_price);
    v_sub := v_sub + v_price * v_qty;
  end loop;

  update public.orders set subtotal = v_sub where id = v_order;
  return (select row_to_json(o) from (select id, order_no, subtotal from public.orders where id = v_order) o);
end $$;
grant execute on function public.place_order(jsonb, text, text) to authenticated;

-- ============================================================
-- RPC: transition_order_status (owner only, state machine, db timestamps)
-- ============================================================
create or replace function public.transition_order_status(p_order uuid, p_next text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_cur text;
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  select status into v_cur from public.orders where id = p_order;
  if v_cur is null then raise exception 'Order not found'; end if;
  if not (
      (v_cur='received' and p_next in ('making','cancelled')) or
      (v_cur='making'   and p_next in ('ready','cancelled')) or
      (v_cur='ready'    and p_next in ('completed','cancelled'))
  ) then raise exception 'Invalid transition % -> %', v_cur, p_next; end if;

  update public.orders set
     status = p_next,
     making_at    = case when p_next='making'    then now() else making_at end,
     ready_at     = case when p_next='ready'     then now() else ready_at end,
     completed_at = case when p_next='completed' then now() else completed_at end
   where id = p_order;
end $$;
grant execute on function public.transition_order_status(uuid, text) to authenticated;

-- ============================================================
-- RPC: submit_review  (now allowed once 'completed'; dedupe items; cap comment)
-- ============================================================
create or replace function public.submit_review(p_order uuid, p_comment text, p_items jsonb)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_overall integer;
begin
  if not exists (
    select 1 from public.orders
    where id = p_order and user_id = auth.uid() and status = 'completed'
  ) then
    raise exception 'You can review an order once it is completed.';
  end if;

  -- dedupe by item id (last one wins), only items of this order/user
  with r as (
    select distinct on ((e->>'id')::uuid) (e->>'id')::uuid as id, (e->>'rating')::int as rating
    from jsonb_array_elements(p_items) e
    where (e->>'rating') is not null
    order by (e->>'id')::uuid
  )
  update public.order_items oi set item_rating = r.rating
  from r where oi.id = r.id and oi.order_id = p_order and oi.user_id = auth.uid();

  select round(avg(rating))::int into v_overall from (
    select distinct on ((e->>'id')::uuid) (e->>'rating')::numeric as rating
    from jsonb_array_elements(p_items) e
    where (e->>'rating') is not null
    order by (e->>'id')::uuid
  ) x;
  if v_overall is null then raise exception 'Please give at least one star.'; end if;

  insert into public.reviews (order_id, user_id, rating, comment, updated_at)
  values (p_order, auth.uid(), v_overall, left(nullif(p_comment,''), 300), now())
  on conflict (order_id) do update set rating=excluded.rating, comment=excluded.comment, updated_at=now();
end $$;
grant execute on function public.submit_review(uuid, text, jsonb) to authenticated;

-- ============================================================
-- RPC: cancel_my_order (customer, only while 'received') — unchanged
-- ============================================================
create or replace function public.cancel_my_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.orders set status='cancelled'
   where id=p_order and user_id=auth.uid() and status='received';
  if not found then raise exception 'Order cannot be cancelled (not yours, or already being made).'; end if;
end $$;
grant execute on function public.cancel_my_order(uuid) to authenticated;
