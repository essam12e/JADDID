-- Phase 10: admin panel.
--
-- Two RLS gaps needed to be closed before an admin panel could work:
-- platform admins already had "for all" access to organizations,
-- account_subscriptions, activation_requests, notifications, and plans
-- (Phase 2), but nothing let them read *other people's* profiles or
-- *other orgs'* memberships, so an admin list of "who owns this org"
-- would have silently returned nothing under RLS. Both new policies are
-- read-only and gated by the same private.is_platform_admin() check
-- everything else here uses -- in particular, this does NOT reopen the
-- Phase 2 fix that locked platform_role updates to service_role only.

create policy profiles_admin_select on public.profiles
  for select using (private.is_platform_admin());

create policy organization_members_admin_select on public.organization_members
  for select using (private.is_platform_admin());

-- Separately: Phase 2 created RLS policies for activation_requests and
-- notifications (activation_requests_org_select,
-- notifications_org_select/insert/update) but never issued the
-- underlying table-level GRANTs to `authenticated`, unlike every other
-- application table. A table-level GRANT is checked before RLS ever
-- gets evaluated, so both tables' policies have been unreachable (a
-- flat "permission denied for table" error, not a silent RLS-filtered
-- empty result) since Phase 2 -- discovered while testing this
-- migration's own admin RPC against the live database, not by reading
-- the code.
grant select, insert, update on public.activation_requests to authenticated;
grant select, insert, update on public.notifications to authenticated;

-- ── admin_review_activation_request ─────────────────────────────────────
-- Approving or rejecting a new organization touches three tables
-- (account_subscriptions, organizations, activation_requests) plus an
-- audit log entry and a notification. Doing that as separate
-- client-side updates risks a half-applied review (e.g. the
-- subscription activated but the organization's own status left at
-- pending_activation) if one call fails partway through. One RPC = one
-- transaction.
create or replace function public.admin_review_activation_request(
  p_request_id uuid,
  p_decision text, -- 'approved' | 'rejected'
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_sub_id uuid;
  v_current_status text;
  v_new_account_status public.account_status;
begin
  if not private.is_platform_admin() then
    raise exception 'access denied: platform admin required';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'decision must be approved or rejected';
  end if;

  select organization_id, account_subscription_id, status
  into v_org_id, v_sub_id, v_current_status
  from public.activation_requests
  where id = p_request_id
  for update;

  if v_org_id is null then
    raise exception 'activation request not found';
  end if;
  if v_current_status <> 'pending' then
    raise exception 'this request has already been reviewed';
  end if;

  -- Explicitly cast: a bare CASE-expression string literal assigned into
  -- an enum-typed target isn't always inferred automatically (the same
  -- class of issue found and fixed in the Phase 7 register_sale RPC).
  v_new_account_status := (case p_decision when 'approved' then 'active' else 'rejected' end)::public.account_status;

  update public.organizations
  set status = v_new_account_status, updated_at = now()
  where id = v_org_id;

  if v_sub_id is not null then
    update public.account_subscriptions
    set status = v_new_account_status,
        started_at = case when p_decision = 'approved' then now() else started_at end
    where id = v_sub_id;
  end if;

  update public.activation_requests
  set status = p_decision, note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id;

  insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id, metadata)
  values (
    v_org_id, auth.uid(),
    case when p_decision = 'approved' then 'activation.approved' else 'activation.rejected' end,
    'activation_request', p_request_id,
    jsonb_build_object('note', p_note)
  );

  insert into public.notifications (organization_id, type, title, body)
  values (
    v_org_id,
    case when p_decision = 'approved' then 'activation_approved' else 'activation_rejected' end,
    case when p_decision = 'approved' then 'تم تفعيل حسابك' else 'تم رفض طلب التفعيل' end,
    p_note
  );
end;
$$;

revoke all on function public.admin_review_activation_request(uuid, text, text) from public;
grant execute on function public.admin_review_activation_request(uuid, text, text) to authenticated;
