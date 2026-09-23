import "server-only";
import { createHash } from "node:crypto";
import { safeFetch } from "../ssrf";
import type { AdapterResult, ExtractedProduct, StoreImporter } from "../types";

type ShopifyVariant = {
  price?: string;
  available?: boolean;
};

type ShopifyImage = { src?: string };

type ShopifyProduct = {
  id: number | string;
  title?: string;
  body_html?: string;
  handle?: string;
  product_type?: string;
  images?: ShopifyImage[];
  variants?: ShopifyVariant[];
};

function stripHtml(html?: string): string | null {
  if (!html) return null;
  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 0 ? text.slice(0, 2000) : null;
}

/**
 * Uses Shopify's well-known public storefront endpoint (`/products.json`),
 * which Shopify exposes on the vast majority of live stores without
 * authentication. This is a real, documented endpoint -- not a scrape of
 * arbitrary HTML -- which is why it's the first adapter tried.
 */
export class ShopifyAdapter implements StoreImporter {
  readonly name = "shopify";

  canHandle(): boolean {
    // Optimistic: any store might be Shopify. extract() itself is the
    // real test -- a non-Shopify host will 404 or return non-JSON, which
    // is treated as "this adapter doesn't apply" by the orchestrator.
    return true;
  }

  async extract(url: URL): Promise<AdapterResult> {
    const endpoint = new URL("/products.json", url.origin);
    endpoint.searchParams.set("limit", "50");

    let response: Response;
    try {
      response = await safeFetch(endpoint.toString(), {
        headers: { Accept: "application/json" },
      });
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : "فشل الاتصال" };
    }

    if (!response.ok) {
      return { ok: false, reason: `الرابط لا يستجيب كمتجر Shopify (HTTP ${response.status}).` };
    }

    let json: { products?: ShopifyProduct[] };
    try {
      json = await response.json();
    } catch {
      return { ok: false, reason: "الاستجابة ليست بصيغة JSON صالحة." };
    }

    if (!json.products || !Array.isArray(json.products)) {
      return { ok: false, reason: "لا يبدو أن هذا متجر Shopify." };
    }

    const products: ExtractedProduct[] = json.products.map((p) => {
      const firstVariant = p.variants?.[0];
      const priceNum = firstVariant?.price ? Number(firstVariant.price) : null;
      const productUrl = new URL(`/products/${p.handle ?? p.id}`, url.origin).toString();

      return {
        name: p.title?.trim() || "منتج بدون اسم",
        description: stripHtml(p.body_html),
        imageUrl: p.images?.[0]?.src ?? null,
        price: Number.isFinite(priceNum) ? priceNum : null,
        currency: null, // not present on this endpoint; app defaults to SAR
        sourceUrl: productUrl,
        category: p.product_type?.trim() || null,
        isAvailable: p.variants?.some((v) => v.available) ?? null,
        fingerprint: createHash("sha1")
          .update(`shopify:${url.origin}:${p.id}`)
          .digest("hex"),
      };
    });

    if (products.length === 0) {
      return { ok: false, reason: "لم يتم العثور على منتجات في هذا المتجر." };
    }

    return { ok: true, products };
  }
}
