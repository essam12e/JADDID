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

/** URL shapes used by the platforms merchants in this market actually use. */
const PRODUCT_PATH_PATTERNS: RegExp[] = [
  /\/products?\/[^/?#]+/i, // Shopify, Zid, many customs
  /\/product\/[^/?#]+/i, // WooCommerce
  /\/p\d{3,}/i, // Salla (/p123456789)
  /\/p\/[^/?#]+/i, // short product paths
  /\/item\/[^/?#]+/i,
  /\/dp\/[^/?#]+/i,
];

/** Paths that match a product pattern but are never a product page. */
const EXCLUDED = /\/(cart|checkout|account|login|register|search|compare|wishlist|tag|category|categories|collections?)(\/|$|\?)/i;

export function looksLikeProductUrl(url: string): boolean {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return false;
  }
  if (EXCLUDED.test(path)) return false;
  return PRODUCT_PATH_PATTERNS.some((pattern) => pattern.test(path));
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

  const seen = new Set<string>();
  const out: string[] = [];

  for (const match of html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)) {
    if (out.length >= limit) break;
    let resolved: string;
    try {
      resolved = new URL(match[1], pageUrl).toString();
    } catch {
      continue;
    }
    if (!resolved.startsWith(origin)) continue;
    if (!looksLikeProductUrl(resolved)) continue;

    const clean = resolved.split("#")[0];
    if (seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }

  return out;
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
