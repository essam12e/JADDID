-- ══════════════════════════════════════════════════════════════════════
-- Phase 15 — real subscriptions: plans, dates, and enforced limits
--
-- Until now `plans.active_customer_limit` / `stores_limit` / `users_limit`
-- were DISPLAYED on the pricing page and in the dashboard, but nothing
-- anywhere enforced them: a Free-tier org could register unlimited
-- customers and create unlimited stores. `account_subscriptions.expires_at`
-- existed as a column and was never written, so no subscription could
-- ever actually end.
--
-- Everything here is enforced in the DATABASE, not the UI, because every
-- mutation in this app is a browser calling PostgREST directly — a check
-- in React is a suggestion, not a limit.
--
-- Errors are raised with machine-readable codes (JADDID_*) so the client
-- can show a precise Arabic message without ever surfacing raw SQL.
-- ══════════════════════════════════════════════════════════════════════

-- ── effective limits for an org ───────────────────────────────────────
-- Falls back to the cheapest active plan when an org has no subscription
-- row yet (mid-onboarding), so a missing row can never mean "unlimited".
create or replace function private.org_limits(p_org_id uuid)
returns table (
  active_customer_limit integer,
  stores_limit integer,
  users_limit integer
)
language sql
stable
security definer
set search_path = ''
as $fn$
  select
    coalesce(pl.active_customer_limit, fallback.active_customer_limit),
    coalesce(pl.stores_limit,          fallback.stores_limit),
    coalesce(pl.users_limit,           fallback.users_limit)
  from (select 1) _
  left join public.account_subscriptions s on s.organization_id = p_org_id
  left join public.plans pl on pl.id = s.plan_id
  cross join lateral (
    select p.active_customer_limit, p.stores_limit, p.users_limit
    from public.plans p
    where p.is_active
    order by p.price
    limit 1
  ) fallback
  limit 1;
$fn$;

-- ── is this org allowed to transact right now? ────────────────────────
create or replace function private.require_active_org(p_org_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_status  public.account_status;
  v_expires timestamptz;
begin
  select o.status, s.expires_at
  into v_status, v_expires
  from public.organizations o
  left join public.account_subscriptions s on s.organization_id = o.id
  where o.id = p_org_id;

  if v_status is null then
    raise exception 'JADDID_ORG_NOT_FOUND';
  end if;

  -- Point 5 of the spec: nothing works until an admin approves.
  if v_status <> 'active' then
    raise exception 'JADDID_NOT_ACTIVATED';
  end if;

  if v_expires is not null and v_expires < now() then
    raise exception 'JADDID_SUBSCRIPTION_EXPIRED';
  end if;
end;
$fn$;

-- ── store count limit, as a trigger ───────────────────────────────────
-- A trigger rather than a check inside an RPC because `stores` is still
-- insertable straight over PostgREST; any limit that lives only in an
-- RPC is one fetch() away from being bypassed.
--
-- Deliberately does NOT call require_active_org: onboarding creates the
-- first store *before* the admin approves, which is the intended flow.
create or replace function private.enforce_store_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_limit integer;
  v_count integer;
begin
  select l.stores_limit into v_limit
  from private.org_limits(new.organization_id) l;

  if v_limit is null then
    return new; -- null means unlimited, by plan design
  end if;

  select count(*) into v_count
  from public.stores
  where organization_id = new.organization_id;

  if v_count >= v_limit then
    raise exception 'JADDID_LIMIT_STORES:%', v_limit;
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_enforce_store_limit on public.stores;
create trigger trg_enforce_store_limit
  before insert on public.stores
  for each row execute function private.enforce_store_limit();

-- ── team member limit, as a trigger ───────────────────────────────────
create or replace function private.enforce_user_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_limit integer;
  v_count integer;
begin
  select l.users_limit into v_limit
  from private.org_limits(new.organization_id) l;

  if v_limit is null then
    return new;
  end if;

  select count(*) into v_count
  from public.organization_members
  where organization_id = new.organization_id;

  if v_count >= v_limit then
    raise exception 'JADDID_LIMIT_USERS:%', v_limit;
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_enforce_user_limit on public.organization_members;
create trigger trg_enforce_user_limit
  before insert on public.organization_members
  for each row execute function private.enforce_user_limit();

-- ── how many customers currently count against the plan ───────────────
-- "Active customer" = has at least one live, unexpired subscription.
-- Archived customers and lapsed ones free up a slot, which is what makes
-- the number on the pricing page mean what a merchant expects.
create or replace function private.active_customer_count(p_org_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $fn$
  select count(distinct s.customer_id)::integer
  from public.subscriptions s
  join public.customers c on c.id = s.customer_id
  where s.organization_id = p_org_id
    and s.status = 'active'
    and s.end_date >= current_date
    and c.is_archived = false;
$fn$;

-- ── account overview for the dashboard ────────────────────────────────
-- One round trip for plan, dates, days-left and usage-vs-limits, instead
-- of the four separate PostgREST calls the dashboard would otherwise make.
create or replace function public.my_account_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_org_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'JADDID_AUTH_REQUIRED';
  end if;

  select m.organization_id into v_org_id
  from public.organization_members m
  where m.user_id = auth.uid()
  limit 1;

  if v_org_id is null then
    return jsonb_build_object('hasOrganization', false);
  end if;

  select jsonb_build_object(
    'hasOrganization', true,
    'organizationId',  o.id,
    'organizationName', o.name,
    'accountNumber',   o.account_number,
    'status',          o.status,
    'planName',        pl.name,
    'planSlug',        pl.slug,
    'price',           pl.price,
    'currency',        pl.currency,
    'billingPeriod',   pl.billing_period,
    'startedAt',       s.started_at,
    'expiresAt',       s.expires_at,
    'daysLeft',        case
                         when s.expires_at is null then null
                         else greatest(0, (s.expires_at::date - current_date))
                       end,
    'isExpired',       (s.expires_at is not null and s.expires_at < now()),
    'limits', jsonb_build_object(
      'activeCustomers', l.active_customer_limit,
      'stores',          l.stores_limit,
      'users',           l.users_limit
    ),
    'usage', jsonb_build_object(
      'activeCustomers', private.active_customer_count(o.id),
      'stores',          (select count(*) from public.stores st where st.organization_id = o.id),
      'users',           (select count(*) from public.organization_members mm where mm.organization_id = o.id)
    ),
    'features', coalesce(pl.features, '{}'::jsonb)
  )
  into v_result
  from public.organizations o
  left join public.account_subscriptions s on s.organization_id = o.id
  left join public.plans pl on pl.id = s.plan_id
  cross join lateral private.org_limits(o.id) l
  where o.id = v_org_id;

  return coalesce(v_result, jsonb_build_object('hasOrganization', false));
end;
$fn$;

revoke all on function public.my_account_overview() from public, anon;
grant execute on function public.my_account_overview() to authenticated;
