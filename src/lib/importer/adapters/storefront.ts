import "server-only";
import { fetchText, fetchJson, parsePrice } from "../html";
import { extractFromHtml, dedupe, describePage, type PageEvidence } from "../extract";
import {
  detectPlatform,
  rankedProductUrls,
  isSitemapIndex,
  parseSitemapLocs,
  productLinksFromHtml,
  sitemapCandidates,
  PLATFORM_LABELS,
  type Platform,
} from "../discover";
import type {
  AdapterResult,
  ExtractedProduct,
  ImportOptions,
  StoreImporter,
} from "../types";
import { createHash } from "node:crypto";

/** How many product pages one import is allowed to open. */
/**
 * Ceiling on pages opened in one run. Not a target — a store with more
 * products than this is read across runs, each one skipping what the
 * last already stored.
 */
const MAX_PRODUCT_PAGES = 1500;
/** How many of those to fetch at once — polite to the store, fast enough. */
/**
 * Crawl pacing.
 *
 * Measured against a real Salla store: it answers roughly five requests
 * a second and then returns 429 for a while. Twelve parallel requests
 * lost a third of the catalogue and tripped a block that outlasted the
 * run.
 *
 * Concurrency alone cannot pace this — the pages come back in about 40ms,
 * so six parallel requests is 150 a second. What matters is the *rate*,
 * so the crawl holds a requests-per-second budget: it climbs while the
 * store is happy, halves the moment it pushes back, and pages that were
 * refused are retried rather than counted as failures.
 */
const BATCH_SIZE = 6;
const START_RATE_PER_SECOND = 5;
const MIN_RATE_PER_SECOND = 1;
const MAX_RATE_PER_SECOND = 12;
const BASE_COOLDOWN_MS = 1_500;
const MIN_COOLDOWN_MS = 200;
const MAX_COOLDOWN_MS = 8_000;
/** Give up once the store has refused this many batches in a row. */
const MAX_THROTTLED_BATCHES = 6;

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
async function productUrlsFromSitemaps(origin: string, limit: number): Promise<string[]> {
  for (const candidate of sitemapCandidates(origin)) {
    const result = await fetchText(candidate, "application/xml,text/xml;q=0.9,*/*;q=0.8");
    if (!result.ok || !result.text.includes("<loc>")) continue;

    let locs = parseSitemapLocs(result.text);

    if (isSitemapIndex(result.text)) {
      // Prefer child sitemaps whose names suggest products; otherwise take
      // the first few rather than crawling a whole large site.
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

    const products = rankedProductUrls(locs, limit);
    if (products.length > 0) return products;
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

  async extract(url: URL, options: ImportOptions = {}): Promise<AdapterResult> {
    const origin = url.origin;
    const maxPages = Math.min(options.maxPages ?? MAX_PRODUCT_PAGES, MAX_PRODUCT_PAGES);
    const withinBudget = () => options.deadline == null || Date.now() < options.deadline;

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
    // Discover up to the hard ceiling rather than up to this run's page
    // budget: the reordering below can only move unseen pages to the
    // front if it was allowed to see them in the first place.
    let productUrls = await productUrlsFromSitemaps(origin, MAX_PRODUCT_PAGES);
    if (productUrls.length === 0) {
      productUrls = productLinksFromHtml(page.text, page.finalUrl, MAX_PRODUCT_PAGES);
    }

    const discovered = productUrls.length;
    // Pages already stored go to the back of the queue rather than being
    // dropped: a re-import should refresh prices eventually, but only
    // after everything still missing has been read.
    if (options.knownSourceUrls?.size) {
      const known = options.knownSourceUrls;
      const fresh = productUrls.filter((link) => !known.has(link));
      const seen = productUrls.filter((link) => known.has(link));
      productUrls = [...fresh, ...seen];
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

    const queue = productUrls.slice(0, maxPages);
    const collected: ExtractedProduct[][] = [];
    const throttled: string[] = [];
    let retriedRound = false;
    // A caller that pins the ceiling starts there too; the default
    // starts cautiously and climbs.
    const maxRate = Math.max(MIN_RATE_PER_SECOND, options.maxRequestsPerSecond ?? MAX_RATE_PER_SECOND);
    let ratePerSecond = options.maxRequestsPerSecond ?? START_RATE_PER_SECOND;
    let rateLimited = false;
    let refusedInARow = 0;

    while (queue.length > 0 && withinBudget()) {
      const batch = queue.splice(0, BATCH_SIZE);
      const batchStartedAt = Date.now();

      const outcomes = await Promise.all(
        batch.map(async (link) => {
          const result = await fetchText(link);
          if (!result.ok) {
            if (result.status === 429) {
              return { link, slowDown: true, retryAfterMs: result.retryAfterMs, products: [] };
            }
            // A store that answers 403 to every product page is a
            // different problem from one whose pages we can't read, and
            // the message has to tell the two apart.
            if (blocked.length < 3) blocked.push(result.reason);
            return { link, slowDown: false, products: [] as ExtractedProduct[] };
          }
          opened += 1;
          // Record what the page held even when extraction comes up
          // empty — a failure has to explain itself or the next fix is a
          // guess.
          if (evidence.length < 3) evidence.push(describePage(result.text, result.finalUrl));
          return { link, slowDown: false, products: extractFromHtml(result.text, result.finalUrl) };
        }),
      );

      let pushedBack = 0;
      let read = 0;
      let askedFor: number | null = null;
      for (const outcome of outcomes) {
        if (outcome.slowDown) {
          pushedBack += 1;
          if (outcome.retryAfterMs != null) {
            askedFor = Math.max(askedFor ?? 0, outcome.retryAfterMs);
          }
          throttled.push(outcome.link);
          continue;
        }
        read += 1;
        if (outcome.products.length > 0) collected.push(outcome.products);
      }

      if (pushedBack > 0) {
        rateLimited = true;
        // Nothing at all got through, repeatedly: the store is not going
        // to relent inside this run, and grinding at it is neither
        // polite nor productive.
        refusedInARow = read === 0 ? refusedInARow + 1 : 0;
        if (refusedInARow >= MAX_THROTTLED_BATCHES) break;

        ratePerSecond = Math.max(Math.min(MIN_RATE_PER_SECOND, maxRate), ratePerSecond / 2);
        const cooldown = Math.min(
          MAX_COOLDOWN_MS,
          Math.max(MIN_COOLDOWN_MS, askedFor ?? BASE_COOLDOWN_MS),
        );
        const remainingBudget = (options.deadline ?? Infinity) - Date.now();
        if (remainingBudget > cooldown) {
          await new Promise((resolve) => setTimeout(resolve, cooldown));
        } else if (options.deadline != null) {
          break;
        }
      } else {
        refusedInARow = 0;
        ratePerSecond = Math.min(maxRate, ratePerSecond + 1);

        // Hold the rate. Without this the crawl runs as fast as the
        // store can answer, which is what earns the 429 in the first
        // place.
        const owed = (batch.length / ratePerSecond) * 1000 - (Date.now() - batchStartedAt);
        const budgetLeft = (options.deadline ?? Infinity) - Date.now();
        if (owed > 0 && budgetLeft > owed) {
          await new Promise((resolve) => setTimeout(resolve, owed));
        }
      }

      // Pages the store made us drop get one more turn, once everything
      // else has been read and the pace has settled.
      if (queue.length === 0 && throttled.length > 0 && !retriedRound && withinBudget()) {
        retriedRound = true;
        queue.push(...throttled.splice(0));
      }
    }

    const products = dedupe(collected.flat());
    if (products.length === 0) {
      return {
        ok: false,
        reason:
          (opened === 0
            ? `لقينا ${discovered} صفحة منتج بس المتجر ما سمح لنا نفتحها. `
            : `فتحنا ${opened} صفحة منتج من المتجر لكن ما قدرنا نقرأ بياناتها. `) +
          `تقدر تضيف المنتجات يدويًا. — ${summarise(evidence, blocked)}`,
      };
    }

    const unread = queue.length + throttled.length + Math.max(0, discovered - maxPages);
    return { ok: true, products, partial: unread > 0, remaining: unread, rateLimited };
  }
}
