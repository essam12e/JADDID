/**
 * Tells a public Supabase key from a secret one.
 *
 * Lives apart from `admin.ts` so it can be unit-tested: that module is
 * marked `server-only`, which by design refuses to load outside a server
 * runtime, and a guard nobody can test is a guard that quietly rots.
 *
 * This check has now caught production twice, and got it wrong once:
 * the first version compared only against NEXT_PUBLIC_SUPABASE_ANON_KEY,
 * so it sailed past `sb_publishable_…` — a different string for the same
 * mistake — and the 403s continued for another round. Hence matching on
 * shape as well as on that one equality.
 */

/** Prefixes Supabase uses for keys that are safe to ship to a browser. */
const PUBLIC_PREFIXES = ["sb_publishable_"] as const;

export function isPublicSupabaseKey(key: string, anonKey?: string | null): boolean {
  const candidate = key.trim();
  if (!candidate) return false;
  if (anonKey && candidate === anonKey.trim()) return true;
  return PUBLIC_PREFIXES.some((prefix) => candidate.startsWith(prefix));
}

export const SERVICE_KEY_HINT =
  "SUPABASE_SERVICE_ROLE_KEY holds a PUBLIC key (publishable/anon). " +
  "It must be a secret key — Supabase Dashboard > Project Settings > " +
  "API Keys > Secret keys, which starts with `sb_secret_`. A public key " +
  "is blocked by RLS, so every privileged query returns 403.";
