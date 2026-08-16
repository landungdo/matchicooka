-- ============================================================
-- matchicooka — lock all SECURITY DEFINER functions. Run once.
-- Removes default PUBLIC execute so clients can't call internal
-- helpers (e.g. next_order_no to bump the daily sequence).
-- ============================================================

-- helper used inside RLS policies for logged-in users
revoke all on function public.is_owner() from public;
grant  execute on function public.is_owner() to authenticated;

-- trigger-only helpers: no client should call these
revoke all on function public.next_order_no() from public;
do $$ begin revoke all on function public.set_order_no() from public; exception when undefined_function then null; end $$;
do $$ begin revoke all on function public.handle_new_user() from public; exception when undefined_function then null; end $$;

-- customer/owner RPCs: signed-in users only
revoke all on function public.transition_order_status(uuid, text, text) from public;
grant  execute on function public.transition_order_status(uuid, text, text) to authenticated;

revoke all on function public.submit_review(uuid, text, jsonb) from public;
grant  execute on function public.submit_review(uuid, text, jsonb) to authenticated;

revoke all on function public.cancel_my_order(uuid) from public;
grant  execute on function public.cancel_my_order(uuid) to authenticated;

-- place_order was already locked in supabase_place_order_final.sql; re-assert to be safe
revoke all on function public.place_order(jsonb, text, text, text) from public;
grant  execute on function public.place_order(jsonb, text, text, text) to authenticated;
