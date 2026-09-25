import { createHash } from "node:crypto";
import { absolute, decodeEntities, metaContent, parsePrice, stripTags } from "./html";
import type { ExtractedProduct } from "./types";

/**
 * Last resort: read the product off the page the way a human does.
 *
 * Plenty of small shops — the "متجر عادي" this importer promises to
 * handle — publish no JSON-LD, no microdata, no product Open Graph and
 * no JSON island. They ship an `<h1>` with the name and a price in a
 * `<span class="price">`, and that is the whole contract. Every earlier
 * pass having found nothing is exactly when this one is right.
 *
 * It demands both a name and a price before returning anything, so a
 * category listing or an "about us" page yields nothing rather than a
 * junk product.
 */

/** Ordered: the first pattern that matches the page names the currency. */
const CURRENCIES: Array<[RegExp, string]> = [
  [/ر\.?\s?س|﷼|ريال\s*سعودي|SAR/i, "SAR"],
  [/د\.?\s?إ|درهم|AED/i, "AED"],
  [/د\.?\s?ك|KWD/i, "KWD"],
  [/ر\.?\s?ع|OMR/i, "OMR"],
  [/د\.?\s?ب|BHD/i, "BHD"],
  [/ر\.?\s?ق|QAR/i, "QAR"],
  [/ج\.?\s?م|جنيه|EGP/i, "EGP"],
  [/USD|\$/i, "USD"],
  [/EUR|€/i, "EUR"],
];

/**
 * A price is a price, not any large number.
 *
 * A real shop's footer carries a VAT number ("الرقم الضريبي
 * 311263353400003") a few characters from a currency symbol, and the
 * loose text scan below happily read it as the price of a product named
 * after the shop. Anything this large is not something a customer pays.
 */
const MAX_PLAUSIBLE_PRICE = 1_000_000;

/** Signals that this page sells the thing it is describing. */
const BUY_SIGNAL =
  /أضف\s*(?:للسلة|إلى\s*السلة|الى\s*السلة)|أضف\s*للعربة|اشتر(?:ِ|ي)\s*الآن|add\s*to\s*(?:cart|bag|basket)|buy\s*now|itemprop=["']price["']|<meta[^>]+product:price:amount/i;

/** A number carrying a currency marker on either side. */
const PRICED_TEXT =
  /(?:ر\.?\s?س|﷼|SAR|د\.?\s?إ|AED|د\.?\s?ك|KWD|ر\.?\s?ع|OMR|د\.?\s?ب|BHD|ر\.?\s?ق|QAR|ج\.?\s?م|EGP|USD|\$|EUR|€)\s{0,2}([\d٠-٩][\d٠-٩.,]{0,12})|([\d٠-٩][\d٠-٩.,]{0,12})\s{0,2}(?:ر\.?\s?س|﷼|SAR|د\.?\s?إ|AED|د\.?\s?ك|KWD|ر\.?\s?ع|OMR|د\.?\s?ب|BHD|ر\.?\s?ق|QAR|ج\.?\s?م|EGP|USD|\$|EUR|€)/i;

function fingerprint(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

function withoutCode(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
}

/** A price the template marked as one: an attribute or a price-ish class. */
function markedPrice(html: string): number | null {
  const plausible = (value: number | null) =>
    value != null && value > 0 && value <= MAX_PLAUSIBLE_PRICE ? value : null;

  const attributes = [
    /<[^>]*itemprop=["']price["'][^>]*content=["']([^"']+)["']/i,
    /<[^>]*content=["']([^"']+)["'][^>]*itemprop=["']price["']/i,
    /\bdata-(?:product-)?price=["']([^"']+)["']/i,
  ];
  for (const pattern of attributes) {
    const price = plausible(parsePrice(html.match(pattern)?.[1]));
    if (price != null) return price;
  }

  // <span class="product-price">49.00 ر.س</span> and its many cousins.
  const marked = html.matchAll(
    /<(?:span|div|p|b|strong|bdi|ins|h[1-6])[^>]*(?:class|id)=["'][^"']*(?:price|amount|سعر)[^"']*["'][^>]*>([\s\S]{0,120}?)<\//gi,
  );
  for (const match of marked) {
    const price = plausible(parsePrice(stripTags(match[1])));
    if (price != null) return price;
  }
  return null;
}

/**
 * Nothing was marked, so fall back to the first priced-looking text —
 * but only on a page that is actually selling something. On a homepage
 * or an "about us" page this scan has nothing to find and everything to
 * get wrong.
 */
function textPrice(html: string): number | null {
  if (!BUY_SIGNAL.test(html)) return null;

  const body = stripTags(withoutCode(html));
  const match = body.match(PRICED_TEXT);
  if (!match) return null;

  const price = parsePrice(match[1] ?? match[2]);
  if (price == null || price <= 0 || price > MAX_PLAUSIBLE_PRICE) return null;
  return price;
}

function readName(html: string): string | null {
  const og = metaContent(html, "og:title", "twitter:title");
  if (og && og.trim().length >= 2) return og.trim();

  const h1 = stripTags(html.match(/<h1[^>]*>([\s\S]{0,300}?)<\/h1>/i)?.[1] ?? "");
  if (h1.length >= 2) return h1;

  const title = stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  // "اسم المنتج | متجر النور" — the shop's name is not the product's.
  const trimmed = title.split(/\s+[|–—]\s+/)[0].trim();
  return trimmed.length >= 2 ? trimmed : null;
}

function readImage(html: string, pageUrl: string): string | null {
  const og = absolute(metaContent(html, "og:image", "twitter:image"), pageUrl);
  if (og) return og;

  for (const match of html.matchAll(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/gi)) {
    const src = decodeEntities(match[1]);
    if (/^data:|\.svg(?:$|\?)|logo|icon|sprite|placeholder|loading/i.test(src)) continue;
    const resolved = absolute(src, pageUrl);
    if (resolved) return resolved;
  }
  return null;
}

function readAvailability(html: string): boolean | null {
  const body = stripTags(withoutCode(html));
  if (/نفد|نفذت|غير\s*متوفر|غير\s*متاح|out\s*of\s*stock|sold\s*out/i.test(body)) return false;
  if (/متوفر|متاح|in\s*stock|أضف\s*للسلة|أضف\s*إلى\s*السلة/i.test(body)) return true;
  return null;
}

export function extractVisibleHtml(html: string, pageUrl: string): ExtractedProduct[] {
  const price = markedPrice(html) ?? textPrice(html);
  if (price == null) return [];

  const name = readName(html);
  if (!name) return [];

  const currency =
    metaContent(html, "product:price:currency", "og:price:currency") ??
    CURRENCIES.find(([pattern]) => pattern.test(html))?.[1] ??
    null;

  const url = absolute(metaContent(html, "og:url", "canonical"), pageUrl) ?? pageUrl;

  return [
    {
      name: name.slice(0, 200),
      description: metaContent(html, "og:description", "description")?.slice(0, 2000) ?? null,
      imageUrl: readImage(html, pageUrl),
      price,
      currency,
      sourceUrl: url,
      category: null,
      isAvailable: readAvailability(html),
      fingerprint: fingerprint(["visible", url, name]),
    },
  ];
}
