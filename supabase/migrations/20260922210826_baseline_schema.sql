-- Baseline schema for JADDID.
--
-- This reconstructs the schema that already existed on the JADDID Supabase
-- project (lyxgbeqxsmojshcljubk) before this migration file was written —
-- it was created directly against the project rather than tracked as a
-- migration, which violates the "migrations are the source of truth"
-- rule this project follows. This file exists so the schema is
-- reproducible from a clean project rather than depending on undocumented
-- manual changes. Verified against the live project's information_schema
-- and pg_policies on 2026-09-22; it should be re-run only against a fresh
-- database (there is no down-migration).

create extension if not exists pgcrypto;

-- ── Enums ──────────────────────────────────────────────────────────────
create type public.account_status as enum
  ('pending_activation', 'active', 'suspended', 'rejected', 'expired');

create type public.member_role as enum
  ('owner', 'admin', 'staff', 'viewer');

create type public.subscription_status as enum
  ('active', 'expired', 'cancelled');

create type public.import_status as enum
  ('queued', 'processing', 'completed', 'partial', 'failed');

-- ── Schemas ────────────────────────────────────────────────────────────
create schema if not exists private;

-- ── profiles (1:1 with auth.users) ────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  platform_role text not null default 'user'
    check (platform_role = any (array['user','admin','support','super_admin'])),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy profiles_self_select on public.profiles
  for select using (id = (select auth.uid()));

create policy profiles_self_update on public.profiles
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ── organizations (the billing/tenant root) ───────────────────────────
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  account_number bigint generated always as identity unique,
  status public.account_status not null default 'pending_activation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- ── organization_members ───────────────────────────────────────────────
create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'owner',
  primary key (organization_id, user_id)
);

alter table public.organization_members enable row level security;

-- ── is_org_member() helper (used throughout tenant RLS policies) ───────
create or replace function private.is_org_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.organization_members m
    where m.organization_id = org_id and m.user_id = (select auth.uid())
  )
$$;

create policy org_member_select on public.organizations
  for select using (private.is_org_member(id));

create policy members_org_select on public.organization_members
  for select using (private.is_org_member(organization_id));

-- ── plans (billing plans, editable without code changes) ──────────────
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  price numeric not null check (price >= 0),
  currency char(3) not null default 'SAR',
  billing_period text not null check (billing_period = any (array['month','year'])),
  active_customer_limit integer,
  stores_limit integer,
  users_limit integer,
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.plans enable row level security;

create policy plans_authenticated_select on public.plans
  for select using (is_active = true);

insert into public.plans (slug, name, price, currency, billing_period, active_customer_limit, stores_limit, users_limit, features, is_active)
values ('jaddid', 'JADDID', 49.00, 'SAR', 'month', 200, 1, 1,
        '{"imports": true, "analytics": true, "templates": true}'::jsonb, true);

-- ── account_subscriptions (JADDID's own subscription on an org) ───────
create table public.account_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid references public.plans(id),
  status public.account_status not null default 'pending_activation',
  started_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.account_subscriptions enable row level security;

create policy account_subscriptions_select on public.account_subscriptions
  for select using (private.is_org_member(organization_id));
create policy account_subscriptions_insert on public.account_subscriptions
  for insert with check (private.is_org_member(organization_id));
create policy account_subscriptions_update on public.account_subscriptions
  for update using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));

-- ── stores ──────────────────────────────────────────────────────────
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  url text,
  onboarding_step smallint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stores enable row level security;

create policy stores_select on public.stores
  for select using (private.is_org_member(organization_id));
create policy stores_insert on public.stores
  for insert with check (private.is_org_member(organization_id));
create policy stores_update on public.stores
  for update using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));

-- ── products ────────────────────────────────────────────────────────
create table public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  price numeric check (price >= 0),
  currency char(3) not null default 'SAR',
  source_url text,
  renewal_url text,
  source_fingerprint text,
  is_available boolean,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy products_select on public.products
  for select using (private.is_org_member(organization_id));
create policy products_insert on public.products
  for insert with check (private.is_org_member(organization_id));
create policy products_update on public.products
  for update using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));

-- ── customers ───────────────────────────────────────────────────────
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  phone text not null,
  email text,
  notes text,
  lifetime_value numeric not null default 0,
  renewal_count integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers enable row level security;

create policy customers_select on public.customers
  for select using (private.is_org_member(organization_id));
create policy customers_insert on public.customers
  for insert with check (private.is_org_member(organization_id));
create policy customers_update on public.customers
  for update using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));

-- ── subscriptions (a customer's subscription to a product) ─────────────
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  status public.subscription_status not null default 'active',
  start_date date not null,
  end_date date not null,
  price_paid numeric not null check (price_paid >= 0),
  currency char(3) not null default 'SAR',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy subscriptions_select on public.subscriptions
  for select using (private.is_org_member(organization_id));
create policy subscriptions_insert on public.subscriptions
  for insert with check (private.is_org_member(organization_id));
create policy subscriptions_update on public.subscriptions
  for update using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));

-- ── renewals (append-only history; never overwrite past subscriptions) ─
create table public.renewals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  previous_end_date date not null,
  new_end_date date not null,
  amount numeric not null check (amount >= 0),
  currency char(3) not null default 'SAR',
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

alter table public.renewals enable row level security;

create policy renewals_select on public.renewals
  for select using (private.is_org_member(organization_id));
create policy renewals_insert on public.renewals
  for insert with check (private.is_org_member(organization_id));
create policy renewals_update on public.renewals
  for update using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));

-- ── message_templates (WhatsApp reminder templates) ────────────────────
create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  body text not null,
  trigger_days integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.message_templates enable row level security;

create policy message_templates_select on public.message_templates
  for select using (private.is_org_member(organization_id));
create policy message_templates_insert on public.message_templates
  for insert with check (private.is_org_member(organization_id));
create policy message_templates_update on public.message_templates
  for update using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));

-- ── import_jobs (async store-import tracking) ──────────────────────────
create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  status public.import_status not null default 'queued',
  source_url text not null,
  total_count integer not null default 0,
  imported_count integer not null default 0,
  failed_count integer not null default 0,
  error_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.import_jobs enable row level security;

create policy import_jobs_select on public.import_jobs
  for select using (private.is_org_member(organization_id));
create policy import_jobs_insert on public.import_jobs
  for insert with check (private.is_org_member(organization_id));
create policy import_jobs_update on public.import_jobs
  for update using (private.is_org_member(organization_id))
  with check (private.is_org_member(organization_id));

-- ── audit_logs (admin actions; append-only) ────────────────────────────
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

create policy audit_org_select on public.audit_logs
  for select using (private.is_org_member(organization_id));

-- ── Indexes on frequently filtered/joined columns ──────────────────────
create index idx_organization_members_user on public.organization_members (user_id);
create index idx_stores_org on public.stores (organization_id);
create index idx_products_org on public.products (organization_id);
create index idx_products_store on public.products (store_id);
create index idx_customers_org on public.customers (organization_id);
create index idx_customers_store on public.customers (store_id);
create index idx_subscriptions_org on public.subscriptions (organization_id);
create index idx_subscriptions_customer on public.subscriptions (customer_id);
create index idx_subscriptions_product on public.subscriptions (product_id);
create index idx_subscriptions_status on public.subscriptions (status);
create index idx_subscriptions_end_date on public.subscriptions (end_date);
create index idx_renewals_org on public.renewals (organization_id);
create index idx_renewals_subscription on public.renewals (subscription_id);
create index idx_import_jobs_org on public.import_jobs (organization_id);
create index idx_audit_logs_org on public.audit_logs (organization_id);
