-- Admin panel needs to show per-organization store/customer/subscription
-- counts (a real, spec-required capability), but platform admins had no
-- RLS visibility into these tables for orgs they aren't a member of —
-- only organizations/account_subscriptions/plans/profiles/audit_logs/
-- organization_members were admin-visible (Phase 2 + Phase 10). Same
-- minimal, read-only pattern as profiles_admin_select.

create policy stores_admin_select on public.stores
  for select using (private.is_platform_admin());

create policy customers_admin_select on public.customers
  for select using (private.is_platform_admin());

create policy subscriptions_admin_select on public.subscriptions
  for select using (private.is_platform_admin());

create policy products_admin_select on public.products
  for select using (private.is_platform_admin());
