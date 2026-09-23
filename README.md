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

Not yet provisioned for this project (see "Remaining / blockers" below).
When set up, migrations will live in `supabase/migrations/` and must be
re-runnable — no undocumented manual dashboard edits.

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

- [x] Phase 1 — Repository, architecture, dependencies (this commit)
- [ ] Phase 2 — Supabase schema, migrations, RLS
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
