-- Phase 2 hardening + completion for JADDID
-- Fixes a real privilege-escalation gap found in the pre-existing schema
-- (authenticated users could UPDATE their own profiles.platform_role),
-- closes the publicly-executable SECURITY DEFINER function, adds the
-- admin-role helper, activation_requests + notifications tables, and a
-- safe RPC path for org creation during onboarding (no direct INSERT
-- policy is granted on organizations/organization_members).

-- ── 1. Lock down platform_role: only service_role may change it ───────────
revoke update on table public.profiles from authenticated;
grant update (full_name, updated_at) on table public.profiles to authenticated;

create or replace function private.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.platform_role is distinct from old.platform_role
     and current_setting('request.jwt.claims', true)::jsonb ->> 'role' <> 'service_role' then
    raise exception 'platform_role cannot be changed by this role';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_role_self_escalation on public.profiles;
create trigger trg_prevent_role_self_escalation
  before update on public.profiles
  for each row execute function private.prevent_role_self_escalation();

-- ── 2. Close the publicly-executable SECURITY DEFINER event-trigger fn ────
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- ── 3. Auto-create a profile row when a new auth user is created ──────────
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ── 4. Admin-role helper (reads the now-locked-down platform_role) ────────
create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.platform_role in ('admin', 'support', 'super_admin')
  );
$$;

-- ── 5. activation_requests ─────────────────────────────────────────────
create table if not exists public.activation_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_subscription_id uuid references public.account_subscriptions(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.activation_requests enable row level security;

create policy activation_requests_org_select on public.activation_requests
  for select using (private.is_org_member(organization_id));

create policy activation_requests_admin_all on public.activation_requests
  for all using (private.is_platform_admin())
  with check (private.is_platform_admin());

-- ── 6. notifications ───────────────────────────────────────────────────
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy notifications_org_select on public.notifications
  for select using (private.is_org_member(organization_id));

create policy notifications_org_update on public.notifications
  for update using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));

create policy notifications_org_insert on public.notifications
  for insert with check (private.is_org_member(organization_id));

create index if not exists idx_notifications_org_created
  on public.notifications (organization_id, created_at desc);

-- ── 7. Admin visibility on tenant tables (read/manage across all orgs) ───
create policy organizations_admin_all on public.organizations
  for all using (private.is_platform_admin())
  with check (private.is_platform_admin());

create policy account_subscriptions_admin_all on public.account_subscriptions
  for all using (private.is_platform_admin())
  with check (private.is_platform_admin());

create policy audit_logs_admin_select on public.audit_logs
  for select using (private.is_platform_admin());

create policy plans_admin_all on public.plans
  for all using (private.is_platform_admin())
  with check (private.is_platform_admin());

-- ── 8. Secure onboarding RPC: create an organization + owner membership ──
-- No direct INSERT policy exists on organizations/organization_members;
-- this is the only path, and it always makes the caller the owner of a
-- brand-new org (never lets them attach themselves to someone else's).
create or replace function public.create_organization(
  org_name text,
  store_name text default null,
  store_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_plan_id uuid;
  v_sub_id uuid;
  v_store_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if org_name is null or length(trim(org_name)) = 0 then
    raise exception 'organization name is required';
  end if;

  insert into public.organizations (name, status)
  values (trim(org_name), 'pending_activation')
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, auth.uid(), 'owner');

  select id into v_plan_id from public.plans where slug = 'jaddid' and is_active = true limit 1;

  insert into public.account_subscriptions (organization_id, plan_id, status)
  values (v_org_id, v_plan_id, 'pending_activation')
  returning id into v_sub_id;

  insert into public.activation_requests (organization_id, account_subscription_id, status)
  values (v_org_id, v_sub_id, 'pending');

  if store_name is not null and length(trim(store_name)) > 0 then
    insert into public.stores (organization_id, name, url)
    values (v_org_id, trim(store_name), store_url)
    returning id into v_store_id;
  end if;

  insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id, metadata)
  values (v_org_id, auth.uid(), 'organization.created', 'organization', v_org_id,
          jsonb_build_object('store_id', v_store_id));

  return v_org_id;
end;
$$;

revoke all on function public.create_organization(text, text, text) from public;
grant execute on function public.create_organization(text, text, text) to authenticated;
