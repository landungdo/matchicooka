-- ============================================================
-- matchicooka — Step 3: customer reviews (per-item ratings)
-- Run once in Supabase → SQL Editor.
-- Customers can rate only their OWN order, and only once it's 'ready'.
-- Ratings are written through this function (order_items are owner-locked).
-- ============================================================

-- p_items example: [{"id":"<order_item_uuid>","rating":5},{"id":"...","rating":4}]
create or replace function public.submit_review(p_order uuid, p_comment text, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_overall integer;
begin
  -- must be the customer's own order, and it must be ready
  if not exists (
    select 1 from public.orders
    where id = p_order and user_id = auth.uid() and status = 'ready'
  ) then
    raise exception 'You can only review your own order once it is ready.';
  end if;

  -- write per-item ratings (only items that belong to this order & user)
  update public.order_items oi
     set item_rating = (e->>'rating')::int
    from jsonb_array_elements(p_items) e
   where oi.id = (e->>'id')::uuid
     and oi.order_id = p_order
     and oi.user_id = auth.uid()
     and (e->>'rating') is not null;

  -- overall = rounded average of the ratings provided
  select round(avg((e->>'rating')::numeric))::int
    into v_overall
    from jsonb_array_elements(p_items) e
   where (e->>'rating') is not null;

  if v_overall is null then
    raise exception 'Please give at least one star.';
  end if;

  insert into public.reviews (order_id, user_id, rating, comment, updated_at)
  values (p_order, auth.uid(), v_overall, nullif(p_comment, ''), now())
  on conflict (order_id)
  do update set rating = excluded.rating, comment = excluded.comment, updated_at = now();
end $$;

grant execute on function public.submit_review(uuid, text, jsonb) to authenticated;
