-- ══════════════════════════════════════════════════════════════════════
-- admin_review_activation_request — approving now means CHOOSING a plan
-- and a duration, which is what finally writes started_at/expires_at.
--
-- The old 3-argument version is dropped rather than left alongside: with
-- defaults on the new parameters, keeping both would make a 3-argument
-- call ambiguous and PostgreSQL would reject it at runtime.
-- ══════════════════════════════════════════════════════════════════════
drop function if exists public.admin_review_activation_request(uuid, text, text);

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

  v_new_account_status := (case p_decision when 'approved' then 'active' else 'rejected' end)::public.account_status;

  -- Resolve the plan: the one the admin picked, else whatever the org
  -- already had, else the cheapest active plan. Never leave it null —
  -- a null plan is what made limits unenforceable in the first place.
  if p_decision = 'approved' then
    v_plan_id := p_plan_id;

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

  update public.activation_requests
  set status = p_decision, note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id;

  insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id, metadata)
  values (
    v_org_id, auth.uid(),
    case when p_decision = 'approved' then 'activation.approved' else 'activation.rejected' end,
    'activation_request', p_request_id,
    jsonb_build_object('note', p_note, 'plan_id', v_plan_id, 'duration_months', p_duration_months)
  );

  select o.name into v_org_name from public.organizations o where o.id = v_org_id;
  select p.name into v_plan_name from public.plans p where p.id = v_plan_id;

  insert into public.notifications (organization_id, type, title, body)
  values (
    v_org_id,
    case when p_decision = 'approved' then 'activation_approved' else 'activation_rejected' end,
    case when p_decision = 'approved' then 'تم تفعيل حسابك' else 'تم رفض طلب التفعيل' end,
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

  perform private.enqueue_email(
    v_owner_email,
    case when p_decision = 'approved' then 'activation_approved' else 'activation_rejected' end,
    jsonb_build_object(
      'orgName',   v_org_name,
      'planName',  v_plan_name,
      'note',      p_note,
      'startedAt', v_started_at,
      'expiresAt', v_expires_at
    ),
    v_org_id,
    'activation_reviewed:' || p_request_id::text
  );
end;
$fn$;

revoke all on function public.admin_review_activation_request(uuid, text, text, uuid, integer) from public, anon;
grant execute on function public.admin_review_activation_request(uuid, text, text, uuid, integer) to authenticated;
