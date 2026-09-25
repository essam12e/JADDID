/**
 * Finding product pages when the URL the merchant pasted isn't one.
 *
 * This is the fix for the real failure the old importer had: it read
 * exactly the page it was given. Merchants paste their *homepage* — and a
 * homepage carries `Organization`/`WebSite` structured data, never
 * `Product`. So the honest answer to "any normal store" is to go find the
 * product pages, the same way a search engine would: the sitemap first,
 * then the page's own links.
 *
 * Pure string functions, no network — the adapter does the fetching.
 */

/** URL shapes that say "product" outright. */
const PRODUCT_PATH_PATTERNS: RegExp[] = [
  /\/products?\/[^/?#]+/i, // Shopify, Zid, many customs
  /\/product\/[^/?#]+/i, // WooCommerce
  /\/p\d{3,}/i, // Salla's numeric product path (/p123456789)
  /\/item\/[^/?#]+/i,
  /\/dp\/[^/?#]+/i,
];

/** Paths that are never a product, whatever else they match. */
const EXCLUDED =
  /\/(cart|checkout|account|login|logout|register|search|compare|wishlist|tag|tags|category|categories|collections?|brands?|blog|articles?|news|faq|contact|about|terms|privacy|policy|shipping)(\/|$|\?)/i;

/** Salla and Zid publish their static pages under /p/<slug>. */
const INFO_PAGE = /\/p\/[^/?#]+/i;

/** File-ish and asset URLs that a sitemap sometimes carries. */
const NOT_A_PAGE = /\.(xml|jpe?g|png|webp|gif|svg|pdf|css|js|ico)($|\?)/i;

export type UrlRank = "product" | "maybe" | "no";

/**
 * How likely a URL is to be a product page.
 *
 * The "maybe" rank is what makes Salla work. A Salla product lives at an
 * opaque slug — `https://shop.com/ar/OyvVenN` — with nothing in the path
 * that says "product". Demanding a recognisable pattern threw away all
 * 619 product URLs in such a store's sitemap and left the importer
 * reading the shop's policy pages instead. So anything that is a plain
 * page and not obviously something else stays a candidate, and the
 * extractor decides: a page with no product data yields nothing, which
 * costs one fetch and no wrong data.
 */
export function rankProductUrl(url: string): UrlRank {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "no";
  }
  const path = parsed.pathname;
  if (NOT_A_PAGE.test(path)) return "no";
  if (EXCLUDED.test(path)) return "no";
  if (PRODUCT_PATH_PATTERNS.some((pattern) => pattern.test(path))) return "product";
  if (INFO_PAGE.test(path)) return "no";

  // Two segments at most beyond an optional locale: /ar/OyvVenN, /OyvVenN.
  const segments = path.split("/").filter(Boolean);
  const withoutLocale = /^[a-z]{2}(-[a-z]{2})?$/i.test(segments[0] ?? "")
    ? segments.slice(1)
    : segments;
  if (withoutLocale.length === 0 || withoutLocale.length > 2) return "no";
  return "maybe";
}

export function looksLikeProductUrl(url: string): boolean {
  return rankProductUrl(url) === "product";
}

/**
 * Orders candidates so certain product URLs are read before the merely
 * possible ones, and caps the list.
 */
export function rankedProductUrls(urls: string[], limit: number): string[] {
  const certain: string[] = [];
  const possible: string[] = [];
  const seen = new Set<string>();

  for (const url of urls) {
    const clean = url.split("#")[0];
    if (seen.has(clean)) continue;
    seen.add(clean);
    const rank = rankProductUrl(clean);
    if (rank === "product") certain.push(clean);
    else if (rank === "maybe") possible.push(clean);
  }

  return [...certain, ...possible].slice(0, limit);
}

/** Candidate sitemap locations, in the order worth trying. */
export function sitemapCandidates(origin: string): string[] {
  return [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/product-sitemap.xml`,
    `${origin}/sitemap-products.xml`,
    `${origin}/sitemap/products.xml`,
  ];
}

/** Every <loc> in a sitemap or sitemap index. */
export function parseSitemapLocs(xml: string): string[] {
  const locs: string[] = [];
  for (const match of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) {
    locs.push(match[1].trim());
  }
  return locs;
}

/** A sitemap index points at more sitemaps; tell the two apart. */
export function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex[\s>]/i.test(xml);
}

/**
 * Same-origin links from a page that look like product pages. Staying on
 * one origin matters: it keeps the crawl inside the store the merchant
 * asked for, and keeps the SSRF guard's job simple.
 */
export function productLinksFromHtml(html: string, pageUrl: string, limit = 40): string[] {
  let origin: string;
  try {
    origin = new URL(pageUrl).origin;
  } catch {
    return [];
  }

  const candidates: string[] = [];
  for (const match of html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)) {
    let resolved: string;
    try {
      resolved = new URL(match[1], pageUrl).toString();
    } catch {
      continue;
    }
    if (!resolved.startsWith(origin)) continue;
    candidates.push(resolved);
  }

  return rankedProductUrls(candidates, limit);
}

/** Which platform a page is, from its own markup. Used for messaging. */
export type Platform = "salla" | "zid" | "shopify" | "woocommerce" | "unknown";

export function detectPlatform(html: string, url: string): Platform {
  const host = (() => {
    try {
      return new URL(url).hostname;
    } catch {
      return "";
    }
  })();

  if (host.endsWith(".salla.sa") || /salla\.(sa|network)|cdn\.salla/i.test(html)) return "salla";
  if (host.endsWith(".zid.store") || /zid\.(sa|store)|media\.zid/i.test(html)) return "zid";
  if (host.endsWith(".myshopify.com") || /cdn\.shopify\.com|Shopify\.theme/i.test(html)) return "shopify";
  if (/wp-content|woocommerce/i.test(html)) return "woocommerce";
  return "unknown";
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  salla: "سلة",
  zid: "زد",
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  unknown: "غير معروفة",
};
