import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getAccountOverview, type AccountOverview } from "./account";

/**
 * Request-scoped memo of `my_account_overview()`.
 *
 * The dashboard layout and the dashboard page both need it, and they
 * render in the same pass — without `cache()` that is two identical
 * round trips to Postgres on every single dashboard load. React dedupes
 * them into one for the lifetime of the request, and gets it fresh on
 * the next one.
 */
export const getAccountOverviewCached = cache(async (): Promise<AccountOverview> => {
  const supabase = await createClient();
  return getAccountOverview(supabase);
});
