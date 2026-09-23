# جَدِّد | JADDID

منصة SaaS عربية لإدارة اشتراكات وعملاء المتاجر: استيراد المنتجات، تسجيل
عمليات البيع، متابعة الاشتراكات، والتذكير بالتجديد عبر واتساب.

> **حالة المشروع:** قيد البناء التدريجي (Phase-by-Phase). راجع قسم "حالة
> المراحل" أدناه لمعرفة ما تم إنجازه فعليًا وما هو متبقٍّ. لا يوجد في هذا
> الملف أي ادّعاء بإنجاز وظيفة لم يتم بناؤها واختبارها بعد.

## Architecture

- **Framework:** Next.js (App Router) + TypeScript, strict mode.
- **Styling:** Tailwind CSS v4.
- **Data & Auth:** Supabase (Postgres + Auth + RLS). Multi-tenant model:
  `User → Organization → Stores → Products → Customers → Subscriptions → Renewals`.
- **Email:** Resend, server-side only.
- **Validation:** Zod on every server boundary (never trust client input alone).
- **Animation:** GSAP, respecting `prefers-reduced-motion`.

```
src/
  app/            Next.js routes (App Router)
  components/     UI components
  lib/
    supabase/     client.ts (browser), server.ts (SSR, RLS-scoped),
                  admin.ts (service role — server-only, privileged)
    resend.ts     server-only email client
    validations/  Zod schemas
    domain/       domain logic (status engine, thresholds, etc.)
  types/
public/
  brand/          JADDID logo + motion assets
```

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

## Environment variables

See `.env.example`. Required for any real functionality:

| Variable | Where it's used | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | public, RLS-enforced |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | bypasses RLS — never expose |
| `RESEND_API_KEY` | server only | transactional email |
| `RESEND_FROM_EMAIL` | server only | must be on a verified Resend domain |
| `NEXT_PUBLIC_APP_URL` | server + email templates | no `localhost` in production |

**Never commit `.env.local`.** It's git-ignored; double-check before pushing.

## Supabase setup

Provisioned as its own isolated project (`JADDID`, id `lyxgbeqxsmojshcljubk`,
under the same Supabase organization as other unrelated projects — not
sharing tables, keys, or data with them).

Schema: `profiles`, `organizations`, `organization_members`, `plans`,
`account_subscriptions`, `stores`, `products`, `customers`,
`subscriptions`, `renewals`, `message_templates`, `import_jobs`,
`audit_logs`, `activation_requests`, `notifications`. Multi-tenant model:
`auth.users → profiles`, `organizations → organization_members` (roles:
owner/admin/staff/viewer), then stores/products/customers/subscriptions/
renewals all scoped by `organization_id`.

RLS is enabled on every table. Tenant isolation policies all route through
a single `private.is_org_member(org_id)` helper. Admin-wide read/write
(for the admin dashboard) routes through `private.is_platform_admin()`,
which reads `profiles.platform_role` — a column now locked down (see
below) so it cannot be self-escalated from the client.

A real privilege-escalation bug was found and fixed while auditing the
pre-existing schema: the `profiles_self_update` RLS policy allowed a user
to update their own row, and Postgres RLS does not restrict *which*
columns an UPDATE touches — so any signed-in user could have set their
own `platform_role` to `admin` directly via the REST API. Fixed by
revoking table-level UPDATE from `authenticated` and re-granting it only
on `full_name`/`updated_at`, plus a defensive trigger that rejects any
`platform_role` change not made by the service role.

Organization creation (onboarding) goes through a single `SECURITY
DEFINER` RPC, `create_organization()`, rather than direct table INSERTs —
there is deliberately no INSERT policy on `organizations` or
`organization_members`, so the only way to create one is through that
function, which always makes the caller the owner of a brand-new org.

Migrations live in `supabase/migrations/` and are re-runnable against a
fresh project:
- `20260922210826_baseline_schema.sql` — reconstruction of the schema as
  it already existed on the live project before this repo tracked
  migrations (it had been created directly against the project outside
  of version control — documented here rather than left as an
  undocumented manual change).
- `20260922233113_phase2_hardening_and_completion.sql` — the
  privilege-escalation fix above, the admin-role helper, the
  `activation_requests`/`notifications` tables, and the onboarding RPC.

**Verified:** applied both migrations to the live project via the
Supabase migration tool; re-ran the security advisor after — the
self-escalation path is closed. Two advisor items remain and are
tracked, not hidden: `create_organization` is (intentionally)
callable by signed-in users — that is its purpose, since it is the only
onboarding path and is scoped to creating a brand-new org for the caller
only; and "leaked password protection" is off in Auth settings — that is
a dashboard toggle with no exposed management-API tool in this session,
so it is not yet enabled (see "Remaining / blockers").

**Not yet verified:** actual cross-tenant isolation with two real user
accounts (User A cannot read/write User B's data) — this needs Phase 3
(auth) to exist first, and is planned as a mandatory test before Phase 14
sign-off, per the project's own testing requirements.

## Resend setup

A sending domain is required and does not yet exist for JADDID (the one
domain currently verified on this Resend account, `auth.trend-box.online`,
belongs to a different project and is intentionally not reused here per
project-isolation rules). Email sending will not work until a real
domain is added and DNS-verified.

## Authentication

Built: signup, login, email verification (both the OTP-code screen and a
link-based `/auth/callback` fallback), forgot/reset password, logout, and
middleware that refreshes the session on every request and gates
`/dashboard`, `/onboarding`, and `/admin` server-side (not just by hiding
a link) with a redirect back to the originally-requested page after
login.

**What "email verification" actually depends on right now:** Supabase's
default email template sends a confirmation *link*, not a 6-digit code —
the OTP screen only works once the "Confirm signup" template in the
Supabase dashboard is edited to include `{{ .Token }}`. No management-API
tool was available in this session to make that change, so today the
link (via `/auth/callback`) is what actually works; the OTP UI is built
and wired to `verifyOtp`/`resend` but unverified until that template
change is made.

**What "sending the email" depends on:** until a real domain exists for
JADDID and is configured as custom SMTP (Resend) in Supabase Auth
settings, Supabase falls back to its own built-in email sender, which is
rate-limited and not meant for production. Password-reset and
confirmation emails will not reliably reach real users until that's set
up (see Resend setup above and the domain discussion in project history).

**User enumeration:** the app layer shows a generic message on both
signup failure and forgot-password submission regardless of whether the
email exists. Supabase's own API can still be more specific in some
signup-failure cases at the network level — that residual gap is
inherited from the platform, not hidden here.

**Not yet built:** custom rate limiting / brute-force protection beyond
whatever Supabase Auth enforces by default (no separate limiter — e.g.
Redis-backed — has been added); OTP abuse protection beyond Supabase's
own attempt/expiry limits; "remember me" does not currently change
session persistence (Supabase's SSR cookie session behaves the same
either way) — the checkbox exists in the UI but is not yet wired to a
real difference in behavior.

**Verified in this environment:** `npm run build`, `tsc --noEmit`, and
`eslint` all pass; middleware correctly 307-redirects an unauthenticated
request to `/dashboard` to `/login?next=/dashboard` (checked with curl
against a local production server). **Not verified in this
environment:** an actual signup/login/reset round-trip against the live
Supabase Auth service — this sandbox's network egress blocks direct
HTTPS to `*.supabase.co` (only the Supabase MCP tool's database access
works here, which doesn't exercise the Auth/GoTrue HTTP API). This needs
to be tested either after deployment to Vercel or by running the app
locally on a normal network.

## Landing page + onboarding

The full marketing page (`/`) is built: hero with the store-URL prompt,
how-it-works, product import / customers / subscriptions / WhatsApp
templates / renewal-opportunities feature sections, a dashboard preview
(explicitly labeled as illustrative numbers, not live data), pricing
(read from the `plans` table, not hard-coded), FAQ, CTA, and footer. GSAP
scroll-reveal is used sparingly and only when
`prefers-reduced-motion` is not set; it degrades to a plain static render
otherwise.

Onboarding (`/onboarding`) is a 6-step wizard (welcome → store name →
store URL → import → review → dashboard) that persists progress on the
new `stores.onboarding_step` column, so leaving and returning resumes at
the right step instead of restarting. Store creation goes through the
`create_organization` RPC added in Phase 2 — no direct table inserts from
the client. The "import products" step does **not** pretend the importer
works: it explicitly says that feature is still being built (Phase 5)
and lets the user continue and add products manually later, per the
project's rule against faking a working integration.

**A real gap found and fixed while testing this phase:** the `plans`
table had RLS correctly restricting rows to `is_active = true`, but no
table-level `SELECT` grant to the `anon` Postgres role at all — meaning
the public pricing section (which unauthenticated visitors must be able
to see) could never actually read it, regardless of the RLS policy. Fixed
with `grant select on table public.plans to anon;` (migration
`grant_anon_select_plans`, applied to the live project).

**Confirmed in this environment:** this sandbox's network egress blocks
outbound HTTPS to `*.supabase.co` entirely (same restriction hit in
Phase 3) — a local production server here can build and serve every
page, but any page or action that actually queries Supabase from server
or browser code (the pricing section's DB read, the onboarding wizard's
RPC/update calls) fails at request time with "Host not in allowlist,"
not with an application bug. That failure was how the `anon` grant gap
above was actually caught — the pricing section correctly showed its
honest fallback message instead of fake data. The onboarding wizard's
Supabase calls are implemented the same way as the now-working Phase 2/3
code but have not been exercised end-to-end here for the same network
reason; this needs verification after deployment to Vercel (which has
normal internet access) or on a machine with an unrestricted network.

## Store importer (Phase 5)

Architecture: `src/lib/importer/` — a `StoreImporter` interface
(`types.ts`), one adapter per source (`adapters/shopify.ts` uses
Shopify's public `/products.json` endpoint; `adapters/jsonld.ts` reads
schema.org `Product` structured data most storefronts already publish
for SEO), and an orchestrator (`index.ts`) that tries each adapter in
order and returns which one worked or exactly why every one failed.
Adding a new platform means writing one more adapter class — nothing
else changes, per the project's requirement that this not need a
rewrite later.

**SSRF protection** (`ssrf.ts`) is the part of this feature that matters
most, since it accepts a URL from the user and fetches it server-side.
It blocks non-http(s) schemes, literal private/loopback/link-local/
cloud-metadata IPs (including `169.254.169.254`), and — importantly —
resolves DNS and checks *every* returned address before fetching, which
is what stops DNS-rebinding (a public hostname that resolves to a
private IP). Redirects are never auto-followed; each hop is re-validated
through the same check. **This was actually tested, not just written**:
a standalone script exercised it against `169.254.169.254`, `127.0.0.1`,
`localhost`, private RFC1918 ranges, `::1`, an IPv6 link-local address,
a non-http(s) scheme, and — the real DNS-rebinding case —
`localtest.me`, a public domain that resolves to `127.0.0.1`; all were
correctly blocked, and ordinary public hosts were correctly allowed.

**Duplicate detection**: each extracted product carries a `fingerprint`
(a hash of the source-specific stable id — Shopify's numeric product id,
or the JSON-LD product URL) stored in `products.source_fingerprint`. A
re-import matches on `(store_id, fingerprint)`: new products are
inserted, changed ones are updated, and unchanged ones are left alone
and reported separately — never duplicated.

**Import jobs**: `POST /api/import` creates an `import_jobs` row
(`processing` → `completed`/`partial`/`failed`), runs synchronously
within the request (no background queue/worker exists yet — this is a
scaling limitation worth flagging: fine for a small-to-medium catalog
within a serverless function's time limit, not a real async job system
for very large catalogs), and reports exact counts (`imported`,
`unchanged`, `failed`) rather than a blanket success/failure. A failed
extraction shows the real reason from each adapter attempted, in
Arabic, rather than pretending it worked.

**Manual add fallback**: onboarding step 4 always offers "add a product
manually" — the importer failing (or the merchant not giving a store URL
at all) never leaves them stuck, per the project's requirement.

**What has and hasn't been verified:** the SSRF guard was tested for
real, against real inputs, with real results shown above — not assumed.
The two adapters' field-mapping/parsing logic was verified against
realistic sample payloads (a Shopify-shaped JSON response, and an HTML
page with both a valid and a deliberately malformed JSON-LD block,
confirming one bad block doesn't fail the whole extraction). **Not
verified:** an actual end-to-end import against a real, live store —
this sandbox's network egress blocks outbound HTTPS to arbitrary
internet hosts entirely (confirmed directly: `curl` to `example.com`
itself was rejected by the egress policy, not just Supabase). This is
the same class of environment limitation as Phases 3 and 4, just
covering more of the internet this time. It needs testing against a
real store once deployed or on an unrestricted network — no adapter has
been marked "PASS" against a live target because it hasn't run against
one yet.

## Products (Phase 6)

`/dashboard/products` lists the store's products as cards (image with a
broken-image fallback, name, price, per-product counts of customers /
active subscriptions / expiring-soon-within-7-days computed from real
`subscriptions` rows, not placeholders), plus "add product" and
"re-import" entry points, matching the empty state copy specified for
zero products.

Manual add/edit (`/dashboard/products/new`, `/dashboard/products/[id]/edit`)
share one form and one Zod schema, with URL validation on the image,
renewal, and source-URL fields (the Renewal Link Vault field from the
spec). Re-import (`/dashboard/products/import`) reuses the Phase 5
`/api/import` endpoint against the store's saved URL and shows the same
honest imported/unchanged/failed breakdown as onboarding.

Each product card includes "تسجيل عملية بيع" and "العملاء" buttons as
the spec requires, but since the customers/subscriptions data model
work is Phase 7 and doesn't exist yet, both routes are real pages that
say so plainly and link back — not dead links, and not forms that
silently discard input. They'll become the real flows once Phase 7
lands.

**Verified:** build, `tsc --noEmit`, `eslint` all clean; every new route
under `/dashboard/products/*` correctly 307-redirects to `/login` when
unauthenticated (confirmed with curl against a local production
server), same as the rest of `/dashboard`. **Not verified:** the actual
rendered page with real product data and a signed-in session — that
needs a live Supabase connection this sandbox's network can't reach
(same limitation as Phases 3-5), so the products list, counts, and
image-fallback behavior are correct by code review and consistent with
the schema, not confirmed by looking at a real logged-in screenshot yet.

## Customers + subscriptions (Phase 7)

Two atomic, `SECURITY DEFINER` Postgres RPCs replace the honest stub
pages from Phase 6:

- **`register_sale(...)`** — finds an existing customer by
  `(store_id, phone)` or creates one, creates the subscription with an
  `end_date` computed from `start_date + duration`, adds the payment to
  the customer's `lifetime_value`, and writes an audit log entry. All in
  one transaction, so a failure partway through leaves nothing behind.
- **`renew_subscription(...)`** — takes a client-generated idempotency
  key; if a renewal with that key already exists it returns the same
  renewal id instead of creating a duplicate (protects against a
  double-click or a retried network request). It locks the subscription
  row (`SELECT ... FOR UPDATE`) before reading its `end_date`, so two
  concurrent renewals on the same subscription can't race. The new
  `end_date` extends from `greatest(previous_end_date, today)`, so a
  still-active subscription keeps its remaining paid time and an
  already-expired one starts the new period from today rather than
  silently backdating it.

Both follow the exact pattern established for `create_organization` in
Phase 2: `set search_path = ''`, every table reference schema-qualified,
`revoke all from public` + `grant execute to authenticated` only.

`src/lib/domain/subscriptionStatus.ts` is the Customer Status Engine
from the spec (sections 25-26) as pure, unit-testable functions with
configurable thresholds — no DB or `Date.now()` baked in unless the
caller omits `now`:

- **Subscription Status** (`active` / `expiring_soon` / `expires_today`
  / `expired` / `at_risk`) is derived from `end_date` alone, with a
  7-day "expiring soon" window and a 3-day "at risk" grace period after
  expiry before it's counted as fully `expired`.
- **Customer Value Status** (`normal` / `vip`) is derived from
  `renewal_count` alone (≥3 renewals = VIP), and is intentionally never
  mixed with subscription status — a customer can be VIP with an
  expired subscription, and vice versa.

New pages: `/dashboard/products/[id]/sell` (real sale form, no longer a
stub) and `/dashboard/products/[id]/customers` (real per-product
customer/subscription table) replace the Phase 6 placeholders;
`/dashboard/customers` (search by name/phone) and
`/dashboard/customers/[id]` (profile with subscriptions, renewal
history, and an inline renew form with duration presets) are new.

**Verified — real, not assumed:** both RPCs were exercised against the
live database with real SQL, inside a transaction that was rolled back
afterward so nothing was left in the production tables (confirmed
row counts were 0 across `organizations`/`customers`/`subscriptions`/
`renewals` before and after). This caught and fixed a real bug: the
`status` column is a Postgres enum, and the original migration's `CASE`
expression needed an explicit cast, which the enum-typed column
otherwise rejected — this was found by actually running the function,
not just reading the code. Confirmed in that test: a sale correctly
creates a customer + subscription and updates `lifetime_value`; the
same customer buying a second product is matched by phone rather than
duplicated; calling `renew_subscription` twice with the same
idempotency key creates exactly one renewal row (not two) and applies
the update exactly once; a negative duration and a negative amount are
both rejected. The security advisor was re-run after applying the
migration and shows no new issues beyond the same class of
intentional, expected `SECURITY DEFINER`-callable-by-`authenticated`
warning that `create_organization` already carries. `next build`,
`tsc --noEmit`, and `eslint` are all clean, and the new
`/dashboard/customers*` and `/dashboard/products/[id]/sell` routes
307-redirect to `/login` when unauthenticated (confirmed with curl).
**Not verified:** the actual rendered pages through a real signed-in
browser session — that needs a live Supabase connection this sandbox's
network can't reach (same limitation as Phases 3-6), so the UI's
correctness rests on the database-level test above plus code review
against the same schema, not on a logged-in screenshot.

## Renewals, reminders, and WhatsApp templates (Phase 8)

The spec is explicit that reminders are never sent automatically —
there is no WhatsApp Business API integration here, no message ever
leaves without a human reading it and pressing send inside WhatsApp
themselves. Everything in this phase is pure link-building:

- **`src/lib/domain/whatsapp.ts`** — `renderTemplate()` substitutes
  `{{customer_name}}`, `{{product_name}}`, `{{remaining_days}}`,
  `{{end_date}}`, `{{renewal_url}}`, and `{{store_name}}` tokens into a
  template body (an unrecognized token is left untouched rather than
  silently dropped, so a typo in a template is visible instead of
  hidden); `normalizePhoneForWhatsApp()` handles the `0P`, `+966P`,
  `00966P`, and bare 9-digit input formats a merchant is likely to have
  saved a Saudi customer's number in; `buildWhatsAppLink()` produces the
  `https://wa.me/<digits>?text=<encoded message>` link that opens
  WhatsApp with the message already typed in.
- **`/dashboard/templates`** — full CRUD for message templates
  (name, body, optional `trigger_days` used to auto-pick the closest
  template for a given subscription, active/inactive toggle, real
  delete). The baseline schema had `select`/`insert`/`update` RLS
  policies for `message_templates` but no `delete` policy, so templates
  could be created and edited but never removed; this phase adds
  `message_templates_delete` (same `is_org_member` check as the other
  three).
- **`/dashboard/renewals`** — the "who needs a reminder today" view:
  every subscription in the org whose computed status (from the Phase 7
  status engine) is `expiring_soon`, `expires_today`, `expired`, or
  `at_risk`, soonest-expiring first. Each row picks the org's active
  template whose `trigger_days` is closest to how many days are
  actually left, lets the merchant switch to a different active
  template if more than one exists, and renders a "فتح واتساب" link
  that opens the pre-filled message. Clicking it only marks a
  non-persistent "opened" note in that browser tab — Phase 8
  deliberately does not add a reminder-sent log table, so no claim is
  made anywhere that a reminder was actually delivered.

**Verified — real, not assumed:** `renderTemplate`, `buildWhatsAppLink`,
and `normalizePhoneForWhatsApp` were compiled with `esbuild` and run
directly under Node against concrete inputs (all four phone formats,
an unknown-token template, URL-encoding of the message) rather than
just read for correctness — outputs matched expectations exactly,
including that an unrecognized `{{token}}` is preserved rather than
silently removed. The status-engine thresholds (7-day expiring-soon
window, 3-day at-risk grace period, VIP at 3 renewals) were re-verified
the same way against fixed dates. The new `message_templates_delete`
migration was applied to the live database and exercised inside a
rolled-back transaction: inserting a template into the caller's own
org succeeds, inserting into an org the caller doesn't belong to is
rejected by RLS, and deleting a template the caller owns succeeds — row
counts were 0 across `organizations`/`message_templates` both before
and after the test, confirming nothing was left behind. The security
advisor was re-run after applying the migration: no new issues beyond
the same class of expected `SECURITY DEFINER` warning already present
for `create_organization` and the Phase 7 RPCs. `next build`,
`tsc --noEmit`, and `eslint` are all clean, and the new
`/dashboard/renewals`, `/dashboard/templates`, and
`/dashboard/templates/new` routes correctly 307-redirect to `/login`
when unauthenticated (confirmed with curl). **Not verified:** the
rendered pages through a real signed-in browser session, and whether a
`wa.me` link built here actually opens WhatsApp with the message
pre-filled on a real phone — both need either a live Supabase
connection or an actual WhatsApp client, neither of which this
sandbox's network can reach (same limitation as every phase since 3).

## Dashboard + analytics (Phase 9)

`/dashboard` replaces the Phase 3-8 placeholder with real aggregates
computed from the same data every other page already reads — nothing
here is a separate/duplicated source of truth:

- **`src/lib/domain/analytics.ts`** — `computeDashboardStats()` and
  `computeMonthlyRevenue()`, pure functions over rows the page already
  fetched (same pattern as the status engine and the WhatsApp domain
  logic). Subscription status is always recomputed from `end_date` via
  the Phase 7 status engine rather than trusted from the stored
  `status` column, because that column is only written at creation/
  renewal time and would otherwise silently go stale the moment a
  subscription's paid period lapses without a renewal.
- **KPI cards** — total customers, active subscriptions (active +
  expiring-soon + expires-today), a "تحتاج متابعة" count that links
  straight to `/dashboard/renewals`, VIP customer count, and this
  month's revenue (sales + renewals whose own timestamp falls in the
  current calendar month — not a running balance).
- **Revenue chart** — a dependency-free bar chart
  (`src/components/dashboard/RevenueChart.tsx`, plain divs, no charting
  library) over the last 6 calendar months.
- **Status breakdown** — a proportional bar per subscription status
  (`src/components/dashboard/StatusBreakdown.tsx`).
- **"يحتاج إجراء اليوم"** — the 5 soonest-expiring subscriptions needing
  attention, each linking to that customer's profile.
- **Recent activity** — the organization's last 8 `audit_logs` entries
  (written by the Phase 7 RPCs), labeled in Arabic.

**Verified — real, not assumed:** `computeDashboardStats` and
`computeMonthlyRevenue` were compiled with `esbuild` and run under Node
against fixed inputs spanning three different calendar months; the
"this month" revenue total, the active/needs-action counts, and the
6-month bucket placement all matched hand-calculated expected values
exactly (confirmed a mid-month renewal landed in the correct bucket and
an out-of-range one didn't leak into an adjacent month). Separately,
the exact aggregate queries the dashboard page runs (`customers` count,
`subscriptions` count, `audit_logs` count, all scoped by
`organization_id`) were executed against the live database as an
authenticated org member inside a rolled-back transaction, after
calling `register_sale` to create one real subscription: all three
counts correctly returned 1, then the transaction was rolled back and
row counts confirmed back at 0 across `organizations`/`audit_logs`, so
nothing was left in the production database. `next build`,
`tsc --noEmit`, and `eslint` are all clean, and `/dashboard`
307-redirects to `/login` when unauthenticated (confirmed with curl).
**Not verified:** the rendered dashboard — charts, KPI cards, and the
activity feed — in an actual signed-in browser session, since that
needs a live Supabase connection this sandbox's network can't reach
(same limitation as every phase since 3).

## Admin panel (Phase 10)

Every new organization is created via `create_organization` (Phase 2)
in `pending_activation` status with a matching `pending`
`activation_requests` row — the spec treats a brand-new merchant
account as needing manual review before it's live, not as
auto-activated. Phase 10 is the review side of that:

- **Two RLS gaps closed.** `organizations`, `account_subscriptions`,
  `activation_requests`, `notifications`, and `plans` already had
  admin-wide `for all`/`select` policies from Phase 2, but `profiles`
  and `organization_members` didn't — an admin trying to see "who owns
  this pending org" would have silently gotten nothing back. Added
  `profiles_admin_select` and `organization_members_admin_select`,
  both read-only and gated by the same `private.is_platform_admin()`
  check as everything else; neither touches the Phase 2 fix that locked
  `profiles.platform_role` updates to `service_role` only, so an admin
  still can't grant themselves or anyone else a role through this UI or
  any client call.
- **A real, separate bug fixed.** While testing the RPC below against
  the live database, an `authenticated` call into `activation_requests`
  failed with a flat "permission denied for table" error — not the
  usual RLS-filtered-empty-result. It turned out Phase 2 wrote RLS
  policies for `activation_requests` and `notifications` but never
  issued the underlying table-level `GRANT` to `authenticated`, unlike
  every other application table. A table-level grant is checked before
  RLS is ever evaluated, so both tables' select/insert/update policies
  have been silently unreachable since Phase 2 — this was found by
  running a real query against the live database, not by reading the
  code, and is now fixed with the missing grants.
- **`admin_review_activation_request(request_id, decision, note)`** —
  one RPC, one transaction, for approving or rejecting a pending
  organization: updates `organizations.status`,
  `account_subscriptions.status` (+ `started_at` on approval),
  `activation_requests` itself (`status`, `note`, `reviewed_by`,
  `reviewed_at`), and writes both an `audit_logs` entry and a
  `notifications` row for the organization — all in one call, so a
  failure partway through can't activate the subscription while leaving
  the organization itself at `pending_activation`. It re-checks
  `private.is_platform_admin()` itself (not just relying on the
  page-level guard) and locks the request row (`FOR UPDATE`) so the
  same request can't be approved twice, whether from a double-click or
  two admins reviewing at once.
- **`/admin`** (platform overview: organization counts by status, total
  users, pending-review count, recent activity across every
  organization), **`/admin/activations`** (pending requests with
  approve/reject actions, plus a resolved history), and
  **`/admin/organizations`** (every organization with its owner, member
  count, and status) — all gated by `src/lib/admin/requireAdmin.ts`,
  which is a UX convenience, not the real security boundary: the actual
  boundary is `private.is_platform_admin()` inside every RLS policy and
  inside the RPC itself, so even a bypassed page guard couldn't read
  another org's data or approve a request. A "🛡️ لوحة الإدارة" link
  appears in the merchant dashboard's own nav only for a signed-in
  admin.

**Verified — real, not assumed:** the missing-grant bug above was
caught by actually executing an authenticated query against the live
database, not by code review. After fixing it, the full approve/reject
flow was exercised end-to-end against the live database inside a
rolled-back transaction: creating a temporary admin profile and two
pending organizations, approving one and rejecting the other, and
confirming `organizations.status`, `account_subscriptions.status`,
and `activation_requests.status`/`reviewed_by` all landed correctly for
each; confirming exactly 2 `audit_logs` rows and (checked from the
table owner's view, since the querying admin isn't an org member and is
correctly RLS-restricted from seeing an org's own notifications) that
the `notifications` rows were genuinely inserted, not silently
dropped; confirming an admin can read another user's `profiles` row and
another org's `organization_members` rows via the two new policies;
and confirming a second approval attempt on an already-reviewed request
is rejected by the RPC's own status check. Everything was rolled back
afterward with row counts confirmed back at 0. The security advisor was
re-run: no new issues beyond the same class of expected `SECURITY
DEFINER` warning already present for the Phase 2/7 RPCs. `next build`,
`tsc --noEmit`, and `eslint` are all clean, and `/admin`,
`/admin/activations`, and `/admin/organizations` all correctly
307-redirect to `/login` when unauthenticated (confirmed with curl).
**Not verified:** the signed-in-but-non-admin redirect to `/dashboard`
(the logic is a straightforward, reviewed profile-role check, but
exercising it needs a real signed-in session this sandbox's network
can't reach) and the rendered admin UI in an actual browser — same
limitation as every phase since 3.

## Security hardening (Phase 11)

This phase was a dedicated audit pass rather than new features: a full
sweep of table grants, function search paths, response headers,
dependency vulnerabilities, and abuse surface on top of everything
built in Phases 1-10.

**A real, exploitable gap found and fixed.** `customers`, `subscriptions`,
and `renewals` had a blanket `INSERT`/`UPDATE`/`DELETE` grant to
`authenticated` left over from the baseline schema, even though every
legitimate write to these three tables goes exclusively through the
atomic RPCs (`register_sale`, `renew_subscription`), which are owned by
`postgres` and are unaffected by revoking `authenticated`'s grants
(confirmed by grepping the whole app: nothing calls
`.from("customers"/"subscriptions"/"renewals").insert/update/delete()`
directly). Left in place, RLS only restricts which *rows* an org member
can touch, not which *columns* — the same class of gap the Phase 2
migration fixed for `profiles.platform_role`. Concretely, any
authenticated org member (or a compromised/lower-privilege "staff"
session) could previously, with nothing more than the browser's own
Supabase client: set `customers.lifetime_value`/`renewal_count` to
anything, forging VIP status and the dashboard's revenue numbers;
set `subscriptions.end_date`/`status`/`price_paid` directly, granting a
free extended subscription with no renewal row, no idempotency key, and
no audit log entry — completely bypassing the renewal trail the app is
built around; or insert a fabricated `renewals` row with no matching
subscription update, corrupting the ledger. All three tables are now
locked to `SELECT`-only for `authenticated`, which changes zero
application behavior (nothing legitimate used the write grants) while
closing the gap entirely.

**Two related tightenings from the same audit:** `products` had a
blanket `UPDATE` grant, but the only code path that writes to it
directly (`/api/import`, running as the calling user's own session, not
a service-role bypass) only ever sets
`name`/`description`/`image_url`/`price`/`is_available` — so `UPDATE`
was narrowed to exactly the columns the app uses, closing off a crafted
request that could otherwise reassign a product's `organization_id`/
`store_id` to a different tenant/store or forge `source_fingerprint` to
defeat re-import de-duplication. `notifications` lost its `INSERT`
grant entirely (nothing legitimate creates one client-side) and its
`UPDATE` grant was narrowed to `is_read` only (so marking a
notification read can't be used to rewrite its title/body and spoof a
different message). `activation_requests` lost its `INSERT`/`UPDATE`
grants to `authenticated` too — redundant cleanup, since no RLS policy
ever let an org member write there directly, but it keeps the
table-level grants honest about what's actually reachable.

**Other hardening in this phase:**
- **Security response headers** (`next.config.ts`): a Content-Security-Policy
  (scoped to `'self'` plus the exact Supabase project origin for
  `connect-src`, `frame-ancestors 'none'`, no external script/style
  hosts), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive
  `Permissions-Policy`, and HSTS — applied to every route via
  `headers()` so a new route can't ship without them by accident.
- **Rate limiting on `/api/import`**: this endpoint fetches an
  external, merchant-supplied URL and writes to the database on every
  call, so it's both an abuse vector (using this server to repeatedly
  hit arbitrary external hosts) and a cost concern. With no separate
  infrastructure available (no Redis), it's enforced against the
  `import_jobs` table that already logs every attempt — capped at 3
  attempts per store per 5-minute window, returning `429` beyond that.
- **A full table-grant audit** across every table in `public` (not just
  the ones touched this phase) confirmed no other table has the same
  missing-grant or over-broad-grant pattern.
- **A function `search_path` audit** confirmed every `SECURITY DEFINER`
  function in `public` and `private` — including the ones from every
  prior phase — has `search_path = ''` set, so none of them are
  vulnerable to a schema-shadowing attack.
- **`npm audit`**: 0 vulnerabilities across all 466 dependencies
  (prod + dev + optional + peer).
- **Secrets hygiene**: confirmed `.env*` is git-ignored and no
  `.env`/`.env.local` file has ever been committed to this repository's
  history.

**Known limitation, not fixed here:** Supabase Auth's "leaked password
protection" (checks new passwords against HaveIBeenPwned) has shown as
disabled in the security advisor since Phase 2. It's an auth-provider
setting, not something reachable through SQL migrations or any tool
available in this session — turning it on requires a person with
dashboard access to toggle it under Authentication → Policies.

**Verified — real, not assumed:** the vulnerability itself was
confirmed by directly querying `information_schema.role_table_grants`/
`column_privileges` against the live database and seeing
`lifetime_value`, `renewal_count`, `end_date`, `status`, and
`price_paid` all listed as `UPDATE`-able by `authenticated` — not
inferred from reading the schema file. After applying the migration,
the fix was verified inside a rolled-back transaction: a direct
`UPDATE customers SET lifetime_value = 999999` and a direct
`UPDATE subscriptions SET end_date = '2099-01-01'` were confirmed to
now fail with `insufficient_privilege`, while
`register_sale` and a legitimate `products` name/price edit both still
worked correctly, and reassigning a product's `store_id` was
independently confirmed blocked. Row counts were back at 0 across
`organizations`/`customers`/`products` afterward. The rate-limit
counting query was verified against real `import_jobs` rows. The
security headers were verified three ways: `curl -I` against a local
production server showing every header present on a static page, a
dynamic page, and a `/login` redirect; loading the homepage,
`/login`, and `/signup` in a real headless Chromium via Playwright with
console/page-error listeners attached and confirming zero CSP
violations or script errors; and confirming the CSP's `connect-src`
correctly resolved to the real Supabase project origin at build time.
`next build`, `tsc --noEmit`, and `eslint` are all clean. The security
advisor was re-run after the migration: no new issues beyond the same
expected `SECURITY DEFINER` warning class, plus the still-open (and now
documented) leaked-password-protection setting. **Not verified:** an
actual attempted exploit from a real second browser session with a
genuinely lower-privileged ("staff") role signed in — the fix was
proven against the same RLS/grant mechanism the browser client uses,
not against a live non-owner session, since that needs a live Supabase
connection this sandbox's network can't reach (same limitation as
every phase since 3).

## Testing (Phase 12)

Real, automated unit tests run with [Vitest](https://vitest.dev) (`npm test`
/ `npx vitest run`), 132 tests across 13 files, all passing. `npx tsc --noEmit`,
`npx eslint .`, and `npm run build` were all re-run after adding the tests
and confirmed clean.

**What's covered:**

- **Pure domain logic** (`src/lib/domain/`): the subscription status engine
  (`subscriptionStatus.test.ts` — every boundary of the active /
  expiring_soon / expires_today / at_risk / expired transitions, including
  the exact 7-day and 3-day threshold edges, Date-vs-ISO-string input, and
  time-of-day insensitivity), the dashboard/analytics aggregation
  (`analytics.test.ts`), and the WhatsApp template renderer, phone
  normalizer, and `wa.me` link builder (`whatsapp.test.ts`).
- **The SSRF guard** (`src/lib/importer/ssrf.test.ts`): blocked literal
  hostnames/IPs, private IPv4 ranges, IPv6 loopback, and the DNS-rebinding
  defense (`node:dns` mocked so a hostname that resolves to a private
  address is rejected without needing real network access). Writing these
  tests surfaced a real bug, fixed in this phase: Node's `URL` parser
  normalizes an IPv4-mapped IPv6 literal like `[::ffff:127.0.0.1]` into hex
  form (`[::ffff:7f00:1]`), and the original `isBlockedIpv6` only matched
  the dotted-quad string form, so the hex form silently bypassed the
  mapped-IPv4 check entirely. `isBlockedIpv6` was rewritten to expand any
  IPv6 literal to its 8 hex groups (handling `::` compression and either
  IPv4-tail notation) before checking for the `::ffff:0:0/96` mapped range,
  and both forms — plus the mapped cloud-metadata address — now have
  regression tests.
- **The importer adapters** (`src/lib/importer/adapters/*.test.ts`): the
  Shopify `/products.json` adapter and the schema.org JSON-LD adapter, each
  tested against fixture payloads with `safeFetch` mocked out (no real
  network calls), covering successful extraction (name/price/image/
  availability/fingerprint mapping, HTML-stripping, `@graph`-wrapped
  nodes), and the failure paths (non-2xx status, invalid JSON, empty/
  missing product data, a malformed JSON-LD script tag that must not fail
  the whole page, an oversized page, and `safeFetch` throwing).
- **Zod validation schemas** (`src/lib/validations/*.test.ts`): every schema
  used by a form in the app (auth, onboarding, product, sale, renewal,
  template, import), focused on the custom `.refine()` rules — password
  strength, phone-number format, numeric-string coercion and
  positive-number checks, URL format, password-confirmation matching.

**What's explicitly not covered by `npm test`, and why:**

- Integration tests against the live Supabase RPCs/RLS policies/grants —
  these were already verified for real, through Phases 7–11, using
  rolled-back SQL transactions (`begin; ...; rollback;`) run directly
  against the live database via the Supabase MCP tool. That method proves
  the actual server-side behavior (RLS, grants, `SECURITY DEFINER`
  functions) in a way a mocked unit test cannot, but it isn't something
  `npm test` replays — there's no local Postgres instance with the schema
  and policies loaded for Vitest to run against in this sandbox.
- Browser/E2E tests against a real signed-in session — blocked by the same
  sandbox network limitation noted since Phase 3 (this environment's
  direct network cannot reach `*.supabase.co`). Phase 11's Playwright pass
  (loading `/`, `/login`, `/signup` in real headless Chromium and checking
  console/CSP output) is the closest real-browser verification performed
  so far, but it did not exercise a signed-in flow.

## Deployment

Not yet deployed. Target: an independent Vercel project, connected only to
this repository, with separate env vars per environment
(development/preview/production).

## Security notes

- RLS is the source of truth for data isolation — never rely on
  frontend filtering alone.
- Service role key and Resend API key are server-only; `admin.ts` uses
  the `server-only` package as a build-time guard.
- The store URL importer is a deliberate SSRF surface — a URL validator
  blocking localhost / private IP ranges / cloud metadata endpoints must
  be verified before it is used against real user-supplied URLs.

## Backup / recovery

Not yet documented — depends on the Supabase project's backup tier once
provisioned.

## Project status (updated as phases complete)

- [x] Phase 1 — Repository, architecture, dependencies
- [x] Phase 2 — Supabase schema, migrations, RLS (cross-tenant isolation
      test with real accounts still pending — see Supabase setup above)
- [x] Phase 3 — Auth, verification, password recovery (code complete,
      build/lint verified; live network calls to Supabase Auth not yet
      exercised in this environment — see Authentication below)
- [x] Phase 4 — Landing (full) + onboarding flow (code complete,
      build/lint verified; live Supabase reads on the landing page and
      the onboarding wizard's writes are not yet exercised end-to-end in
      this environment — see below)
- [x] Phase 5 — Store import architecture (SSRF guard verified with real
      tests including DNS-rebinding; adapter parsing logic verified
      against sample payloads; live network extraction from a real store
      not yet exercised in this environment — see below)
- [x] Phase 6 — Products (code complete, build/lint verified; page
      rendering with a real signed-in session not yet visually verified
      in this environment — see below)
- [x] Phase 7 — Customers + subscriptions (`register_sale` and
      `renew_subscription` RPCs verified against the live database with
      a rolled-back transaction — dedup-by-phone, idempotent renewal,
      input validation, and lifetime_value/renewal_count updates all
      confirmed; build/tsc/eslint clean; route protection confirmed by
      curl. Not verified: rendered UI in a real signed-in browser
      session — same sandbox network limitation as Phases 3-6.)
- [x] Phase 8 — Renewals, reminders, templates (WhatsApp link-building
      and template rendering unit-verified with real Node execution;
      message_templates delete RLS policy added and verified against
      the live database with a rolled-back transaction, including
      cross-org isolation; build/tsc/eslint clean; route protection
      confirmed by curl. No reminder is ever sent automatically — every
      link requires a human to press send inside WhatsApp. Not
      verified: rendered UI in a real signed-in browser session, and
      whether a generated wa.me link actually opens WhatsApp on a real
      device — same sandbox network limitation as Phases 3-7.)
- [x] Phase 9 — Dashboard + analytics (real KPIs, dependency-free
      revenue chart, status breakdown, "needs action today", and recent
      activity, all computed from the same tables/RLS every other page
      uses; analytics math unit-verified with real Node execution
      against hand-calculated expected values; underlying aggregate
      queries verified against the live database inside a rolled-back
      transaction; build/tsc/eslint clean; route protection confirmed
      by curl. Not verified: the rendered dashboard in a real signed-in
      browser session — same sandbox network limitation as Phases 3-8.)
- [x] Phase 10 — Admin (activation-request review RPC with audit log +
      notification, atomic and idempotent against double-approval;
      fixed two real RLS gaps — missing admin-select policies on
      profiles/organization_members, and missing table-level GRANTs on
      activation_requests/notifications that had silently made their
      Phase 2 policies unreachable since they were written; full
      approve/reject flow verified against the live database inside a
      rolled-back transaction; build/tsc/eslint clean; route protection
      confirmed by curl. Not verified: the signed-in-non-admin redirect
      and the rendered admin UI in a real browser session — same
      sandbox network limitation as Phases 3-9.)
- [x] Phase 11 — Security hardening (found and fixed a real
      column-tampering gap — customers/subscriptions/renewals had a
      blanket write grant to authenticated despite all legitimate
      writes going through atomic RPCs, confirmed exploitable via
      information_schema before the fix and blocked afterward;
      narrowed products/notifications/activation_requests grants;
      added CSP + security headers verified via curl and a real
      headless-Chromium console check; added import-endpoint rate
      limiting; npm audit clean; full search_path and table-grant audit
      across every table/function. Leaked-password-protection remains
      an open, documented manual dashboard action — no tool available
      to set it. Not verified: an actual exploit attempt from a real
      lower-privileged signed-in session — same sandbox network
      limitation as Phases 3-10.)
- [x] Phase 12 — Tests (Vitest, 132 tests / 13 files, all passing;
      domain logic, SSRF guard with DNS mocked, importer adapters via
      fixtures, validation schemas; found and fixed a real IPv4-mapped-
      IPv6 SSRF bypass in the hex-form literal while writing the SSRF
      tests; `tsc`/`eslint`/`next build` re-verified clean)
- [ ] Phase 13 — GitHub/Vercel production deployment
- [ ] Phase 14 — Final production verification
