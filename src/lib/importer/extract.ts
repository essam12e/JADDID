import { createHash } from "node:crypto";
import { decodeEntities, parsePrice, stripTags, absolute, metaContent } from "./html";
import { extractVisibleHtml } from "./visible";
import { extractEmbeddedJson, collectJsonBlobs } from "./embedded";
import type { ExtractedProduct } from "./types";

/**
 * Pulls products out of a page's HTML using, in order of trustworthiness:
 *
 *   1. JSON-LD   (schema.org/Product in <script type="application/ld+json">)
 *   2. Microdata (itemscope/itemprop markup)
 *   3. Open Graph (og:type=product, og:title, product:price:amount)
 *
 * Why all three: the previous importer read JSON-LD only, which is why a
 * plain Salla/Zid/WooCommerce page that publishes Open Graph but not
 * JSON-LD came back as "this doesn't look like a store". Between the
 * three, essentially every storefront that renders HTML is covered.
 *
 * Deliberately pure and network-free so it can be unit-tested against
 * real page fixtures instead of only against a live site.
 */

type JsonLdOffer = { price?: string | number; priceCurrency?: string; availability?: string };
type JsonLdNode = {
  "@type"?: string | string[];
  "@graph"?: JsonLdNode[];
  itemListElement?: JsonLdNode[];
  item?: JsonLdNode;
  name?: string;
  description?: string;
  image?: string | string[] | { url?: string };
  offers?: JsonLdOffer | JsonLdOffer[];
  category?: string;
  url?: string;
  sku?: string;
};

function fingerprint(parts: string[]): string {
  return createHash("sha1").update(parts.join(":")).digest("hex");
}

function isProductNode(node: JsonLdNode): boolean {
  const type = node["@type"];
  if (!type) return false;
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => String(t).toLowerCase() === "product");
}

function flatten(parsed: unknown): JsonLdNode[] {
  const nodes: JsonLdNode[] = [];
  const stack: unknown[] = Array.isArray(parsed) ? [...parsed] : [parsed];
  let guard = 0;

  while (stack.length && guard++ < 5000) {
    const item = stack.pop();
    if (!item || typeof item !== "object") continue;
    const node = item as JsonLdNode;
    // ItemList wrappers are how category pages list their products.
    if (node["@graph"]) stack.push(...node["@graph"]);
    if (node.itemListElement) stack.push(...node.itemListElement);
    if (node.item) stack.push(node.item);
    nodes.push(node);
  }
  return nodes;
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

export function extractJsonLd(html: string, pageUrl: string): ExtractedProduct[] {
  const blocks = html.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );

  const nodes: JsonLdNode[] = [];
  for (const block of blocks) {
    try {
      nodes.push(...flatten(JSON.parse(block[1].trim())).filter(isProductNode));
    } catch {
      // One malformed block must not sink the whole page.
    }
  }

  return nodes.map((node) => {
    const offer = firstOffer(node.offers);
    const sourceUrl = absolute(node.url, pageUrl) ?? pageUrl;
    return {
      name: node.name?.trim() || "منتج بدون اسم",
      description: node.description ? stripTags(node.description).slice(0, 2000) : null,
      imageUrl: absolute(firstImage(node.image), pageUrl),
      price: parsePrice(offer?.price),
      currency: offer?.priceCurrency ?? null,
      sourceUrl,
      category: node.category ?? null,
      isAvailable: offer?.availability ? /instock|preorder/i.test(offer.availability) : null,
      fingerprint: fingerprint(["jsonld", sourceUrl, node.sku ?? node.name ?? ""]),
    };
  });
}

/** Reads one `itemprop` out of a microdata block. */
function itemprop(block: string, prop: string): string | null {
  const meta = block.match(
    new RegExp(`<meta[^>]*itemprop=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i"),
  );
  if (meta) return decodeEntities(meta[1]);

  const content = block.match(
    new RegExp(`<[^>]*itemprop=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i"),
  );
  if (content) return decodeEntities(content[1]);

  const src = block.match(
    new RegExp(`<[^>]*itemprop=["']${prop}["'][^>]*src=["']([^"']*)["']`, "i"),
  );
  if (src) return decodeEntities(src[1]);

  const href = block.match(
    new RegExp(`<[^>]*itemprop=["']${prop}["'][^>]*href=["']([^"']*)["']`, "i"),
  );
  if (href) return decodeEntities(href[1]);

  const text = block.match(
    new RegExp(`<([a-z0-9]+)[^>]*itemprop=["']${prop}["'][^>]*>([\\s\\S]*?)<\\/\\1>`, "i"),
  );
  if (text) return stripTags(text[2]);

  return null;
}

export function extractMicrodata(html: string, pageUrl: string): ExtractedProduct[] {
  const products: ExtractedProduct[] = [];
  const opens = html.matchAll(
    /<[a-z0-9]+[^>]*itemtype=["']https?:\/\/schema\.org\/Product["'][^>]*>/gi,
  );

  for (const open of opens) {
    const start = open.index ?? 0;
    // A fixed window rather than real DOM nesting: parsing HTML properly
    // would mean shipping a DOM library into a server route for a job
    // three regexes already do. The window is generous enough to hold a
    // product block and small enough not to swallow the next one.
    const block = html.slice(start, start + 12_000);
    const name = itemprop(block, "name");
    if (!name) continue;

    const url = absolute(itemprop(block, "url"), pageUrl) ?? pageUrl;
    const availability = itemprop(block, "availability");

    products.push({
      name: name.trim(),
      description: itemprop(block, "description")?.slice(0, 2000) ?? null,
      imageUrl: absolute(itemprop(block, "image"), pageUrl),
      price: parsePrice(itemprop(block, "price")),
      currency: itemprop(block, "priceCurrency"),
      sourceUrl: url,
      category: itemprop(block, "category"),
      isAvailable: availability ? /instock|preorder/i.test(availability) : null,
      fingerprint: fingerprint(["microdata", url, name]),
    });
  }

  return products;
}

/**
 * Last resort for a single product page: Open Graph. Only fires when the
 * page actually claims to be a product — an `og:type=website` homepage
 * must not be imported as one product called "متجر فلان".
 */
export function extractOpenGraph(html: string, pageUrl: string): ExtractedProduct[] {
  const ogType = metaContent(html, "og:type")?.toLowerCase() ?? "";
  const price = parsePrice(
    metaContent(html, "product:price:amount", "og:price:amount", "twitter:data1"),
  );

  const looksLikeProduct = ogType.includes("product") || price != null;
  if (!looksLikeProduct) return [];

  const name =
    metaContent(html, "og:title", "twitter:title") ??
    stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  if (!name) return [];

  const url = absolute(metaContent(html, "og:url"), pageUrl) ?? pageUrl;
  const availability = metaContent(html, "product:availability", "og:availability");

  return [
    {
      name: name.trim(),
      description: metaContent(html, "og:description", "description")?.slice(0, 2000) ?? null,
      imageUrl: absolute(metaContent(html, "og:image", "twitter:image"), pageUrl),
      price,
      currency: metaContent(html, "product:price:currency", "og:price:currency"),
      sourceUrl: url,
      category: null,
      isAvailable: availability ? /instock|in stock|available/i.test(availability) : null,
      fingerprint: fingerprint(["og", url, name]),
    },
  ];
}

/** Drops duplicates that two extractors found on the same page. */
export function dedupe(products: ExtractedProduct[]): ExtractedProduct[] {
  const seen = new Set<string>();
  const out: ExtractedProduct[] = [];
  for (const product of products) {
    const key = `${product.sourceUrl}|${product.name.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(product);
  }
  return out;
}

/**
 * Everything a single HTML page can yield, best format first. Later
 * formats still run so a page with partial JSON-LD can be completed by
 * its microdata, but duplicates collapse.
 *
 * The embedded-JSON pass is what covers framework-rendered storefronts
 * (Salla, Zid, most Nuxt/Next shops): those ship complete product data
 * in a JSON island for their own JavaScript while publishing no JSON-LD,
 * no microdata, and `og:type=website`.
 */
export function extractFromHtml(html: string, pageUrl: string): ExtractedProduct[] {
  const found = [
    ...extractJsonLd(html, pageUrl),
    ...extractMicrodata(html, pageUrl),
  ];
  if (found.length === 0) found.push(...extractEmbeddedJson(html, pageUrl));
  if (found.length === 0) found.push(...extractOpenGraph(html, pageUrl));
  if (found.length === 0) found.push(...extractVisibleHtml(html, pageUrl));
  return dedupe(found).filter((p) => p.name && p.name !== "منتج بدون اسم");
}

export type PageEvidence = {
  bytes: number;
  jsonLdBlocks: number;
  microdataBlocks: number;
  jsonIslands: number;
  ogType: string | null;
  products: number;
};

/**
 * What a page actually contained.
 *
 * Exists because this importer cannot be tested against a real store
 * from the build environment — outbound network is blocked — so when it
 * fails on a live shop the only way to learn why is to have it say what
 * it saw. "Opened 5 product pages and read none" is a dead end;
 * "5 pages, 0 JSON-LD, 0 microdata, 3 JSON islands" names the fix.
 */
export function describePage(html: string, pageUrl: string): PageEvidence {
  return {
    bytes: html.length,
    jsonLdBlocks: [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["']/gi)].length,
    microdataBlocks: [
      ...html.matchAll(/itemtype=["']https?:\/\/schema\.org\/Product["']/gi),
    ].length,
    jsonIslands: collectJsonBlobs(html).length,
    ogType: metaContent(html, "og:type"),
    products: extractFromHtml(html, pageUrl).length,
  };
}
