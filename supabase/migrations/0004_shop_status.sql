-- ============================================================
-- 0004_shop_status — open/busy/closed + prep-time estimate
-- ============================================================

create table if not exists public.shop_status (
  id               integer primary key default 1,
  status           text not null default 'normal'
                   check (status in ('normal','busy','very_busy','paused','closed')),
  accepting_orders boolean not null default true,
  min_prep_minutes integer not null default 10,
  max_prep_minutes integer not null default 15,
  message          text,
  updated_at       timestamptz not null default now()
);
insert into public.shop_status (id) values (1) on conflict (id) do nothing;

alter table public.shop_status enable row level security;
drop policy if exists shop_status_read on public.shop_status;
create policy shop_status_read on public.shop_status for select using (true);
drop policy if exists shop_status_update on public.shop_status;
create policy shop_status_update on public.shop_status for update using (public.is_owner());

do $$ begin alter publication supabase_realtime add table public.shop_status; exception when duplicate_object then null; end $$;
