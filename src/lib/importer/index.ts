import "server-only";
import { assertSafeImportUrl } from "./ssrf";
import { ShopifyAdapter } from "./adapters/shopify";
import { StorefrontAdapter } from "./adapters/storefront";
import type { ExtractedProduct, StoreImporter } from "./types";

export type { ExtractedProduct } from "./types";

/**
 * Order matters.
 *
 * Shopify's /products.json is a real, complete, unambiguous feed, so it
 * goes first whenever it applies. Everything else — Salla, Zid,
 * WooCommerce, Magento, a hand-rolled storefront — is handled by the
 * general adapter, which reads JSON-LD, microdata and Open Graph, and
 * will go find the product pages itself when handed a homepage.
 *
 * The previous chain was Shopify + a JSON-LD-only reader of a single
 * page, which is why pasting the homepage of an ordinary Salla or Zid
 * store answered "this doesn't look like a store".
 */
const ADAPTERS: StoreImporter[] = [new ShopifyAdapter(), new StorefrontAdapter()];

export type ImportOutcome = {
  ok: boolean;
  products: ExtractedProduct[];
  adapterUsed: string | null;
  attempts: { adapter: string; reason: string }[];
};

export async function importFromUrl(rawUrl: string): Promise<ImportOutcome> {
  const safety = await assertSafeImportUrl(rawUrl);
  if (!safety.safe) {
    return {
      ok: false,
      products: [],
      adapterUsed: null,
      attempts: [{ adapter: "ssrf-guard", reason: safety.reason }],
    };
  }

  const attempts: { adapter: string; reason: string }[] = [];

  for (const adapter of ADAPTERS) {
    if (!adapter.canHandle(safety.url)) continue;

    try {
      const result = await adapter.extract(safety.url);
      if (result.ok && result.products.length > 0) {
        return { ok: true, products: result.products, adapterUsed: adapter.name, attempts };
      }
      attempts.push({
        adapter: adapter.name,
        reason: result.ok ? "لم يتم العثور على منتجات." : result.reason,
      });
    } catch (err) {
      attempts.push({
        adapter: adapter.name,
        reason: err instanceof Error ? err.message : "خطأ غير متوقع",
      });
    }
  }

  return { ok: false, products: [], adapterUsed: null, attempts };
}
