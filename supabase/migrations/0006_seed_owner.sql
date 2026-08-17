-- ============================================================
-- 0006_seed_owner — promote one account to owner.
-- Sign up that email in the app FIRST, then run this (edit the address).
-- ============================================================

insert into public.profiles (id, role, display_name)
select id, 'owner', 'Darren'
from auth.users
where email = 'darrendosj.work@gmail.com'
on conflict (id) do update set role = 'owner';
