-- ============================================================
-- matchicooka — Step 5: sold-out + cancel reason. Run once.
-- (Depends on hardening + shopstatus migrations.)
-- ============================================================

-- product availability (sold-out)
alter table public.menu_products add column if not exists available boolean not null default true;
drop policy if exists menu_products_update on public.menu_products;
create policy menu_products_update on public.menu_products for update using (public.is_owner());

-- cancel reason on orders
alter table public.orders add column if not exists cancel_reason text;

-- ---------- place_order v3: also reject sold-out ----------
create or replace function public.place_order(p_items jsonb, p_phone text, p_note text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_order uuid; v_sub int := 0;
  v_it jsonb; v_cfg jsonb; v_pid text; v_qty int;
  v_base int; v_milk int; v_extra int; v_price int; v_ex text; v_name text; v_avail boolean;
  v_accept boolean; v_min int; v_max int; v_ready timestamptz;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty'; end if;
  if length(coalesce(p_phone,'')) < 6 or length(coalesce(p_phone,'')) > 20 then raise exception 'Please enter a valid phone number'; end if;
  if length(coalesce(p_note,'')) > 300 then raise exception 'Note is too long'; end if;

  select accepting_orders, min_prep_minutes, max_prep_minutes
    into v_accept, v_min, v_max from public.shop_status where id = 1;
  if v_accept is false then raise exception 'The shop is not accepting orders right now.'; end if;
  v_min := coalesce(v_min,10); v_max := coalesce(v_max,15);
  v_ready := now() + (v_max || ' minutes')::interval;

  insert into public.orders (user_id, subtotal, phone, note, est_min, est_max, est_ready_at)
  values (auth.uid(), 0, p_phone, nullif(p_note,''), v_min, v_max, v_ready)
  returning id into v_order;

  for v_it in select * from jsonb_array_elements(p_items) loop
    v_cfg := v_it->'config';
    v_qty := coalesce((v_it->>'qty')::int, 1);
    if v_qty < 1 or v_qty > 50 then raise exception 'Invalid quantity'; end if;
    v_pid := v_cfg->>'productId';
    select base, name, available into v_base, v_name, v_avail from public.menu_products where id = v_pid;
    if v_base is null then raise exception 'Unknown product: %', v_pid; end if;
    if v_avail is false then raise exception '% is sold out', v_name; end if;
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
  return (select row_to_json(o) from
    (select id, order_no, subtotal, est_min, est_max, est_ready_at from public.orders where id = v_order) o);
end $$;
grant execute on function public.place_order(jsonb, text, text) to authenticated;

-- ---------- transition v2: optional cancel reason ----------
drop function if exists public.transition_order_status(uuid, text);
create or replace function public.transition_order_status(p_order uuid, p_next text, p_reason text default null)
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
     cancel_reason = case when p_next='cancelled' then left(nullif(p_reason,''),200) else cancel_reason end,
     making_at    = case when p_next='making'    then now() else making_at end,
     ready_at     = case when p_next='ready'     then now() else ready_at end,
     completed_at = case when p_next='completed' then now() else completed_at end
   where id = p_order;
end $$;
grant execute on function public.transition_order_status(uuid, text, text) to authenticated;
