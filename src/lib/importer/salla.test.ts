import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractFromHtml } from "./extract";
import { rankProductUrl, rankedProductUrls, productLinksFromHtml, detectPlatform } from "./discover";

// The store that exposed every one of these bugs.
const PAGE = "https://orimagroup.com/ar/-/p780652990";
const html = readFileSync(join(__dirname, "__fixtures__", "salla-product.html"), "utf8");

describe("a real Salla product page", () => {
  it("reads the product", () => {
    const products = extractFromHtml(html, PAGE);
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      name: "كسارات واقي الساق لكرة القدم",
      price: 6.6,
      currency: "SAR",
      isAvailable: true,
      sourceUrl: "https://orimagroup.com/ar/OyvVenN",
    });
    expect(products[0].imageUrl).toContain("cdn.salla.sa");
  });

  it("is recognised as Salla", () => {
    expect(detectPlatform(html, PAGE)).toBe("salla");
  });

  it("is not derailed by the Organization and WebPage blocks beside it", () => {
    // Those two carry a name and no price. Counting them as results is
    // what blocked the later passes before.
    const names = extractFromHtml(html, PAGE).map((p) => p.name);
    expect(names).not.toContain("ORIMA-اوريما");
  });
});

describe("Salla URL shapes", () => {
  it("keeps an opaque product slug as a candidate", () => {
    // 619 of these in the store's sitemap; all were thrown away before.
    expect(rankProductUrl("https://orimagroup.com/ar/OyvVenN")).toBe("maybe");
    expect(rankProductUrl("https://orimagroup.com/ar/QdwjOgD")).toBe("maybe");
  });

  it("still recognises an outright product path", () => {
    expect(rankProductUrl("https://orimagroup.com/ar/-/p780652990")).toBe("product");
    expect(rankProductUrl("https://shop.com/products/abc")).toBe("product");
    expect(rankProductUrl("https://shop.com/product/abc")).toBe("product");
  });

  it("rejects the pages a store publishes that are not products", () => {
    for (const url of [
      "https://orimagroup.com/ar/category/rxVlgn",
      "https://orimagroup.com/ar/p/سياسة-الاستخدام",
      "https://orimagroup.com/ar/p/الشحن-وطرق-الدفع",
      "https://orimagroup.com",
      "https://orimagroup.com/ar/cart",
      "https://orimagroup.com/sitemap-2.xml",
      "https://orimagroup.com/ar/blog/post-1",
    ]) {
      expect(rankProductUrl(url), url).toBe("no");
    }
  });

  it("reads certain product URLs before merely possible ones", () => {
    const ranked = rankedProductUrls(
      [
        "https://orimagroup.com/ar/OyvVenN",
        "https://orimagroup.com/ar/category/x",
        "https://orimagroup.com/ar/-/p780652990",
        "https://orimagroup.com/ar/OyvVenN",
      ],
      10,
    );
    expect(ranked).toEqual([
      "https://orimagroup.com/ar/-/p780652990",
      "https://orimagroup.com/ar/OyvVenN",
    ]);
  });

  it("no longer fills the crawl budget with policy pages", () => {
    const home = `
      <a href="/ar/p/سياسة-الاستخدام">السياسة</a>
      <a href="/ar/p/الشحن-وطرق-الدفع">الشحن</a>
      <a href="/ar/category/rxVlgn">قسم</a>
      <a href="/ar/OyvVenN">منتج</a>
      <a href="/ar/-/p780652990">منتج آخر</a>`;
    expect(productLinksFromHtml(home, "https://orimagroup.com/ar/", 5)).toEqual([
      "https://orimagroup.com/ar/-/p780652990",
      "https://orimagroup.com/ar/OyvVenN",
    ]);
  });
});
