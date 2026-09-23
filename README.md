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
- [ ] Phase 3 — Auth, verification, password recovery
- [ ] Phase 4 — Landing (full) + onboarding flow
- [ ] Phase 5 — Store import architecture
- [ ] Phase 6 — Products
- [ ] Phase 7 — Customers + subscriptions
- [ ] Phase 8 — Renewals, reminders, templates
- [ ] Phase 9 — Dashboard + analytics
- [ ] Phase 10 — Admin
- [ ] Phase 11 — Security hardening
- [ ] Phase 12 — Tests
- [ ] Phase 13 — GitHub/Vercel production deployment
- [ ] Phase 14 — Final production verification
