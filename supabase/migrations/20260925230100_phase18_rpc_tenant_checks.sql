-- Phase 18b — two missing tenant checks inside SECURITY DEFINER RPCs.
--
-- Both functions run as their owner, so RLS does not protect their arguments:
-- every id they accept has to be checked against the caller's organization by
-- hand. Each verified the object it was named after and trusted the rest.

-- ---------------------------------------------------------------------------
-- register_sale() validated p_store_id but never p_product_id, so a merchant
-- could attach another tenant's product to their own subscription. Low impact
-- (the UUID has to be guessed, and the row lands in the attacker's own org) but
-- it writes a cross-tenant reference the product's owner never consented to,
-- and any join on product name would surface it in the wrong dashboard.
create or replace function public.register_sale(
  p_store_id uuid, p_product_id uuid, p_customer_name text, p_customer_phone text,
  p_customer_email text, p_price_paid numeric, p_start_date date,
  p_duration_value integer, p_duration_unit text, p_notes text default null::text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_org_id uuid;
  v_customer_id uuid;
  v_end_date date;
  v_subscription_id uuid;
  v_interval interval;
  v_limit integer;
  v_active integer;
begin
  if auth.uid() is null then
    raise exception 'JADDID_AUTH_REQUIRED';
  end if;

  select organization_id into v_org_id from public.stores where id = p_store_id;
  if v_org_id is null or not private.is_org_member(v_org_id) then
    raise exception 'store not found or access denied';
  end if;

  -- The check this function was missing.
  if p_product_id is not null and not exists (
    select 1 from public.products pr
    where pr.id = p_product_id and pr.organization_id = v_org_id
  ) then
    raise exception 'product not found or access denied';
  end if;

  perform private.require_active_org(v_org_id);

  if p_duration_value is null or p_duration_value <= 0 then
    raise exception 'duration must be a positive number';
  end if;
  if p_price_paid is null or p_price_paid < 0 then
    raise exception 'price_paid must be zero or positive';
  end if;

  v_interval := case p_duration_unit
    when 'days' then make_interval(days => p_duration_value)
    when 'months' then make_interval(months => p_duration_value)
    when 'years' then make_interval(years => p_duration_value)
    else null
  end;
  if v_interval is null then
    raise exception 'duration_unit must be days, months, or years';
  end if;

  v_end_date := p_start_date + v_interval;

  select id into v_customer_id
  from public.customers
  where store_id = p_store_id and phone = p_customer_phone and is_archived = false
  limit 1;

  if v_customer_id is null
     or not exists (
       select 1 from public.subscriptions s
       where s.customer_id = v_customer_id
         and s.status = 'active'
         and s.end_date >= current_date
     )
  then
    select l.active_customer_limit into v_limit from private.org_limits(v_org_id) l;
    if v_limit is not null then
      v_active := private.active_customer_count(v_org_id);
      if v_active >= v_limit then
        raise exception 'JADDID_LIMIT_CUSTOMERS:%', v_limit;
      end if;
    end if;
  end if;

  if v_customer_id is null then
    insert into public.customers (organization_id, store_id, name, phone, email, notes)
    values (v_org_id, p_store_id, trim(p_customer_name), trim(p_customer_phone), nullif(trim(p_customer_email), ''), p_notes)
    returning id into v_customer_id;
  end if;

  insert into public.subscriptions (
    organization_id, store_id, product_id, customer_id,
    status, start_date, end_date, price_paid, currency, notes
  )
  values (
    v_org_id, p_store_id, p_product_id, v_customer_id,
    (case when v_end_date >= current_date then 'active' else 'expired' end)::public.subscription_status,
    p_start_date, v_end_date, p_price_paid, 'SAR', p_notes
  )
  returning id into v_subscription_id;

  update public.customers
  set lifetime_value = lifetime_value + p_price_paid,
      updated_at = now()
  where id = v_customer_id;

  insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id, metadata)
  values (v_org_id, auth.uid(), 'subscription.created', 'subscription', v_subscription_id,
          jsonb_build_object('customer_id', v_customer_id, 'product_id', p_product_id));

  return v_subscription_id;
end;
$function$;

-- ---------------------------------------------------------------------------
-- renew_subscription() resolved p_idempotency_key across ALL organizations
-- before establishing who the caller was, and returned the matching renewal id.
-- A guessed key therefore disclosed another tenant's renewal UUID. Scoping the
-- lookup to the caller's organization, after the membership check, closes that;
-- a guessed key from another org now hits the unique constraint and errors
-- rather than returning anything.
create or replace function public.renew_subscription(
  p_subscription_id uuid, p_duration_value integer, p_duration_unit text,
  p_amount numeric, p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_org_id uuid;
  v_customer_id uuid;
  v_previous_end date;
  v_new_end date;
  v_interval interval;
  v_renewal_id uuid;
  v_existing_renewal_id uuid;
begin
  if auth.uid() is null then
    raise exception 'JADDID_AUTH_REQUIRED';
  end if;

  select organization_id, customer_id, end_date
  into v_org_id, v_customer_id, v_previous_end
  from public.subscriptions
  where id = p_subscription_id
  for update;

  if v_org_id is null or not private.is_org_member(v_org_id) then
    raise exception 'subscription not found or access denied';
  end if;

  -- Idempotency replay, now scoped to the caller's own organization.
  select id into v_existing_renewal_id
  from public.renewals
  where idempotency_key = p_idempotency_key
    and organization_id = v_org_id;
  if v_existing_renewal_id is not null then
    return v_existing_renewal_id;
  end if;

  perform private.require_active_org(v_org_id);

  if p_duration_value is null or p_duration_value <= 0 then
    raise exception 'duration must be a positive number';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'amount must be zero or positive';
  end if;

  v_interval := case p_duration_unit
    when 'days' then make_interval(days => p_duration_value)
    when 'months' then make_interval(months => p_duration_value)
    when 'years' then make_interval(years => p_duration_value)
    else null
  end;
  if v_interval is null then
    raise exception 'duration_unit must be days, months, or years';
  end if;

  v_new_end := greatest(v_previous_end, current_date) + v_interval;

  insert into public.renewals (
    organization_id, subscription_id, previous_end_date, new_end_date,
    amount, currency, idempotency_key
  )
  values (
    v_org_id, p_subscription_id, v_previous_end, v_new_end,
    p_amount, 'SAR', p_idempotency_key
  )
  returning id into v_renewal_id;

  update public.subscriptions
  set end_date = v_new_end, status = 'active', updated_at = now()
  where id = p_subscription_id;

  update public.customers
  set renewal_count = renewal_count + 1,
      lifetime_value = lifetime_value + p_amount,
      updated_at = now()
  where id = v_customer_id;

  insert into public.audit_logs (organization_id, actor_id, action, target_type, target_id, metadata)
  values (v_org_id, auth.uid(), 'subscription.renewed', 'subscription', p_subscription_id,
          jsonb_build_object('renewal_id', v_renewal_id, 'new_end_date', v_new_end));

  return v_renewal_id;
end;
$function$;
