import { describe, it, expect } from "vitest";
import { extractEmbeddedJson, collectJsonBlobs } from "./embedded";
import { extractFromHtml, describePage } from "./extract";

const PAGE = "https://store.example.sa/p123456";

function nuxt(payload: unknown) {
  return `<script>window.__NUXT__ = ${JSON.stringify(payload)};</script>`;
}
function jsonScript(payload: unknown) {
  return `<script type="application/json">${JSON.stringify(payload)}</script>`;
}

describe("collectJsonBlobs", () => {
  it("finds application/json islands", () => {
    expect(collectJsonBlobs(jsonScript({ a: 1 }))).toHaveLength(1);
  });

  it("finds a framework state assignment", () => {
    expect(collectJsonBlobs(nuxt({ a: 1 }))).toHaveLength(1);
  });

  it("ignores ordinary scripts and malformed JSON", () => {
    const html = `<script>console.log("hi")</script><script type="application/json">{oops</script>`;
    expect(collectJsonBlobs(html)).toHaveLength(0);
  });
});

describe("extractEmbeddedJson", () => {
  it("reads a product out of a framework payload", () => {
    // The shape that broke the importer on a real shop: complete product
    // data in a JSON island, no JSON-LD anywhere on the page.
    const html = nuxt({
      data: [
        {
          product: {
            id: 123456,
            name: "اشتراك نتفلكس شهر",
            price: { amount: 49, currency: "SAR" },
            image: { url: "/img/n.jpg" },
            url: "/p123456",
            description: "<p>باقة شهرية</p>",
            is_available: true,
          },
        },
      ],
    });

    const [product] = extractEmbeddedJson(html, PAGE);
    expect(product.name).toBe("اشتراك نتفلكس شهر");
    expect(product.price).toBe(49);
    expect(product.currency).toBe("SAR");
    expect(product.imageUrl).toBe("https://store.example.sa/img/n.jpg");
    expect(product.sourceUrl).toBe("https://store.example.sa/p123456");
    expect(product.description).toBe("باقة شهرية");
    expect(product.isAvailable).toBe(true);
  });

  it("reads a whole catalogue out of one island", () => {
    const html = jsonScript({
      props: {
        products: [
          { id: 1, title: "شاهد VIP", sale_price: "199.50", thumbnail: "/a.png" },
          { id: 2, title: "سبوتيفاي", price: 29.99, thumbnail: "/b.png" },
        ],
      },
    });
    const names = extractEmbeddedJson(html, PAGE).map((p) => p.name).sort();
    expect(names).toEqual(["سبوتيفاي", "شاهد VIP"]);
  });

  it("does not mistake a shipping option or coupon for a product", () => {
    // {name, price} alone describes half the objects in a checkout
    // payload, which is why an identity field is also required.
    const html = jsonScript({
      shipping: { name: "توصيل سريع", price: 15 },
      coupon: { name: "خصم 10", price: 10 },
    });
    expect(extractEmbeddedJson(html, PAGE)).toHaveLength(0);
  });

  it("ignores an object with a price but no usable name", () => {
    const html = jsonScript({ item: { id: 9, price: 10, name: "" } });
    expect(extractEmbeddedJson(html, PAGE)).toHaveLength(0);
  });

  it("ignores an object with a name but no price", () => {
    const html = jsonScript({ category: { id: 4, name: "الاشتراكات", url: "/c/4" } });
    expect(extractEmbeddedJson(html, PAGE)).toHaveLength(0);
  });

  it("takes the first image when the payload holds an array", () => {
    const html = jsonScript({
      p: { id: 1, name: "منتج", price: 10, images: ["/1.png", "/2.png"] },
    });
    // `images` is not in the key list; the product still reads, without
    // inventing an image.
    const [product] = extractEmbeddedJson(html, PAGE);
    expect(product.name).toBe("منتج");
    expect(product.imageUrl).toBeNull();
  });

  it("survives deeply nested and self-referential-looking data", () => {
    let deep: Record<string, unknown> = { id: 1, name: "عميق", price: 5, url: "/x" };
    for (let i = 0; i < 40; i++) deep = { level: deep };
    expect(() => extractEmbeddedJson(jsonScript(deep), PAGE)).not.toThrow();
  });

  it("deduplicates the same product appearing twice in one payload", () => {
    const item = { id: 7, name: "مكرر", price: 20, url: "/p7" };
    const html = jsonScript({ featured: [item], all: [item] });
    expect(extractEmbeddedJson(html, PAGE)).toHaveLength(1);
  });
});

describe("extractFromHtml with embedded JSON", () => {
  it("falls through to the JSON island when there is no JSON-LD", () => {
    const html = nuxt({ product: { id: 1, name: "من JSON", price: 30, url: "/p1" } });
    const products = extractFromHtml(html, PAGE);
    expect(products).toHaveLength(1);
    expect(products[0].name).toBe("من JSON");
  });

  it("still prefers JSON-LD when the page has both", () => {
    const html =
      `<script type="application/ld+json">{"@type":"Product","name":"من LD","offers":{"price":10}}</script>` +
      nuxt({ product: { id: 1, name: "من JSON", price: 30, url: "/p1" } });
    const names = extractFromHtml(html, PAGE).map((p) => p.name);
    expect(names).toContain("من LD");
    expect(names).not.toContain("من JSON");
  });
});

describe("describePage", () => {
  it("reports what a page held so a live failure can be diagnosed", () => {
    const html =
      `<meta property="og:type" content="website" />` +
      nuxt({ product: { id: 1, name: "سلة هدايا", price: 5, url: "/p1" } });

    const evidence = describePage(html, PAGE);
    expect(evidence.jsonLdBlocks).toBe(0);
    expect(evidence.microdataBlocks).toBe(0);
    expect(evidence.jsonIslands).toBe(1);
    expect(evidence.ogType).toBe("website");
    expect(evidence.products).toBe(1);
  });

  it("reports zero across the board for a page with nothing", () => {
    const evidence = describePage("<html><body>مرحبا</body></html>", PAGE);
    expect(evidence.jsonIslands).toBe(0);
    expect(evidence.products).toBe(0);
    expect(evidence.ogType).toBeNull();
  });
});
