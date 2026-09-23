-- The public pricing page must be readable without signing in, but the
-- plans table had no table-level grant to the anon role at all (only
-- authenticated did) -- RLS's is_active=true policy was correct but
-- unreachable for anonymous visitors. This only grants SELECT; the
-- is_active=true policy still applies, and no write grant is added.
grant select on table public.plans to anon;
