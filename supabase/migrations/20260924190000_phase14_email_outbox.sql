-- ══════════════════════════════════════════════════════════════════════
-- Phase 14 — transactional email delivery
--
-- Resend was configured (key + verified sender domain) since Phase 12 but
-- nothing ever called it: `getResendClient()` had zero consumers, so the
-- product sent no email at all.
--
-- The obvious fix — "send from the server action" — has nowhere to live:
-- this app has NO server actions. Every mutation is a client component
-- calling `supabase.rpc(...)` straight from the browser. Sending from
-- there would mean either shipping the Resend key to the client (never)
-- or exposing a client-callable send endpoint (spammable).
--
-- So: an outbox. The RPCs that already run server-side inside Postgres
-- enqueue a row in the same transaction as the state change, and a cron
-- route drains it with the service-role key. That gives us:
--   * no send without the state change actually committing
--   * a retry path when Resend is down, instead of a silently lost email
--   * idempotency via dedupe_key, so a double-click can't double-send
-- ══════════════════════════════════════════════════════════════════════

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  to_email text not null,
  template text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status = any (array['pending', 'sent', 'failed'])),
  attempts integer not null default 0,
  last_error text,
  -- NULLs don't collide under a UNIQUE index, so a null key simply means
  -- "no dedupe wanted" rather than "only one such row ever".
  dedupe_key text unique,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- The drain query is `where status='pending' and scheduled_at <= now()`.
create index if not exists idx_email_outbox_pending
  on public.email_outbox (status, scheduled_at)
  where status = 'pending';

-- RLS on with DELIBERATELY NO POLICIES: end users must never read this
-- table (it holds other tenants' addresses) nor write to it (that would
-- be a free spam relay through our verified domain). Only the
-- service-role key, which bypasses RLS, touches it — plus the SECURITY
-- DEFINER enqueue helper below, which runs as the owner.
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;

-- ── enqueue helper ────────────────────────────────────────────────────
-- Lives in `private`, which PostgREST does not expose, so it is callable
-- only from inside other functions — never over the API.
create or replace function private.enqueue_email(
  p_to text,
  p_template text,
  p_payload jsonb default '{}'::jsonb,
  p_org uuid default null,
  p_dedupe text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  -- A missing address is normal (an org whose owner row was removed), not
  -- an error worth aborting the caller's transaction over.
  if p_to is null or position('@' in p_to) = 0 then
    return;
  end if;

  insert into public.email_outbox (organization_id, to_email, template, payload, dedupe_key)
  values (p_org, lower(trim(p_to)), p_template, coalesce(p_payload, '{}'::jsonb), p_dedupe)
  on conflict (dedupe_key) do nothing;
end;
$fn$;

revoke all on function private.enqueue_email(text, text, jsonb, uuid, text) from public, anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- Patch create_organization: welcome + "we got your activation request".
-- Body is unchanged from Phase 2 except the two enqueue calls and the
-- extra locals they need.
-- ══════════════════════════════════════════════════════════════════════
create or replace function public.create_organization(
  org_name text,
  store_name text default null,
  store_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_org_id uuid;
  v_plan_id uuid;
  v_sub_id uuid;
  v_store_id uuid;
  v_account_number bigint;
  v_email text;
  v_full_name text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if org_name is null or length(trim(org_name)) = 0 then
    raise exception 'organization name is required';
  end if;

  insert into public.organizations (name, status)
  values (trim(org_name), 'pending_activation')
  returning id, account_number into v_org_id, v_account_number;

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

  select u.email into v_email from auth.users u where u.id = auth.uid();
  select p.full_name into v_full_name from public.profiles p where p.id = auth.uid();

  -- Keyed on the org id: onboarding can only produce one org per run, so a
  -- retried/double-submitted wizard cannot send a second welcome.
  perform private.enqueue_email(
    v_email, 'welcome',
    jsonb_build_object(
      'storeName', coalesce(nullif(trim(coalesce(store_name, '')), ''), trim(org_name)),
      'name', v_full_name
    ),
    v_org_id, 'welcome:' || v_org_id::text
  );

  perform private.enqueue_email(
    v_email, 'activation_submitted',
    jsonb_build_object('orgName', trim(org_name), 'accountNumber', v_account_number),
    v_org_id, 'activation_submitted:' || v_org_id::text
  );

  return v_org_id;
end;
$fn$;

revoke all on function public.create_organization(text, text, text) from public;
grant execute on function public.create_organization(text, text, text) to authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- Patch admin_review_activation_request: email the org owner the outcome.
-- Unchanged from Phase 10 except the owner lookup and the enqueue call.
-- ══════════════════════════════════════════════════════════════════════
create or replace function public.admin_review_activation_request(
  p_request_id uuid,
  p_decision text,
  p_note text default null
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
  v_plan_name text;
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

  select o.name into v_org_name from public.organizations o where o.id = v_org_id;

  select u.email into v_owner_email
  from public.organization_members m
  join auth.users u on u.id = m.user_id
  where m.organization_id = v_org_id and m.role = 'owner'
  limit 1;

  select p.name into v_plan_name
  from public.account_subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.id = v_sub_id;

  -- Keyed on the request, so the "already reviewed" guard above and this
  -- key both have to fail before an org could get two outcome emails.
  perform private.enqueue_email(
    v_owner_email,
    case when p_decision = 'approved' then 'activation_approved' else 'activation_rejected' end,
    jsonb_build_object('orgName', v_org_name, 'planName', v_plan_name, 'note', p_note),
    v_org_id,
    'activation_reviewed:' || p_request_id::text
  );
end;
$fn$;

revoke all on function public.admin_review_activation_request(uuid, text, text) from public;
grant execute on function public.admin_review_activation_request(uuid, text, text) to authenticated;

-- ══════════════════════════════════════════════════════════════════════
-- Renewal digest enqueue.
--
-- All of it stays in SQL on purpose: the owner's address lives in
-- `auth.users`, which PostgREST won't expose, so doing this from the
-- route would mean an admin-API lookup per organisation (an N+1 against
-- Auth). One SECURITY DEFINER function does it in a single round trip.
--
-- Executable ONLY by service_role — the cron route's key. No browser
-- session can reach it.
-- ══════════════════════════════════════════════════════════════════════
create or replace function public.enqueue_renewal_digests(p_days integer default 7)
returns integer
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_count integer := 0;
  r record;
begin
  for r in
    select
      s.organization_id,
      st.id   as store_id,
      st.name as store_name,
      u.email as owner_email,
      jsonb_agg(
        jsonb_build_object(
          'customerName', c.name,
          'productName',  p.name,
          'endDate',      s.end_date,
          'daysLeft',     (s.end_date - current_date)
        )
        order by s.end_date
      ) as items
    from public.subscriptions s
    join public.stores       st on st.id = s.store_id
    join public.customers    c  on c.id  = s.customer_id
    join public.products     p  on p.id  = s.product_id
    join public.organizations o on o.id  = s.organization_id
    join public.organization_members m
      on m.organization_id = s.organization_id and m.role = 'owner'
    join auth.users u on u.id = m.user_id
    where s.status = 'active'
      and o.status = 'active'
      -- Expiring within the window, plus a 30-day tail so something that
      -- lapsed last week still gets chased instead of vanishing silently.
      and s.end_date <= current_date + p_days
      and s.end_date >= current_date - 30
    group by s.organization_id, st.id, st.name, u.email
  loop
    perform private.enqueue_email(
      r.owner_email,
      'renewal_digest',
      jsonb_build_object('storeName', r.store_name, 'items', r.items),
      r.organization_id,
      'renewal_digest:' || r.store_id::text || ':' || current_date::text
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$fn$;

revoke all on function public.enqueue_renewal_digests(integer) from public, anon, authenticated;
grant execute on function public.enqueue_renewal_digests(integer) to service_role;
