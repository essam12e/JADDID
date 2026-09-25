-- Fix a launch blocker found while re-testing the admin path after Phase 18.
--
-- The Phase 17 rewrite of admin_review_activation_request() calls
-- private.enqueue_email() with the organization id first:
--
--   private.enqueue_email(v_org_id, v_owner_email, template, payload, dedupe)
--
-- but the function is declared
--
--   private.enqueue_email(p_to text, p_template text, p_payload jsonb,
--                         p_org uuid, p_dedupe text)
--
-- so the call resolves to (uuid, text, text, jsonb, text) — no such function.
-- Postgres raises 42883 and the whole approval transaction rolls back.
--
-- The block is guarded by `v_kind = 'activation'`, so the plan_change branch
-- never reached it and tested clean. The effect was that NO new merchant could
-- be activated: every approval failed, and the organization stayed
-- pending_activation. Switching to named arguments so the order cannot silently
-- rot again.
create or replace function public.admin_review_activation_request(
  p_request_id uuid,
  p_decision text,
  p_note text default null::text,
  p_plan_id uuid default null::uuid,
  p_duration_months integer default 1
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
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
    -- Plan change: move the plan and restart the dates, leave account status alone.
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

  if v_kind = 'activation' and v_owner_email is not null then
    -- Named arguments: the positional call here was the bug.
    perform private.enqueue_email(
      p_to       => v_owner_email,
      p_template => case when p_decision = 'approved' then 'activation_approved' else 'activation_rejected' end,
      p_payload  => jsonb_build_object(
                      'storeName', v_org_name,
                      'planName',  v_plan_name,
                      'expiresAt', v_expires_at,
                      'note',      p_note
                    ),
      p_org      => v_org_id,
      p_dedupe   => 'review:' || p_request_id::text
    );
  end if;
end;
$function$;
