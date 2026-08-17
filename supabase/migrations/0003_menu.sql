-- ============================================================
-- 0003_menu — server-side menu (source of truth for prices) + availability
-- ============================================================

create table if not exists public.menu_products (
  id text primary key, name text not null, base integer not null,
  available boolean not null default true
);
create table if not exists public.menu_milks  (id text primary key, price integer not null default 0);
create table if not exists public.menu_extras (id text primary key, price integer not null default 0);

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

alter table public.menu_products enable row level security;
alter table public.menu_milks    enable row level security;
alter table public.menu_extras   enable row level security;

drop policy if exists menu_products_read on public.menu_products;
create policy menu_products_read on public.menu_products for select using (true);
drop policy if exists menu_products_update on public.menu_products;
create policy menu_products_update on public.menu_products for update using (public.is_owner());

drop policy if exists menu_milks_read on public.menu_milks;
create policy menu_milks_read on public.menu_milks for select using (true);
drop policy if exists menu_extras_read on public.menu_extras;
create policy menu_extras_read on public.menu_extras for select using (true);

-- product availability changes should reach customers live
do $$ begin alter publication supabase_realtime add table public.menu_products; exception when duplicate_object then null; end $$;
