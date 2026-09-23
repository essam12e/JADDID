import "server-only";
import { createHash } from "node:crypto";
import { safeFetch } from "../ssrf";
import type { AdapterResult, ExtractedProduct, StoreImporter } from "../types";

type JsonLdOffer = { price?: string | number; priceCurrency?: string; availability?: string };
type JsonLdNode = {
  "@type"?: string | string[];
  "@graph"?: JsonLdNode[];
  name?: string;
  description?: string;
  image?: string | string[] | { url?: string };
  offers?: JsonLdOffer | JsonLdOffer[];
  category?: string;
  url?: string;
};

const MAX_HTML_BYTES = 3_000_000;

function isProductNode(node: JsonLdNode): boolean {
  const type = node["@type"];
  if (!type) return false;
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => t.toLowerCase() === "product");
}

function firstImage(image: JsonLdNode["image"]): string | null {
  if (!image) return null;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return typeof image[0] === "string" ? image[0] : null;
  return image.url ?? null;
}

function firstOffer(offers: JsonLdNode["offers"]): JsonLdOffer | null {
  if (!offers) return null;
  return Array.isArray(offers) ? offers[0] ?? null : offers;
}

function flattenNodes(parsed: unknown): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  const stack: unknown[] = Array.isArray(parsed) ? [...parsed] : [parsed];

  while (stack.length) {
    const item = stack.pop();
    if (!item || typeof item !== "object") continue;
    const node = item as JsonLdNode;
    if (node["@graph"]) stack.push(...node["@graph"]);
    nodes.push(node);
  }

  return nodes;
}

/**
 * Extracts schema.org Product data from <script type="application/ld+json">
 * blocks -- a structured, standardized format most storefronts (Shopify,
 * WooCommerce, Salla, custom builds) already emit for SEO, so this is
 * reading data the store already publishes for machines to read, not
 * scraping rendered HTML heuristically.
 */
export class JsonLdAdapter implements StoreImporter {
  readonly name = "jsonld";

  canHandle(): boolean {
    return true;
  }

  async extract(url: URL): Promise<AdapterResult> {
    let response: Response;
    try {
      response = await safeFetch(url.toString(), {
        headers: { Accept: "text/html" },
      });
    } catch (err) {
      return { ok: false, reason: err instanceof Error ? err.message : "فشل الاتصال" };
    }

    if (!response.ok) {
      return { ok: false, reason: `تعذّر تحميل الصفحة (HTTP ${response.status}).` };
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > MAX_HTML_BYTES) {
      return { ok: false, reason: "الصفحة كبيرة جدًا لمعالجتها." };
    }

    const html = await response.text();
    if (html.length > MAX_HTML_BYTES) {
      return { ok: false, reason: "الصفحة كبيرة جدًا لمعالجتها." };
    }

    const scriptMatches = html.matchAll(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    );

    const productNodes: JsonLdNode[] = [];
    for (const match of scriptMatches) {
      try {
        const parsed = JSON.parse(match[1].trim());
        productNodes.push(...flattenNodes(parsed).filter(isProductNode));
      } catch {
        // Malformed JSON-LD block on the page -- skip it, don't fail the
        // whole extraction over one bad script tag.
      }
    }

    if (productNodes.length === 0) {
      return {
        ok: false,
        reason: "لم يتم العثور على بيانات منتجات (JSON-LD) في هذه الصفحة.",
      };
    }

    const products: ExtractedProduct[] = productNodes.map((node) => {
      const offer = firstOffer(node.offers);
      const priceNum = offer?.price !== undefined ? Number(offer.price) : null;
      const sourceUrl = node.url ? new URL(node.url, url.origin).toString() : url.toString();

      return {
        name: node.name?.trim() || "منتج بدون اسم",
        description: node.description?.trim().slice(0, 2000) || null,
        imageUrl: firstImage(node.image),
        price: Number.isFinite(priceNum) ? priceNum : null,
        currency: offer?.priceCurrency ?? null,
        sourceUrl,
        category: node.category ?? null,
        isAvailable: offer?.availability
          ? /instock/i.test(offer.availability)
          : null,
        fingerprint: createHash("sha1")
          .update(`jsonld:${sourceUrl}:${node.name ?? ""}`)
          .digest("hex"),
      };
    });

    return { ok: true, products };
  }
}
