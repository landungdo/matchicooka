-- ============================================================
-- 0005_functions — all RPCs (server-priced, atomic, state-machine, reviews)
-- plus lock-down of every SECURITY DEFINER function.
-- ============================================================


-- idempotency key (one order per (user, request id))
alter table public.orders add column if not exists client_request_id text;
create unique index if not exists orders_user_req_uidx
  on public.orders (user_id, client_request_id) where client_request_id is not null;

-- remove older overloads so calls are unambiguous
drop function if exists public.place_order(jsonb, text, text);
drop function if exists public.place_order(jsonb, text, text, text);

create function public.place_order(p_items jsonb, p_phone text, p_note text, p_request_id text default null)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_order uuid; v_sub int := 0; v_existing uuid;
  v_it jsonb; v_cfg jsonb; v_pid text; v_qty int; v_milkid text; v_sweet int; v_stren text; v_ice text;
  v_base int; v_milk int; v_extra int; v_price int; v_ex text; v_name text; v_avail boolean;
  v_accept boolean; v_min int; v_max int; v_ready timestamptz;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  -- request id, when provided, must be a UUID
  if p_request_id is not null and p_request_id <> '' and
     p_request_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  then raise exception 'Invalid request id'; end if;

  -- idempotency: same request id -> return the existing order, don't duplicate
  if p_request_id is not null and length(p_request_id) > 0 then
    select id into v_existing from public.orders
     where user_id = auth.uid() and client_request_id = p_request_id;
    if v_existing is not null then
      return (select row_to_json(o) from
        (select id, order_no, subtotal, est_min, est_max, est_ready_at from public.orders where id = v_existing) o);
    end if;
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty'; end if;
  if length(coalesce(p_phone,'')) < 6 or length(coalesce(p_phone,'')) > 20 then raise exception 'Please enter a valid phone number'; end if;
  if length(coalesce(p_note,'')) > 300 then raise exception 'Note is too long'; end if;

  select accepting_orders, min_prep_minutes, max_prep_minutes
    into v_accept, v_min, v_max from public.shop_status where id = 1;
  if v_accept is false then raise exception 'The shop is not accepting orders right now.'; end if;
  v_min := coalesce(v_min,10); v_max := coalesce(v_max,15);
  v_ready := now() + (v_max || ' minutes')::interval;

  begin
    insert into public.orders (user_id, subtotal, phone, note, est_min, est_max, est_ready_at, client_request_id)
    values (auth.uid(), 0, p_phone, nullif(p_note,''), v_min, v_max, v_ready, nullif(p_request_id,''))
    returning id into v_order;
  exception when unique_violation then
    -- a concurrent request with the same client_request_id won: return that order
    select id into v_existing from public.orders
     where user_id = auth.uid() and client_request_id = p_request_id;
    return (select row_to_json(o) from
      (select id, order_no, subtotal, est_min, est_max, est_ready_at from public.orders where id = v_existing) o);
  end;

  for v_it in select * from jsonb_array_elements(p_items) loop
    v_cfg := v_it->'config';
    v_qty := coalesce((v_it->>'qty')::int, 1);
    if v_qty < 1 or v_qty > 50 then raise exception 'Invalid quantity'; end if;

    -- validate config enums
    v_stren := v_cfg->>'strength';
    if v_stren is null or v_stren not in ('light','regular','strong','extraStrong') then raise exception 'Invalid strength'; end if;
    v_sweet := (v_cfg->>'sweetness')::int;
    if v_sweet is null or v_sweet not in (0,25,50,75,100) then raise exception 'Invalid sweetness'; end if;
    v_ice := v_cfg->>'ice';
    if v_ice is null or v_ice not in ('none','less','regular','extra') then raise exception 'Invalid ice level'; end if;

    -- product
    v_pid := v_cfg->>'productId';
    select base, name, available into v_base, v_name, v_avail from public.menu_products where id = v_pid;
    if v_base is null then raise exception 'Unknown product: %', v_pid; end if;
    if v_avail is false then raise exception '% is sold out', v_name; end if;

    -- milk (must exist)
    v_milkid := v_cfg->>'milk';
    if v_milkid is null then raise exception 'Missing milk'; end if;
    select price into v_milk from public.menu_milks where id = v_milkid;
    if v_milk is null then raise exception 'Unknown milk: %', v_milkid; end if;

    -- extras (de-duped, each must exist)
    v_extra := 0;
    for v_ex in select distinct jsonb_array_elements_text(coalesce(v_cfg->'extras','[]'::jsonb)) loop
      if not exists (select 1 from public.menu_extras where id = v_ex) then raise exception 'Unknown extra: %', v_ex; end if;
      v_extra := v_extra + (select price from public.menu_extras where id = v_ex);
    end loop;

    v_price := v_base + v_milk + v_extra;
    insert into public.order_items (order_id, user_id, product_id, product_name, config, qty, price)
    values (v_order, auth.uid(), v_pid, v_name, v_cfg, v_qty, v_price);
    v_sub := v_sub + v_price * v_qty;
  end loop;

  update public.orders set subtotal = v_sub where id = v_order;
  update public.profiles set phone = p_phone where id = auth.uid();
  return (select row_to_json(o) from
    (select id, order_no, subtotal, est_min, est_max, est_ready_at from public.orders where id = v_order) o);
end $$;

-- lock down: only signed-in users, not anon/public
revoke all on function public.place_order(jsonb, text, text, text) from public;
revoke all on function public.place_order(jsonb, text, text, text) from anon;
grant execute on function public.place_order(jsonb, text, text, text) to authenticated;

-- ---------- transition_order_status (owner state machine) ----------
drop function if exists public.transition_order_status(uuid, text);
create or replace function public.transition_order_status(p_order uuid, p_next text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_cur text; v_rows int;
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  select status into v_cur from public.orders where id = p_order for update;
  if v_cur is null then raise exception 'Order not found'; end if;
  if not (
      (v_cur='received' and p_next in ('making','cancelled')) or
      (v_cur='making'   and p_next in ('ready','cancelled')) or
      (v_cur='ready'    and p_next in ('completed','cancelled'))
  ) then raise exception 'Invalid transition % -> %', v_cur, p_next; end if;
  update public.orders set
     status = p_next,
     cancel_reason = case when p_next='cancelled' then left(nullif(p_reason,''),200) else cancel_reason end,
     making_at    = case when p_next='making'    then now() else making_at end,
     ready_at     = case when p_next='ready'     then now() else ready_at end,
     completed_at = case when p_next='completed' then now() else completed_at end
   where id = p_order and status = v_cur;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'Order changed, please refresh'; end if;
end $$;

-- ---------- submit_review (customer, after completed) ----------
create or replace function public.submit_review(p_order uuid, p_comment text, p_items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_overall integer;
begin
  if not exists (select 1 from public.orders where id=p_order and user_id=auth.uid() and status='completed')
  then raise exception 'You can review an order once it is completed.'; end if;

  with r as (
    select distinct on ((e->>'id')::uuid) (e->>'id')::uuid as id, (e->>'rating')::int as rating
    from jsonb_array_elements(p_items) e where (e->>'rating') is not null order by (e->>'id')::uuid
  )
  update public.order_items oi set item_rating = r.rating
  from r where oi.id=r.id and oi.order_id=p_order and oi.user_id=auth.uid();

  select round(avg(rating))::int into v_overall from (
    select distinct on ((e->>'id')::uuid) (e->>'rating')::numeric as rating
    from jsonb_array_elements(p_items) e where (e->>'rating') is not null order by (e->>'id')::uuid
  ) x;
  if v_overall is null then raise exception 'Please give at least one star.'; end if;

  insert into public.reviews (order_id, user_id, rating, comment, updated_at)
  values (p_order, auth.uid(), v_overall, left(nullif(p_comment,''),300), now())
  on conflict (order_id) do update set rating=excluded.rating, comment=excluded.comment, updated_at=now();
end $$;

-- ---------- cancel_my_order (customer, only while received) ----------
create or replace function public.cancel_my_order(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.orders set status='cancelled'
   where id=p_order and user_id=auth.uid() and status='received';
  if not found then raise exception 'Order cannot be cancelled (not yours, or already being made).'; end if;
end $$;

-- ---------- lock down every SECURITY DEFINER function ----------
revoke all on function public.is_owner() from public;
grant  execute on function public.is_owner() to authenticated;
revoke all on function public.next_order_no() from public;
do $$ begin revoke all on function public.set_order_no() from public; exception when undefined_function then null; end $$;
do $$ begin revoke all on function public.handle_new_user() from public; exception when undefined_function then null; end $$;
revoke all on function public.transition_order_status(uuid, text, text) from public;
grant  execute on function public.transition_order_status(uuid, text, text) to authenticated;
revoke all on function public.submit_review(uuid, text, jsonb) from public;
grant  execute on function public.submit_review(uuid, text, jsonb) to authenticated;
revoke all on function public.cancel_my_order(uuid) from public;
grant  execute on function public.cancel_my_order(uuid) to authenticated;
revoke all on function public.place_order(jsonb, text, text, text) from public;
grant  execute on function public.place_order(jsonb, text, text, text) to authenticated;
