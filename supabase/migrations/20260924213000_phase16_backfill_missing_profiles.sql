-- ══════════════════════════════════════════════════════════════════════
-- One confirmed account existed in auth.users with no row in
-- public.profiles. That is a silent, total breakage for the user:
-- `private.is_platform_admin()` reads profiles, the dashboard reads
-- profiles, and `my_account_overview()` reads profiles — so the account
-- can sign in and then behave as if it half-exists. It also made the
-- user invisible to every admin query that joins profiles, which is how
-- it went unnoticed until someone went looking for that exact address.
--
-- `private.handle_new_user` covers new signups, but nothing ever healed
-- an account that slipped through before the trigger existed (or while
-- it failed). This backfills them, and is safe to re-run.
--
-- NOTE: the platform-admin grant itself is deliberately NOT here. A repo
-- migration that hardcodes an admin email would recreate a privileged
-- account on every fresh database, including any future staging clone.
-- That is a one-off data change, applied directly.
-- ══════════════════════════════════════════════════════════════════════
insert into public.profiles (id, full_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
