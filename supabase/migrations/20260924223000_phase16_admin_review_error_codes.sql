-- ══════════════════════════════════════════════════════════════════════
-- The approve button is easy to double-click, and the second click hits
-- the "already reviewed" guard. That guard raised English prose, which
-- `translateDbError` does not recognise, so the admin saw
-- "صار خطأ غير متوقع" immediately after an approval that had in fact
-- just succeeded — the most alarming possible message for the calmest
-- possible situation. Observed live: two 204s (both approvals worked)
-- interleaved with two 400s from the repeat clicks.
--
-- Same treatment as every other guard in this schema: machine-readable
-- codes the client maps to an accurate Arabic sentence. Body is
-- otherwise identical to Phase 15; only the three guard messages moved
-- from prose to JADDID_* codes.
--
-- Applied to production via apply_migration; this file is the record.
-- The full function body lives in
-- 20260924200200_phase15_admin_review_with_plan.sql — only these lines
-- differ:
--   'access denied: platform admin required' -> 'JADDID_ADMIN_REQUIRED'
--   'activation request not found'           -> 'JADDID_REQUEST_NOT_FOUND'
--   'this request has already been reviewed' -> 'JADDID_ALREADY_REVIEWED'
-- ══════════════════════════════════════════════════════════════════════
do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'admin_review_activation_request'
      and pg_get_functiondef(p.oid) like '%JADDID_ALREADY_REVIEWED%'
  ) then
    raise notice 'admin_review_activation_request already raises JADDID_* codes';
  else
    raise exception
      'admin_review_activation_request must be re-created with JADDID_* guard codes; '
      'see phase15_admin_review_with_plan and replace the three prose messages';
  end if;
end $$;
