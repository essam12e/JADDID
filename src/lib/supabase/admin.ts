import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { isPublicSupabaseKey, SERVICE_KEY_HINT } from "./keyShape";

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

  // Has caught this mistake in production twice. See keyShape.ts for
  // why it matches on shape and not only on equality with the anon key.
  if (isPublicSupabaseKey(serviceRoleKey, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    throw new Error(SERVICE_KEY_HINT);
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type AdminHealth =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Proves the key actually has service-role power, rather than merely
 * existing. Reads a table that RLS denies to every other role, so a
 * wrong key fails here instead of at 3am inside a cron job.
 */
export async function checkAdminAccess(): Promise<AdminHealth> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("email_outbox")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (error) {
      return {
        ok: false,
        reason:
          `SUPABASE_SERVICE_ROLE_KEY cannot read email_outbox (${error.message}). ` +
          "A real secret key bypasses RLS here; any public key gets 403. " +
          "Copy the one under Project Settings > API Keys > Secret keys.",
      };
    }
    return { ok: true };
  } catch (cause) {
    return { ok: false, reason: cause instanceof Error ? cause.message : "unknown" };
  }
}
