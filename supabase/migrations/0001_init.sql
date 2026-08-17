-- ============================================================
-- 0001_init — profiles, auth helpers, messages
-- Run on a fresh Supabase project (SQL Editor) in order 0001→0005.
-- ============================================================

-- ---------- profiles ----------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null default 'customer' check (role in ('customer','owner')),
  display_name text,
  phone        text,
  created_at   timestamptz not null default now()
);

-- auto-create a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- role helper used by RLS policies
create or replace function public.is_owner()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role='owner');
$$;

-- ---------- messages (1 chat room per customer) ----------
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  room_user_id uuid not null references auth.users(id) on delete cascade,
  sender_id    uuid not null references auth.users(id) on delete cascade,
  sender_role  text not null check (sender_role in ('customer','owner')),
  body         text not null,
  created_at   timestamptz not null default now()
);

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.messages enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (id=auth.uid() or public.is_owner());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update using (id=auth.uid());

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select using (room_user_id=auth.uid() or public.is_owner());
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert with check (
  sender_id=auth.uid() and (
    (sender_role='customer' and room_user_id=auth.uid()) or
    (sender_role='owner' and public.is_owner())
  ));

-- ---------- realtime ----------
do $$ begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end $$;
