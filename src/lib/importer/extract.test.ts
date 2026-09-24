import { describe, it, expect } from "vitest";
import {
  extractJsonLd,
  extractMicrodata,
  extractOpenGraph,
  extractFromHtml,
  dedupe,
} from "./extract";
import { parsePrice, stripTags, decodeEntities } from "./html";

const PAGE = "https://store.example.sa/product/netflix";

describe("JSON-LD", () => {
  it("reads a schema.org Product", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "اشتراك نتفلكس شهر",
      description: "<p>وصف <b>غني</b></p>",
      image: "https://cdn.example.sa/n.jpg",
      offers: { price: "49.00", priceCurrency: "SAR", availability: "https://schema.org/InStock" },
    })}</script>`;

    const [product] = extractJsonLd(html, PAGE);
    expect(product.name).toBe("اشتراك نتفلكس شهر");
    expect(product.price).toBe(49);
    expect(product.currency).toBe("SAR");
    expect(product.isAvailable).toBe(true);
    expect(product.description).toBe("وصف غني");
  });

  it("unwraps an ItemList, which is how category pages publish products", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@type": "ItemList",
      itemListElement: [
        { "@type": "ListItem", item: { "@type": "Product", name: "منتج أ", offers: { price: 10 } } },
        { "@type": "ListItem", item: { "@type": "Product", name: "منتج ب", offers: { price: 20 } } },
      ],
    })}</script>`;

    const names = extractJsonLd(html, PAGE).map((p) => p.name).sort();
    expect(names).toEqual(["منتج أ", "منتج ب"]);
  });

  it("survives one malformed block among good ones", () => {
    const html = `
      <script type="application/ld+json">{ this is not json </script>
      <script type="application/ld+json">{"@type":"Product","name":"سليم"}</script>`;
    expect(extractJsonLd(html, PAGE).map((p) => p.name)).toEqual(["سليم"]);
  });

  it("ignores non-Product structured data", () => {
    const html = `<script type="application/ld+json">{"@type":"Organization","name":"متجر"}</script>`;
    expect(extractJsonLd(html, PAGE)).toHaveLength(0);
  });

  it("resolves a relative product url against the page", () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"x","url":"/p/99"}</script>`;
    expect(extractJsonLd(html, PAGE)[0].sourceUrl).toBe("https://store.example.sa/p/99");
  });
});

describe("microdata", () => {
  it("reads an itemscope Product block", () => {
    const html = `
      <div itemscope itemtype="https://schema.org/Product">
        <h1 itemprop="name">اشتراك شاهد VIP</h1>
        <img itemprop="image" src="/img/shahid.png" />
        <span itemprop="description">باقة سنوية</span>
        <div itemprop="offers" itemscope>
          <meta itemprop="price" content="199.50" />
          <meta itemprop="priceCurrency" content="SAR" />
          <link itemprop="availability" href="https://schema.org/InStock" />
        </div>
      </div>`;

    const [product] = extractMicrodata(html, PAGE);
    expect(product.name).toBe("اشتراك شاهد VIP");
    expect(product.price).toBe(199.5);
    expect(product.currency).toBe("SAR");
    expect(product.imageUrl).toBe("https://store.example.sa/img/shahid.png");
    expect(product.isAvailable).toBe(true);
  });

  it("skips a block with no name rather than inventing one", () => {
    const html = `<div itemscope itemtype="https://schema.org/Product"><span itemprop="price">10</span></div>`;
    expect(extractMicrodata(html, PAGE)).toHaveLength(0);
  });
});

describe("Open Graph", () => {
  it("reads a product page that only publishes Open Graph", () => {
    // This is the shape a plain Zid/custom storefront serves — the case
    // the old JSON-LD-only importer reported as "not a store".
    const html = `
      <meta property="og:type" content="product" />
      <meta property="og:title" content="اشتراك سبوتيفاي عائلي" />
      <meta property="og:image" content="https://cdn.example.sa/s.jpg" />
      <meta property="product:price:amount" content="29.99" />
      <meta property="product:price:currency" content="SAR" />`;

    const [product] = extractOpenGraph(html, PAGE);
    expect(product.name).toBe("اشتراك سبوتيفاي عائلي");
    expect(product.price).toBe(29.99);
    expect(product.currency).toBe("SAR");
  });

  it("refuses to turn a homepage into a product", () => {
    // Without this guard a store's front page imports as one product
    // named after the shop.
    const html = `
      <meta property="og:type" content="website" />
      <meta property="og:title" content="متجر النور" />`;
    expect(extractOpenGraph(html, PAGE)).toHaveLength(0);
  });

  it("accepts a price-bearing page even when og:type is missing", () => {
    const html = `
      <meta property="og:title" content="منتج" />
      <meta property="og:price:amount" content="15" />`;
    expect(extractOpenGraph(html, PAGE)).toHaveLength(1);
  });
});

describe("extractFromHtml", () => {
  it("prefers JSON-LD and does not also emit the Open Graph duplicate", () => {
    const html = `
      <meta property="og:type" content="product" />
      <meta property="og:title" content="نفس المنتج" />
      <meta property="product:price:amount" content="49" />
      <script type="application/ld+json">{"@type":"Product","name":"نفس المنتج","offers":{"price":49}}</script>`;
    expect(extractFromHtml(html, PAGE)).toHaveLength(1);
  });

  it("returns nothing for a page with no product data at all", () => {
    expect(extractFromHtml("<html><body><h1>مرحبًا</h1></body></html>", PAGE)).toHaveLength(0);
  });
});

describe("dedupe", () => {
  it("collapses the same product found by two extractors", () => {
    const base = {
      description: null, imageUrl: null, price: 1, currency: null,
      category: null, isAvailable: null, sourceUrl: PAGE,
    };
    const out = dedupe([
      { ...base, name: "منتج", fingerprint: "a" },
      { ...base, name: "منتج", fingerprint: "b" },
      { ...base, name: "غيره", fingerprint: "c" },
    ]);
    expect(out).toHaveLength(2);
  });
});

describe("price parsing", () => {
  it("handles the formats storefronts actually print", () => {
    expect(parsePrice("1,299.00 ر.س")).toBe(1299);
    expect(parsePrice("SAR 49")).toBe(49);
    expect(parsePrice(79.5)).toBe(79.5);
    expect(parsePrice("١٢٩")).toBe(129); // Arabic-Indic digits
    expect(parsePrice("۱۲۹")).toBe(129); // Eastern Arabic-Indic
  });

  it("returns null rather than guessing", () => {
    // A wrong price imported silently is worse than a blank one.
    expect(parsePrice("السعر عند الطلب")).toBeNull();
    expect(parsePrice(null)).toBeNull();
    expect(parsePrice(undefined)).toBeNull();
  });
});

describe("html helpers", () => {
  it("decodes the entities that show up in titles", () => {
    expect(decodeEntities("Netflix &amp; Shahid &quot;VIP&quot;")).toBe('Netflix & Shahid "VIP"');
  });

  it("strips tags and collapses whitespace", () => {
    expect(stripTags("<p>سطر\n\n  ثاني</p>")).toBe("سطر ثاني");
  });
});
