-- ============================================================
-- matchicooka — Step 1 security hardening
-- Run once in Supabase → SQL Editor.
-- Closes the hole where a customer could UPDATE their own order
-- (status/subtotal). Customers can now only CANCEL a not-yet-started
-- order, via a controlled function.
-- ============================================================

-- Orders: only the owner may update rows directly.
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
  for update using (public.is_owner());

-- Order items: only the owner may update (customer review will use an RPC later).
drop policy if exists items_update on public.order_items;
create policy items_update on public.order_items
  for update using (public.is_owner());

-- Customer self-service cancel — only while the order is still 'received'.
create or replace function public.cancel_my_order(p_order uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
     set status = 'cancelled'
   where id = p_order
     and user_id = auth.uid()
     and status = 'received';
  if not found then
    raise exception 'Order cannot be cancelled (not yours, or already being made).';
  end if;
end $$;

grant execute on function public.cancel_my_order(uuid) to authenticated;
