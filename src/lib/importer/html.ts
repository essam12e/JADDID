import "server-only";
import { safeFetch } from "./ssrf";

export const MAX_HTML_BYTES = 3_000_000;

/**
 * Every adapter needs the same thing: fetch a URL through the SSRF guard,
 * refuse anything oversized, hand back text. Having it in one place means
 * the size cap and the browser-ish Accept header can't drift between
 * adapters — several storefronts (Salla and Zid among them) serve a
 * stripped page or a 403 to a client that doesn't look like a browser.
 */
export async function fetchText(
  url: string | URL,
  accept = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
): Promise<
  | { ok: true; text: string; finalUrl: string }
  | { ok: false; reason: string; status?: number; retryAfterMs?: number }
> {
  let response: Response;
  try {
    response = await safeFetch(url.toString(), {
      headers: {
        Accept: accept,
        // Keeps our name and contact URL in the string — but a bare
        // "compatible" token is what the bot walls in front of Salla and
        // Zid match on, and a challenge page carries no product data.
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/125.0.0.0 Safari/537.36 JaddidImporter/1.0 (+https://j-addid.com)",
        "Accept-Language": "ar,en;q=0.8",
      },
    });
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "فشل الاتصال" };
  }

  if (!response.ok) {
    // 429 is not a failure, it is a request to slow down — the caller
    // backs off and comes back rather than burning the rest of the
    // catalogue against a closed door.
    // `Number(null)` is 0, so an absent header must be ruled out before
    // the value is read — otherwise every 429 looks like "retry now".
    const header = response.headers.get("retry-after");
    const seconds = header == null ? null : Number(header);
    return {
      ok: false,
      reason:
        response.status === 429
          ? "المتجر طلب منّا نبطّئ (HTTP 429)."
          : `تعذّر تحميل الصفحة (HTTP ${response.status}).`,
      status: response.status,
      retryAfterMs:
        seconds != null && Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : undefined,
    };
  }

  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_HTML_BYTES) {
    return { ok: false, reason: "الصفحة كبيرة جدًا لمعالجتها." };
  }

  const text = await response.text();
  if (text.length > MAX_HTML_BYTES) {
    return { ok: false, reason: "الصفحة كبيرة جدًا لمعالجتها." };
  }

  return { ok: true, text, finalUrl: response.url || url.toString() };
}

export async function fetchJson<T>(
  url: string | URL,
): Promise<{ ok: true; data: T } | { ok: false; reason: string }> {
  const result = await fetchText(url, "application/json");
  if (!result.ok) return result;
  try {
    return { ok: true, data: JSON.parse(result.text) as T };
  } catch {
    return { ok: false, reason: "الرد ليس JSON صالحًا." };
  }
}

/** Decodes the handful of HTML entities that actually show up in titles. */
export function decodeEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");
}

export function stripTags(input: string): string {
  return decodeEntities(input.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/**
 * Prices arrive as "1,299.00 ر.س", "١٢٩٩", "SAR 1299" and worse.
 * Returns null rather than a wrong number — a wrong price silently
 * imported is far more damaging than a blank one the merchant fills in.
 */
export function parsePrice(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;

  // Arabic-Indic and Eastern Arabic-Indic digits to ASCII.
  const normalised = String(raw)
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[,٬\s]/g, "")
    .replace(/٫/g, ".");

  const match = normalised.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Resolves a possibly relative href against the page it was found on. */
export function absolute(href: string | null | undefined, base: string): string | null {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

/**
 * Reads the first matching <meta> tag, accepting either attribute order —
 * storefront templates write both.
 */
export function metaContent(html: string, ...names: string[]): string | null {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match =
      html.match(
        new RegExp(`<meta[^>]*(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "i"),
      ) ??
      html.match(
        new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`, "i"),
      );
    if (match) return decodeEntities(match[1]);
  }
  return null;
}
