/**
 * Where a post-authentication redirect is allowed to land.
 *
 * `/auth/callback?next=…` used to be pasted straight after the origin.
 * `next=//evil.com` makes `https://j-addid.com//evil.com`, which every
 * browser reads as protocol-relative and follows to evil.com — an open
 * redirect, and a good one for phishing because it fires immediately
 * after a real sign-in on the real domain.
 *
 * Only a path on this site is acceptable: one leading slash, no second
 * slash or backslash, no scheme.
 */
export const DEFAULT_NEXT_PATH = "/dashboard";

export function safeNextPath(
  candidate: string | null | undefined,
  fallback = DEFAULT_NEXT_PATH,
): string {
  if (!candidate) return fallback;

  // Percent-encoding hides "//" from a naive check ("/%2Fevil.com"), and
  // a malformed escape should be refused rather than half-read.
  let value: string;
  try {
    value = decodeURIComponent(candidate);
  } catch {
    return fallback;
  }

  // Control characters can split a header or confuse a URL parser.
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/^\/+[a-z][a-z0-9+.-]*:/i.test(value)) return fallback;

  return value;
}
