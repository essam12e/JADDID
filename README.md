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

## Testing

Not yet added (planned: Phase 12 — unit tests for domain logic, integration
tests for critical flows, E2E for the main journeys).

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
- [ ] Phase 6 — Products
- [ ] Phase 7 — Customers + subscriptions
- [ ] Phase 8 — Renewals, reminders, templates
- [ ] Phase 9 — Dashboard + analytics
- [ ] Phase 10 — Admin
- [ ] Phase 11 — Security hardening
- [ ] Phase 12 — Tests
- [ ] Phase 13 — GitHub/Vercel production deployment
- [ ] Phase 14 — Final production verification
