-- Phase 13: cover the 13 foreign keys the Supabase performance advisor
-- flagged as unindexed, after production deployment. Purely additive.

create index if not exists account_subscriptions_organization_id_idx on public.account_subscriptions (organization_id);
create index if not exists account_subscriptions_plan_id_idx on public.account_subscriptions (plan_id);
create index if not exists activation_requests_account_subscription_id_idx on public.activation_requests (account_subscription_id);
create index if not exists activation_requests_organization_id_idx on public.activation_requests (organization_id);
create index if not exists activation_requests_reviewed_by_idx on public.activation_requests (reviewed_by);
create index if not exists audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index if not exists audit_logs_organization_id_idx on public.audit_logs (organization_id);
create index if not exists customers_store_id_idx on public.customers (store_id);
create index if not exists import_jobs_organization_id_idx on public.import_jobs (organization_id);
create index if not exists message_templates_organization_id_idx on public.message_templates (organization_id);
create index if not exists renewals_organization_id_idx on public.renewals (organization_id);
create index if not exists subscriptions_product_id_idx on public.subscriptions (product_id);
create index if not exists subscriptions_store_id_idx on public.subscriptions (store_id);
