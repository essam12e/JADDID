-- ══════════════════════════════════════════════════════════════════════
-- `service_role` had SELECT on ZERO tables in public. Not one.
--
-- Every privileged server path in the app therefore failed with
-- "permission denied for table …" → HTTP 403, no matter which key was
-- configured. The outbox queued six real emails and sent none, and the
-- 403 looks identical to the one a publishable key produces — which is
-- what sent the diagnosis chasing the key through two rounds of
-- rotate-and-redeploy before anyone looked at the grants.
--
-- Telling them apart, for next time:
--   RLS with no matching policy  -> 200 with an empty array
--   missing table GRANT          -> 403 "permission denied for table X"
-- The second is what the Postgres logs actually showed, and it was
-- there from the first failure.
--
-- The `revoke all ... from anon, authenticated` in phase14 was correct
-- and is deliberately left alone: the outbox holds other tenants'
-- addresses and must stay unreachable from any browser session. Only
-- service_role gains access here, which is precisely what it exists for
-- and what createAdminClient() assumes.
--
-- Verified in a rolled-back transaction before applying: reading
-- email_outbox `as service_role` returned the 6 queued rows, while anon
-- and authenticated stayed false.
-- ══════════════════════════════════════════════════════════════════════
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- Future tables too, so the next migration doesn't reopen this hole.
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
alter default privileges in schema public
  grant all on functions to service_role;
