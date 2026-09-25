import "server-only";
import { fetchText, fetchJson, parsePrice } from "../html";
import { extractFromHtml, dedupe, describePage, type PageEvidence } from "../extract";
import {
  detectPlatform,
  isSitemapIndex,
  parseSitemapLocs,
  productLinksFromHtml,
  looksLikeProductUrl,
  sitemapCandidates,
  PLATFORM_LABELS,
  type Platform,
} from "../discover";
import type { AdapterResult, ExtractedProduct, StoreImporter } from "../types";
import { createHash } from "node:crypto";

/** How many product pages one import is allowed to open. */
const MAX_PRODUCT_PAGES = 12;
/** How many of those to fetch at once — polite to the store, fast enough. */
const CONCURRENCY = 4;

type WooProduct = {
  id: number;
  name: string;
  permalink?: string;
  description?: string;
  short_description?: string;
  images?: { src?: string; thumbnail?: string }[];
  prices?: { price?: string; currency_code?: string; currency_minor_unit?: number };
  is_in_stock?: boolean;
  categories?: { name?: string }[];
};

/** Compact, copy-pasteable account of what the pages contained. */
function summarise(evidence: PageEvidence[], blocked: string[]): string {
  if (evidence.length === 0) {
    const why = blocked[0] ? ` (${blocked[0]})` : "";
    return `تشخيص: ما قدرنا نفتح أي صفحة منتج${why}.`;
  }
  const parts = evidence.map(
    (e, i) =>
      `ص${i + 1}: ${Math.round(e.bytes / 1024)}ك · ld+json ${e.jsonLdBlocks}` +
      ` · microdata ${e.microdataBlocks} · json ${e.jsonIslands}` +
      ` · og:type ${e.ogType ?? "—"}`,
  );
  const blockedNote = blocked.length > 0 ? ` · محجوبة ${blocked.length}` : "";
  return `تشخيص [${parts.join(" | ")}${blockedNote}]`;
}

async function inBatches<T, R>(
  items: T[],
  size: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(...(await Promise.all(items.slice(i, i + size).map(worker))));
  }
  return results;
}

/**
 * WooCommerce ships a *public, unauthenticated* Store API. When a store
 * runs Woo this is far better than parsing its HTML: real prices, real
 * stock, no markup guessing.
 */
async function tryWooStoreApi(origin: string): Promise<ExtractedProduct[]> {
  const result = await fetchJson<WooProduct[]>(
    `${origin}/wp-json/wc/store/v1/products?per_page=50`,
  );
  if (!result.ok || !Array.isArray(result.data)) return [];

  return result.data.flatMap((item): ExtractedProduct[] => {
    if (!item?.name) return [];
    const minor = item.prices?.currency_minor_unit ?? 2;
    const raw = parsePrice(item.prices?.price);
    // Woo returns prices as minor units in a string ("1999" = 19.99).
    const price = raw == null ? null : raw / 10 ** minor;
    const sourceUrl = item.permalink ?? `${origin}/?p=${item.id}`;

    return [
      {
        name: item.name.trim(),
        description: (item.short_description || item.description || "")
          .replace(/<[^>]*>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 2000) || null,
        imageUrl: item.images?.[0]?.src ?? null,
        price,
        currency: item.prices?.currency_code ?? null,
        sourceUrl,
        category: item.categories?.[0]?.name ?? null,
        isAvailable: item.is_in_stock ?? null,
        fingerprint: createHash("sha1").update(`woo:${origin}:${item.id}`).digest("hex"),
      },
    ];
  });
}

/** Walks sitemaps (following one level of index) for product URLs. */
async function productUrlsFromSitemaps(origin: string): Promise<string[]> {
  for (const candidate of sitemapCandidates(origin)) {
    const result = await fetchText(candidate, "application/xml,text/xml;q=0.9,*/*;q=0.8");
    if (!result.ok || !result.text.includes("<loc>")) continue;

    let locs = parseSitemapLocs(result.text);

    if (isSitemapIndex(result.text)) {
      // Prefer the child sitemaps whose names suggest products; otherwise
      // take the first couple rather than crawling a whole large site.
      const childSitemaps = locs
        .filter((loc) => /product|item/i.test(loc))
        .concat(locs.filter((loc) => !/product|item/i.test(loc)))
        .slice(0, 3);

      const children = await inBatches(childSitemaps, 2, async (child) => {
        const sub = await fetchText(child, "application/xml,text/xml;q=0.9,*/*;q=0.8");
        return sub.ok ? parseSitemapLocs(sub.text) : [];
      });
      locs = children.flat();
    }

    const products = locs.filter(looksLikeProductUrl);
    if (products.length > 0) return products.slice(0, MAX_PRODUCT_PAGES);
  }
  return [];
}

/**
 * The general-purpose store importer.
 *
 * Works on the page it is given first; if that page is a homepage or a
 * category listing (which is what merchants actually paste), it goes and
 * finds the product pages — sitemap first, then the page's own links —
 * and reads those. That, plus reading Open Graph and microdata rather
 * than JSON-LD alone, is what makes "any normal store" work instead of
 * only Shopify.
 */
export class StorefrontAdapter implements StoreImporter {
  readonly name = "storefront";

  canHandle(): boolean {
    return true;
  }

  async extract(url: URL): Promise<AdapterResult> {
    const origin = url.origin;

    const page = await fetchText(url);
    if (!page.ok) return { ok: false, reason: page.reason };

    const platform: Platform = detectPlatform(page.text, url.toString());

    // 1. The page itself — it may already be a product page.
    const direct = extractFromHtml(page.text, page.finalUrl);
    if (direct.length > 0) {
      return { ok: true, products: dedupe(direct) };
    }

    // 2. WooCommerce exposes everything without scraping.
    if (platform === "woocommerce" || platform === "unknown") {
      const woo = await tryWooStoreApi(origin);
      if (woo.length > 0) return { ok: true, products: woo };
    }

    // 3. Find product pages and read them.
    let productUrls = await productUrlsFromSitemaps(origin);
    if (productUrls.length === 0) {
      productUrls = productLinksFromHtml(page.text, page.finalUrl, MAX_PRODUCT_PAGES);
    }

    if (productUrls.length === 0) {
      const label = PLATFORM_LABELS[platform];
      return {
        ok: false,
        reason:
          platform === "unknown"
            ? "ما لقينا صفحات منتجات في هذا الرابط. جرّب تلصق رابط صفحة منتج واحد أو رابط قسم فيه منتجات."
            : `المتجر يبدو على منصّة ${label}، بس ما لقينا صفحات منتجات من هذا الرابط. جرّب رابط قسم أو منتج بدل الصفحة الرئيسية.`,
      };
    }

    const evidence: PageEvidence[] = [];
    const blocked: string[] = [];
    let opened = 0;
    const pages = await inBatches(productUrls.slice(0, MAX_PRODUCT_PAGES), CONCURRENCY, async (link) => {
      const result = await fetchText(link);
      if (!result.ok) {
        // A store that answers 403 to every product page is a different
        // problem from one whose pages we simply can't read, and the
        // message has to tell the two apart.
        if (blocked.length < 3) blocked.push(result.reason);
        return [] as ExtractedProduct[];
      }
      opened += 1;
      // Record what the page held even when extraction comes up empty —
      // this importer can't be exercised against a live shop from the
      // build environment, so a failure has to explain itself or the
      // next fix is another guess.
      if (evidence.length < 3) evidence.push(describePage(result.text, result.finalUrl));
      return extractFromHtml(result.text, result.finalUrl);
    });

    const products = dedupe(pages.flat());
    if (products.length === 0) {
      return {
        ok: false,
        reason:
          (opened === 0
            ? `لقينا ${productUrls.length} صفحة منتج بس المتجر ما سمح لنا نفتحها. `
            : `فتحنا ${opened} صفحة منتج من المتجر لكن ما قدرنا نقرأ بياناتها. `) +
          `تقدر تضيف المنتجات يدويًا. — ${summarise(evidence, blocked)}`,
      };
    }

    return { ok: true, products };
  }
}
