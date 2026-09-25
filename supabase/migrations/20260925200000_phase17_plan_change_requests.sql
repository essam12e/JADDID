-- Plan upgrades, as a request an admin reviews.
--
-- Picking a plan used to open WhatsApp and nothing else: no row, no
-- queue, nothing in the admin panel. The merchant's message was the
-- only record, and the admin had to reconstruct who asked for what.
--
-- Rather than a second table with a second review screen, this reuses
-- the activation pipeline — the reviewer already chooses a plan and a
-- duration there, which is exactly what approving an upgrade needs.

alter table public.activation_requests
  add column if not exists kind text not null default 'activation',
  add column if not exists requested_plan_id uuid references public.plans(id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'activation_requests_kind_check'
  ) then
    alter table public.activation_requests
      add constraint activation_requests_kind_check
      check (kind in ('activation', 'plan_change'));
  end if;
end $$;

create index if not exists idx_activation_requests_pending
  on public.activation_requests (status, created_at desc);

/**
 * The merchant's side: record the ask.
 *
 * One pending upgrade per organisation — asking again replaces what was
 * asked for instead of stacking rows the admin has to reconcile.
 */
create or replace function public.request_plan_change(p_plan_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_org uuid;
  v_sub uuid;
  v_existing uuid;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'JADDID_AUTH_REQUIRED';
  end if;

  -- Billing is the owner's decision, not any staff member's.
  select m.organization_id into v_org
  from public.organization_members m
  where m.user_id = auth.uid() and m.role in ('owner', 'admin')
  limit 1;

  if v_org is null then
    raise exception 'JADDID_ORG_NOT_FOUND';
  end if;

  if not exists (select 1 from public.plans where id = p_plan_id and is_active) then
    raise exception 'JADDID_PLAN_NOT_FOUND';
  end if;

  select id into v_existing
  from public.activation_requests
  where organization_id = v_org and kind = 'plan_change' and status = 'pending'
  limit 1;

  if v_existing is not null then
    update public.activation_requests
    set requested_plan_id = p_plan_id, created_at = now()
    where id = v_existing;
    return v_existing;
  end if;

  select id into v_sub
  from public.account_subscriptions
  where organization_id = v_org
  limit 1;

  insert into public.activation_requests
    (organization_id, account_subscription_id, kind, requested_plan_id, status)
  values (v_org, v_sub, 'plan_change', p_plan_id, 'pending')
  returning id into v_id;

  insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id, metadata)
  values (v_org, auth.uid(), 'plan_change.requested', 'activation_request', v_id,
          jsonb_build_object('requested_plan_id', p_plan_id));

  return v_id;
end;
$fn$;

revoke all on function public.request_plan_change(uuid) from public;
grant execute on function public.request_plan_change(uuid) to authenticated;

/**
 * The admin's side.
 *
 * The critical difference from an activation: rejecting an upgrade must
 * NOT set the organisation to 'rejected'. The merchant is a paying,
 * working customer who asked for a bigger plan; declining the ask is
 * not grounds for locking them out of the product they already have.
 */
create or replace function public.admin_review_activation_request(
  p_request_id uuid,
  p_decision text,
  p_note text default null,
  p_plan_id uuid default null,
  p_duration_months integer default 1
)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_org_id uuid;
  v_sub_id uuid;
  v_current_status text;
  v_kind text;
  v_requested_plan uuid;
  v_new_account_status public.account_status;
  v_org_name text;
  v_owner_email text;
  v_plan_id uuid;
  v_plan_name text;
  v_started_at timestamptz;
  v_expires_at timestamptz;
begin
  if not private.is_platform_admin() then
    raise exception 'access denied: platform admin required';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'decision must be approved or rejected';
  end if;

  if p_decision = 'approved' and (p_duration_months is null or p_duration_months <= 0) then
    raise exception 'duration_months must be a positive number';
  end if;

  select organization_id, account_subscription_id, status, kind, requested_plan_id
  into v_org_id, v_sub_id, v_current_status, v_kind, v_requested_plan
  from public.activation_requests
  where id = p_request_id
  for update;

  if v_org_id is null then
    raise exception 'activation request not found';
  end if;
  if v_current_status <> 'pending' then
    raise exception 'JADDID_ALREADY_REVIEWED';
  end if;

  if p_decision = 'approved' then
    -- The admin's pick wins; otherwise what the merchant asked for;
    -- otherwise what they already have; otherwise the cheapest plan.
    v_plan_id := coalesce(p_plan_id, v_requested_plan);

    if v_plan_id is null and v_sub_id is not null then
      select plan_id into v_plan_id from public.account_subscriptions where id = v_sub_id;
    end if;
    if v_plan_id is null then
      select id into v_plan_id from public.plans where is_active order by price limit 1;
    end if;

    if not exists (select 1 from public.plans where id = v_plan_id and is_active) then
      raise exception 'selected plan does not exist or is inactive';
    end if;

    v_started_at := now();
    v_expires_at := now() + make_interval(months => p_duration_months);
  end if;

  if v_kind = 'activation' then
    v_new_account_status := (case p_decision when 'approved' then 'active' else 'rejected' end)::public.account_status;

    update public.organizations
    set status = v_new_account_status, updated_at = now()
    where id = v_org_id;

    if v_sub_id is not null then
      update public.account_subscriptions
      set status     = v_new_account_status,
          plan_id    = coalesce(v_plan_id, plan_id),
          started_at = case when p_decision = 'approved' then v_started_at else started_at end,
          expires_at = case when p_decision = 'approved' then v_expires_at else expires_at end
      where id = v_sub_id;
    end if;

  elsif p_decision = 'approved' then
    -- An approved upgrade moves the plan and restarts the paid period.
    -- The account status is left exactly as it was.
    if v_sub_id is not null then
      update public.account_subscriptions
      set plan_id    = v_plan_id,
          started_at = v_started_at,
          expires_at = v_expires_at
      where id = v_sub_id;
    end if;
  end if;

  update public.activation_requests
  set status = p_decision, note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id;

  insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id, metadata)
  values (
    v_org_id, auth.uid(),
    v_kind || '.' || p_decision,
    'activation_request', p_request_id,
    jsonb_build_object('note', p_note, 'plan_id', v_plan_id, 'duration_months', p_duration_months)
  );

  select o.name into v_org_name from public.organizations o where o.id = v_org_id;
  select p.name into v_plan_name from public.plans p where p.id = v_plan_id;

  insert into public.notifications (organization_id, type, title, body)
  values (
    v_org_id,
    case
      when v_kind = 'plan_change' then
        case when p_decision = 'approved' then 'plan_changed' else 'plan_change_rejected' end
      when p_decision = 'approved' then 'activation_approved'
      else 'activation_rejected'
    end,
    case
      when v_kind = 'plan_change' then
        case when p_decision = 'approved' then 'تم تغيير باقتك' else 'ما تمت الموافقة على تغيير الباقة' end
      when p_decision = 'approved' then 'تم تفعيل حسابك'
      else 'تم رفض طلب التفعيل'
    end,
    coalesce(
      p_note,
      case when p_decision = 'approved'
           then 'باقة ' || coalesce(v_plan_name, '') || ' — تنتهي في ' || to_char(v_expires_at, 'YYYY-MM-DD')
           else null end
    )
  );

  select u.email into v_owner_email
  from public.organization_members m
  join auth.users u on u.id = m.user_id
  where m.organization_id = v_org_id and m.role = 'owner'
  limit 1;

  -- Only activations mail the merchant: the plan-change conversation is
  -- already happening on WhatsApp, and an "account activated" email to
  -- someone whose account was never off would be nonsense.
  if v_kind = 'activation' and v_owner_email is not null then
    perform private.enqueue_email(
      v_org_id,
      v_owner_email,
      case when p_decision = 'approved' then 'activation_approved' else 'activation_rejected' end,
      jsonb_build_object(
        'storeName', v_org_name,
        'planName', v_plan_name,
        'expiresAt', v_expires_at,
        'note', p_note
      ),
      'review:' || p_request_id::text
    );
  end if;
end;
$fn$;
