import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Privileged Supabase client using the SERVICE ROLE key.
 *
 * SERVER-SIDE ONLY. The `server-only` import above makes any accidental
 * client-bundle import of this file fail at build time.
 *
 * Use only for operations that must bypass RLS under carefully controlled
 * conditions (e.g. admin actions already gated by a verified admin role,
 * or system jobs). Never expose this client or its results directly to
 * an unauthenticated or unauthorized request.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for admin client.",
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
