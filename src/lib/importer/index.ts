import "server-only";
import { assertSafeImportUrl } from "./ssrf";
import { ShopifyAdapter } from "./adapters/shopify";
import { JsonLdAdapter } from "./adapters/jsonld";
import type { ExtractedProduct, StoreImporter } from "./types";

export type { ExtractedProduct } from "./types";

// Order matters: Shopify's /products.json is a real structured endpoint,
// tried first since it's cheap and unambiguous when it applies. JSON-LD
// is the general-purpose fallback for everything else that publishes
// schema.org Product data. Adding a new platform means adding a new
// adapter here -- nothing else in the app needs to change (per the
// project's requirement that the importer be extensible without a
// rewrite).
const ADAPTERS: StoreImporter[] = [new ShopifyAdapter(), new JsonLdAdapter()];

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
