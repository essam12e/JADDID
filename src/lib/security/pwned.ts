/**
 * Checks a password against Have I Been Pwned's breach corpus using
 * k-anonymity — the same data source Supabase's own leaked-password
 * protection uses, which is a paid-plan feature we don't have.
 *
 * How it stays private: the browser hashes the password with SHA-1 and
 * sends only the FIRST FIVE hex characters of that hash. HIBP answers
 * with every suffix sharing that prefix (~800 of them) and the match
 * happens locally. The password, and the full hash, never leave the
 * device — which is actually stronger than the paid feature, where the
 * password reaches Supabase's server first.
 *
 * Runs in the browser so the password never leaves the device — and
 * again on the server for signup, which is the one flow whose password
 * does pass through our API. A check that only runs in the browser is
 * advice, not a control: anyone can POST to the route directly. Password
 * changes still go straight from the browser to Supabase Auth, so there
 * the check remains a guard rail, backed by Supabase's own hashing and
 * rate limiting.
 */

const HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/";

/** SHA-1 as uppercase hex, via Web Crypto (browser and Node 20+). */
export async function sha1Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest("SHA-1", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

/**
 * Finds the breach count for `suffix` in an HIBP range response.
 *
 * The body is `SUFFIX:COUNT` per line. Padding entries (added by the
 * `Add-Padding` header to hide the real response size) carry a count of
 * 0 and must be treated as "not found", not as a hit.
 */
export function countInRangeResponse(body: string, suffix: string): number {
  const wanted = suffix.toUpperCase();
  for (const line of body.split("\n")) {
    const [candidate, rawCount] = line.trim().split(":");
    if (!candidate || candidate.toUpperCase() !== wanted) continue;
    const count = Number.parseInt(rawCount ?? "0", 10);
    return Number.isFinite(count) ? count : 0;
  }
  return 0;
}

export type PwnedResult =
  /** Checked successfully. `count` is how many breaches contain it. */
  | { checked: true; count: number }
  /** Could not check (offline, blocked, timeout). Callers must allow. */
  | { checked: false; count: 0 };

export async function checkPasswordPwned(
  password: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PwnedResult> {
  if (!password) return { checked: false, count: 0 };

  try {
    const hash = await sha1Hex(password);
    const prefix = hash.slice(0, 5);
    const suffix = hash.slice(5);

    const response = await fetchImpl(`${HIBP_RANGE_URL}${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) return { checked: false, count: 0 };

    return { checked: true, count: countInRangeResponse(await response.text(), suffix) };
  } catch {
    // Offline, blocked by a network policy, or slow. Never block a signup
    // over a third-party service being unreachable.
    return { checked: false, count: 0 };
  }
}

/** The Arabic warning, or null when the password is fine / unchecked. */
export function pwnedMessage(result: PwnedResult): string | null {
  if (!result.checked || result.count === 0) return null;
  return "هذي كلمة مرور مكشوفة في تسريبات سابقة على الإنترنت. اختر وحدة ثانية عشان حسابك يضل آمن.";
}
