-- ══════════════════════════════════════════════════════════════════════
-- The pricing section has never worked for a logged-out visitor.
--
-- `plans_authenticated_select` was declared `TO authenticated`, so RLS
-- gave the `anon` role no policy at all on public.plans — the table
-- grant existed, the rows were invisible, and every visitor who was not
-- signed in saw "تعذّر تحميل الباقات حاليًا" on the landing page and on
-- /pricing. The bug was never in the fetching code, which is why moving
-- that code around did not fix it.
--
-- Prices are public marketing information; that a visitor can read them
-- is the entire point of the page. This adds the missing anon policy.
-- Policies are OR'd, so the existing authenticated and admin policies
-- are untouched, and inactive plans stay hidden from the public.
--
-- Verified from the anon role's own perspective before applying:
--   set local role anon; select count(*) from public.plans;  -> 3
-- ══════════════════════════════════════════════════════════════════════
create policy plans_public_select on public.plans
  for select to anon
  using (is_active = true);
