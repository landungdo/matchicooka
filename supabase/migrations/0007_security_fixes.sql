-- ============================================================
-- 0007_security_fixes — CRITICAL. Run on production now.
-- Fixes: role self-escalation, direct review writes, view leakage,
-- state-transition race.
-- ============================================================

-- ---------- 1) block customers from changing their own role ----------
create or replace function public.prevent_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- role may only change if the *current* user is already an owner (i.e. via admin/migration).
  if new.role is distinct from old.role and not public.is_owner() then
    raise exception 'You cannot change your role';
  end if;
  return new;
end $$;
drop trigger if exists trg_prevent_role_change on public.profiles;
create trigger trg_prevent_role_change before update on public.profiles
  for each row execute function public.prevent_role_change();

-- ---------- 2) reviews only through submit_review() ----------
drop policy if exists reviews_upsert on public.reviews;
drop policy if exists reviews_update on public.reviews;
-- reviews_select stays (customer reads own, owner reads all)

-- ---------- 3) lock analytics views (respect RLS of caller) ----------
alter view public.v_order_timing    set (security_invoker = true);
alter view public.v_product_ratings set (security_invoker = true);
revoke all on public.v_order_timing    from anon;
revoke all on public.v_product_ratings from anon;

-- ---------- 4) state transition without race ----------
create or replace function public.transition_order_status(p_order uuid, p_next text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_cur text; v_rows int;
begin
  if not public.is_owner() then raise exception 'Owner only'; end if;
  select status into v_cur from public.orders where id = p_order for update;  -- lock the row
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
   where id = p_order and status = v_cur;   -- guard: only if still in the state we checked
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'Order changed, please refresh'; end if;
end $$;
revoke all on function public.transition_order_status(uuid, text, text) from public;
grant  execute on function public.transition_order_status(uuid, text, text) to authenticated;
