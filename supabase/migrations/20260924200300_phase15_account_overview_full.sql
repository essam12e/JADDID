-- ══════════════════════════════════════════════════════════════════════
-- Phase 15 (cont.) — one call for the whole dashboard shell.
--
-- Adds the caller's display name, whether they are platform staff, and
-- the store list to the overview. That turns what used to be four
-- sequential PostgREST round trips in the dashboard layout (profiles,
-- membership, stores, plan) plus two more in the page (profiles again,
-- membership again) into a single RPC, memoised per request on the
-- Next.js side.
-- ══════════════════════════════════════════════════════════════════════
create or replace function public.my_account_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_org_id uuid;
  v_is_admin boolean;
  v_full_name text;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'JADDID_AUTH_REQUIRED';
  end if;

  select
    (p.platform_role = any (array['admin', 'support', 'super_admin'])),
    p.full_name
  into v_is_admin, v_full_name
  from public.profiles p
  where p.id = auth.uid();

  select m.organization_id into v_org_id
  from public.organization_members m
  where m.user_id = auth.uid()
  limit 1;

  if v_org_id is null then
    return jsonb_build_object(
      'hasOrganization', false,
      'isPlatformAdmin', coalesce(v_is_admin, false),
      'fullName', v_full_name
    );
  end if;

  select jsonb_build_object(
    'hasOrganization',  true,
    'isPlatformAdmin',  coalesce(v_is_admin, false),
    'fullName',         v_full_name,
    'organizationId',   o.id,
    'organizationName', o.name,
    'accountNumber',    o.account_number,
    'status',           o.status,
    'planName',         pl.name,
    'planSlug',         pl.slug,
    'price',            pl.price,
    'currency',         pl.currency,
    'billingPeriod',    pl.billing_period,
    'startedAt',        s.started_at,
    'expiresAt',        s.expires_at,
    'daysLeft',         case
                          when s.expires_at is null then null
                          else greatest(0, (s.expires_at::date - current_date))
                        end,
    'isExpired',        (s.expires_at is not null and s.expires_at < now()),
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
    'stores', coalesce((
      select jsonb_agg(jsonb_build_object('id', st.id, 'name', st.name) order by st.created_at)
      from public.stores st
      where st.organization_id = o.id
    ), '[]'::jsonb),
    'features', coalesce(pl.features, '{}'::jsonb)
  )
  into v_result
  from public.organizations o
  left join public.account_subscriptions s on s.organization_id = o.id
  left join public.plans pl on pl.id = s.plan_id
  cross join lateral private.org_limits(o.id) l
  where o.id = v_org_id;

  return coalesce(
    v_result,
    jsonb_build_object(
      'hasOrganization', false,
      'isPlatformAdmin', coalesce(v_is_admin, false),
      'fullName', v_full_name
    )
  );
end;
$fn$;

revoke all on function public.my_account_overview() from public, anon;
grant execute on function public.my_account_overview() to authenticated;
