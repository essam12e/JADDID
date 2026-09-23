-- Phase 11: security hardening.
--
-- The audit found that `authenticated` has a blanket table-level
-- INSERT/UPDATE/DELETE grant on customers, subscriptions, and renewals
-- (from the original baseline schema) even though every legitimate
-- write path in the app goes exclusively through the atomic,
-- SECURITY DEFINER RPCs (register_sale, renew_subscription), which are
-- owned by `postgres` and are completely unaffected by revoking these
-- grants from `authenticated`. Confirmed by grep across the whole app:
-- nothing calls .from("customers"/"subscriptions"/"renewals").insert/
-- update/delete() directly.
--
-- With the grant left in place, RLS only restricts which ROWS a org
-- member can touch, not which COLUMNS -- exactly the same class of gap
-- the Phase 2 migration fixed for profiles.platform_role. A compromised
-- session or a malicious "staff"-role account could otherwise, with
-- nothing more than the browser's own Supabase client:
--   * set customers.lifetime_value / renewal_count to anything,
--     forging VIP status and the revenue numbers on the dashboard;
--   * set subscriptions.end_date / status / price_paid directly,
--     granting free extended access with no renewal row, no
--     idempotency key, and no audit_logs entry -- completely
--     bypassing the renewal trail the whole app is built around;
--   * insert a renewals row with an arbitrary previous/new end date
--     with no matching subscription update, corrupting the ledger.
-- Locking these three tables to SELECT-only for `authenticated` closes
-- all of that while changing no application behavior, since nothing
-- legitimate used the write grants anyway.
revoke insert, update, delete on public.customers from authenticated;
revoke insert, update, delete on public.subscriptions from authenticated;
revoke insert, update, delete on public.renewals from authenticated;

-- products: the store importer (/api/import) DOES write to this table
-- directly as the calling user's own session (not via a service-role
-- bypass), so it still needs INSERT and UPDATE -- but only ever touches
-- name/description/image_url/price/is_available (confirmed by reading
-- src/app/api/import/route.ts). Restricting UPDATE to the columns the
-- app actually edits stops a crafted request from reassigning a
-- product's organization_id/store_id to a different tenant/store, or
-- forging source_fingerprint to defeat re-import de-duplication.
revoke update on public.products from authenticated;
grant update (name, description, image_url, price, currency, source_url, renewal_url, is_available, is_archived, updated_at)
  on public.products to authenticated;

-- notifications: there is no legitimate client-side path that creates a
-- notification (the only writer is the admin_review_activation_request
-- RPC, owned by postgres, unaffected by this revoke) and the only
-- legitimate direct edit is a user marking their own org's notification
-- read, not rewriting its type/title/body/metadata to spoof a different
-- message.
revoke insert on public.notifications from authenticated;
revoke update on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;

-- activation_requests: only create_organization and
-- admin_review_activation_request (both postgres-owned RPCs) ever
-- write here. There was already no RLS policy letting a plain org
-- member INSERT or UPDATE this table directly (only
-- activation_requests_org_select for reading, and
-- activation_requests_admin_all for admins), so this grant was already
-- unreachable in practice -- removing it is redundant-grant cleanup,
-- not a behavior change, but keeps the table-level grants honest about
-- what's actually allowed.
revoke insert, update on public.activation_requests from authenticated;
