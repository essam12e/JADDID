-- Phase 7: customers + subscriptions -- atomic RPCs for registering a
-- sale and renewing a subscription, so neither can leave the database in
-- a half-written state (e.g. a renewal row created but the subscription
-- not updated), and so a double-click can't create two customers, two
-- subscriptions, or two renewals.

-- ── register_sale ──────────────────────────────────────────────────────
-- Finds-or-creates the customer by (store_id, phone) so repeat buyers
-- don't get duplicated, then creates the subscription with a computed
-- end_date. Runs as one function call = one transaction.
create or replace function public.register_sale(
  p_store_id uuid,
  p_product_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_price_paid numeric,
  p_start_date date,
  p_duration_value integer,
  p_duration_unit text, -- 'days' | 'months' | 'years'
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_customer_id uuid;
  v_end_date date;
  v_subscription_id uuid;
  v_interval interval;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  select organization_id into v_org_id from public.stores where id = p_store_id;
  if v_org_id is null or not private.is_org_member(v_org_id) then
    raise exception 'store not found or access denied';
  end if;

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
$$;

revoke all on function public.register_sale(uuid, uuid, text, text, text, numeric, date, integer, text, text) from public;
grant execute on function public.register_sale(uuid, uuid, text, text, text, numeric, date, integer, text, text) to authenticated;

-- ── renew_subscription ─────────────────────────────────────────────────
-- Locks the subscription row so two concurrent/duplicate renewal
-- requests (e.g. a double-click) can't both apply; the idempotency_key
-- unique constraint on renewals is the second line of defense if the
-- client retries the same request. Extends from the later of the
-- subscription's current end_date or today -- a still-active
-- subscription keeps its paid-through date and simply extends forward
-- from it (the customer doesn't lose remaining paid time); an already
-- expired one starts the new period from today rather than silently
-- backdating it.
create or replace function public.renew_subscription(
  p_subscription_id uuid,
  p_duration_value integer,
  p_duration_unit text,
  p_amount numeric,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
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
    raise exception 'authentication required';
  end if;

  -- Idempotency: if this exact request already succeeded, return the
  -- same renewal id instead of creating a second one.
  select id into v_existing_renewal_id
  from public.renewals
  where idempotency_key = p_idempotency_key;
  if v_existing_renewal_id is not null then
    return v_existing_renewal_id;
  end if;

  select organization_id, customer_id, end_date
  into v_org_id, v_customer_id, v_previous_end
  from public.subscriptions
  where id = p_subscription_id
  for update; -- lock: a concurrent renewal on the same row waits, not races

  if v_org_id is null or not private.is_org_member(v_org_id) then
    raise exception 'subscription not found or access denied';
  end if;

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
$$;

revoke all on function public.renew_subscription(uuid, integer, text, numeric, text) from public;
grant execute on function public.renew_subscription(uuid, integer, text, numeric, text) to authenticated;
