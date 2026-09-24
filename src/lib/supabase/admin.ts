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

  // Catches the mistake that actually happened in production twice: a
  // public key pasted into SUPABASE_SERVICE_ROLE_KEY. The client builds
  // fine and every request comes back 403 from RLS, so the outbox
  // silently queued mail and never sent any of it.
  //
  // Checked by SHAPE, not just by equality with the anon key. The first
  // version only compared against NEXT_PUBLIC_SUPABASE_ANON_KEY, and
  // missed the second attempt because Supabase's newer publishable key
  // (`sb_publishable_…`) is a different string from the legacy anon JWT
  // — so the guard passed and the 403s continued.
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const looksPublic =
    serviceRoleKey === anonKey || serviceRoleKey.startsWith("sb_publishable_");

  if (looksPublic) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY holds a PUBLIC key (publishable/anon). " +
        "It must be a secret key — Supabase Dashboard > Project Settings > " +
        "API Keys > Secret keys, which starts with `sb_secret_`. A public key " +
        "is blocked by RLS, so every privileged query returns 403.",
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
          "A real secret key bypasses RLS here; any public key gets 403. " +
          "Copy the one under Project Settings > API Keys > Secret keys.",
      };
    }
    return { ok: true };
  } catch (cause) {
    return { ok: false, reason: cause instanceof Error ? cause.message : "unknown" };
  }
}
