import { createHash } from "node:crypto";
import { parsePrice, stripTags } from "./html";
import type { ExtractedProduct } from "./types";

/**
 * Pulls products out of JSON the page embeds for its own JavaScript.
 *
 * Salla, Zid and most modern storefronts are framework-rendered: the
 * server ships a JSON blob (`__NUXT__`, `__NEXT_DATA__`, an
 * `application/json` script) and the browser builds the DOM from it.
 * Such a page can carry complete product data while having no JSON-LD,
 * no microdata, and an `og:type` of `website` — which is exactly the
 * shape that made the previous importer open five real product pages
 * and report that it could not read any of them.
 *
 * This walks whatever JSON the page carries and keeps any object that
 * looks like a product: a name, and a price. Nothing platform-specific,
 * because every one of these frameworks names its fields differently
 * and hard-coding one vendor's shape is what got us here.
 */

const NAME_KEYS = ["name", "title", "product_name", "productName", "label"];
const PRICE_KEYS = [
  "price",
  "sale_price",
  "salePrice",
  "regular_price",
  "regularPrice",
  "final_price",
  "finalPrice",
  "amount",
];
const IMAGE_KEYS = ["image", "image_url", "imageUrl", "thumbnail", "main_image", "mainImage", "photo"];
const URL_KEYS = ["url", "permalink", "link", "href", "product_url"];
const DESC_KEYS = ["description", "short_description", "shortDescription", "summary"];

/** Guards against a pathological blob eating the request. */
const MAX_NODES = 20_000;
const MAX_DEPTH = 12;

type Json = unknown;

function str(value: Json): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pick(node: Record<string, Json>, keys: string[]): Json {
  for (const key of keys) {
    if (node[key] !== undefined && node[key] !== null) return node[key];
  }
  return undefined;
}

/** Prices arrive as 49, "49.00", or { amount: 49, currency: "SAR" }. */
function readPrice(value: Json): { price: number | null; currency: string | null } {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, Json>;
    return {
      price: parsePrice(pick(obj, ["amount", "value", ...PRICE_KEYS]) as string | number),
      currency: str(pick(obj, ["currency", "currency_code", "currencyCode"])),
    };
  }
  return { price: parsePrice(value as string | number), currency: null };
}

function readImage(value: Json): string | null {
  if (typeof value === "string") return str(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = readImage(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, Json>;
    return str(pick(obj, ["url", "src", "image", "path", "large", "thumbnail"]));
  }
  return null;
}

function looksLikeProduct(node: Record<string, Json>): boolean {
  const name = str(pick(node, NAME_KEYS));
  if (!name || name.length < 2 || name.length > 200) return false;

  const { price } = readPrice(pick(node, PRICE_KEYS));
  if (price == null) return false;

  // A bare {name, price} pair is also what a shipping option, a tax line
  // or a coupon looks like. Require one more product-ish signal.
  const hasIdentity =
    pick(node, IMAGE_KEYS) !== undefined ||
    pick(node, URL_KEYS) !== undefined ||
    node.sku !== undefined ||
    node.id !== undefined;

  return hasIdentity;
}

function toProduct(node: Record<string, Json>, pageUrl: string): ExtractedProduct {
  const name = str(pick(node, NAME_KEYS)) ?? "منتج بدون اسم";
  const { price, currency } = readPrice(pick(node, PRICE_KEYS));
  const rawUrl = str(pick(node, URL_KEYS));
  const rawImage = readImage(pick(node, IMAGE_KEYS));
  const description = str(pick(node, DESC_KEYS));

  const absolute = (value: string | null): string | null => {
    if (!value) return null;
    try {
      return new URL(value, pageUrl).toString();
    } catch {
      return null;
    }
  };

  const sourceUrl = absolute(rawUrl) ?? pageUrl;
  const identity = str(pick(node, ["sku", "id", "product_id", "productId"])) ?? name;

  return {
    name,
    description: description ? stripTags(description).slice(0, 2000) : null,
    imageUrl: absolute(rawImage),
    price,
    currency,
    sourceUrl,
    category: str(pick(node, ["category", "category_name", "categoryName"])),
    isAvailable:
      typeof node.is_available === "boolean"
        ? node.is_available
        : typeof node.in_stock === "boolean"
          ? node.in_stock
          : typeof node.available === "boolean"
            ? node.available
            : null,
    fingerprint: createHash("sha1").update(`embedded:${sourceUrl}:${identity}`).digest("hex"),
  };
}

/** Every JSON island a page might be carrying. */
export function collectJsonBlobs(html: string): unknown[] {
  const blobs: unknown[] = [];

  const push = (raw: string) => {
    const text = raw.trim().replace(/;$/, "");
    if (text.length < 2) return;
    try {
      blobs.push(JSON.parse(text));
    } catch {
      // Not JSON (a real script body, or JS object literal syntax).
    }
  };

  // <script type="application/json"> — Next.js, Nuxt payloads, Shopify.
  for (const m of html.matchAll(
    /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    push(m[1]);
  }

  // window.__NUXT__ = {...} / __INITIAL_STATE__ / __APP_DATA__ and friends.
  for (const m of html.matchAll(
    /(?:window\.)?(?:__NUXT__|__NEXT_DATA__|__INITIAL_STATE__|__APP_DATA__|__DATA__)\s*=\s*(\{[\s\S]*?\})\s*(?:;|<\/script>)/gi,
  )) {
    push(m[1]);
  }

  return blobs;
}

export function extractEmbeddedJson(html: string, pageUrl: string): ExtractedProduct[] {
  const found: ExtractedProduct[] = [];
  const seen = new Set<string>();
  let nodes = 0;

  const walk = (value: Json, depth: number) => {
    if (nodes++ > MAX_NODES || depth > MAX_DEPTH || !value || typeof value !== "object") return;

    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }

    const node = value as Record<string, Json>;
    if (looksLikeProduct(node)) {
      const product = toProduct(node, pageUrl);
      const key = `${product.sourceUrl}|${product.name.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        found.push(product);
      }
      // Keep walking: a product often nests its variants, and a catalogue
      // page nests every product inside one root object.
    }

    for (const child of Object.values(node)) walk(child, depth + 1);
  };

  for (const blob of collectJsonBlobs(html)) walk(blob, 0);
  return found;
}
