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

  // Catches the mistake that actually happened in production: the
  // publishable/anon key pasted into SUPABASE_SERVICE_ROLE_KEY. The
  // client builds fine and every request comes back 403 from RLS, so
  // the outbox silently queued mail and never sent any of it. Failing
  // here, by name, turns a week of invisible breakage into one log line.
  if (serviceRoleKey === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is set to the publishable (anon) key. " +
        "It must be the secret key — the anon key is blocked by RLS and every " +
        "privileged query will return 403.",
    );
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
          "A real secret key bypasses RLS here; a publishable key gets 403.",
      };
    }
    return { ok: true };
  } catch (cause) {
    return { ok: false, reason: cause instanceof Error ? cause.message : "unknown" };
  }
}
