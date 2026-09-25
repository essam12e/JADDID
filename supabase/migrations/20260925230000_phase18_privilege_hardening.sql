-- Phase 18 — privilege hardening after a live RLS/permissions audit.
--
-- The audit impersonated a real merchant (platform_role = 'user', org owner)
-- inside a rolled-back transaction and exercised every write path reachable
-- from the browser. Tenant isolation, admin gating and audit-log integrity all
-- held. Four things did not.

-- ---------------------------------------------------------------------------
-- 1. CRITICAL — merchants could grant themselves any plan, for any duration.
--
-- account_subscriptions holds plan_id and expires_at: the paywall itself.
-- `authenticated` had full INSERT/UPDATE on every column, and the policies only
-- asked `is_org_member(organization_id)`. So any merchant could PATCH their own
-- row to the Business plan with expires_at 50 years out, or POST a second row,
-- entirely bypassing request_plan_change() and admin approval. Both were
-- confirmed to succeed against the live database.
--
-- Plan changes must only ever happen through request_plan_change() (merchant
-- asks) + admin_review_activation_request() (admin decides). Both are
-- SECURITY DEFINER and so are unaffected by these grants.
drop policy if exists account_subscriptions_insert on public.account_subscriptions;
drop policy if exists account_subscriptions_update on public.account_subscriptions;
revoke insert, update, delete on public.account_subscriptions from authenticated;

-- One subscription per organization. Without this, org_limits() does
-- `left join account_subscriptions ... limit 1` with no ORDER BY, so a second
-- injected row could win non-deterministically.
create unique index if not exists account_subscriptions_organization_id_key
  on public.account_subscriptions (organization_id);

-- ---------------------------------------------------------------------------
-- 2. TRUNCATE / TRIGGER / REFERENCES were granted to anon and authenticated.
--
-- TRUNCATE is not filtered by RLS — it wipes every tenant's rows at once — and
-- TRIGGER lets a role attach code to a table. Neither is reachable through
-- PostgREST today, so this is latent rather than exploitable, but it is the
-- kind of latent privilege that turns a future mistake into a breach.
do $$
declare t record;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('revoke truncate, trigger, references on public.%I from anon, authenticated', t.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Least privilege — write grants with no policy behind them.
--
-- RLS already denies these (no matching policy), and no client code uses them,
-- so revoking changes nothing today. It means a future policy written slightly
-- too loosely is not instantly exploitable: the grant has to be added too.
revoke insert, update, delete on public.organizations        from authenticated;
revoke insert, update, delete on public.plans                from authenticated;
revoke insert, update, delete on public.organization_members from authenticated;
revoke insert, update, delete on public.audit_logs           from authenticated;
revoke delete                 on public.products             from authenticated;

-- ---------------------------------------------------------------------------
-- 4. The self-escalation guard failed OPEN when no JWT claim was present.
--
-- It read request.jwt.claims ->> 'role' <> 'service_role'. With no claims set,
-- current_setting(..., true) is NULL, NULL <> 'service_role' is NULL, the IF
-- does not fire and the UPDATE is allowed. Keying off the database role instead
-- fails closed, and still lets an admin be promoted from the SQL editor.
--
-- Column grants on profiles already restrict `authenticated` to full_name and
-- updated_at, so platform_role is doubly protected.
create or replace function private.prevent_role_self_escalation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.platform_role is distinct from old.platform_role
     and current_user not in ('postgres', 'service_role', 'supabase_admin', 'supabase_auth_admin')
  then
    raise exception 'platform_role cannot be changed by this role';
  end if;
  return new;
end;
$function$;
