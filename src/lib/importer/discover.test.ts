import { describe, it, expect } from "vitest";
import {
  looksLikeProductUrl,
  productLinksFromHtml,
  parseSitemapLocs,
  isSitemapIndex,
  detectPlatform,
  sitemapCandidates,
} from "./discover";

describe("looksLikeProductUrl", () => {
  it("recognises the shapes the local platforms use", () => {
    expect(looksLikeProductUrl("https://shop.salla.sa/p123456789")).toBe(true);
    expect(looksLikeProductUrl("https://shop.salla.sa/ar/netflix/p987654321")).toBe(true);
    expect(looksLikeProductUrl("https://shop.zid.store/products/netflix-1m")).toBe(true);
    expect(looksLikeProductUrl("https://shop.myshopify.com/products/handle")).toBe(true);
    expect(looksLikeProductUrl("https://shop.sa/product/shahid-vip")).toBe(true);
  });

  it("rejects the paths that merely look similar", () => {
    // These match a product pattern but are never a product.
    expect(looksLikeProductUrl("https://shop.sa/collections/all")).toBe(false);
    expect(looksLikeProductUrl("https://shop.sa/categories/streaming")).toBe(false);
    expect(looksLikeProductUrl("https://shop.sa/cart")).toBe(false);
    expect(looksLikeProductUrl("https://shop.sa/account/login")).toBe(false);
    expect(looksLikeProductUrl("https://shop.sa/")).toBe(false);
  });

  it("does not throw on a malformed url", () => {
    expect(looksLikeProductUrl("not a url")).toBe(false);
  });
});

describe("productLinksFromHtml", () => {
  const page = "https://shop.example.sa/";

  it("collects same-origin product links and skips the rest", () => {
    const html = `
      <a href="/products/netflix">نتفلكس</a>
      <a href="/products/shahid">شاهد</a>
      <a href="/cart">السلة</a>
      <a href="https://other-shop.sa/products/x">متجر ثاني</a>
      <a href="/about">من نحن</a>`;

    expect(productLinksFromHtml(html, page)).toEqual([
      "https://shop.example.sa/products/netflix",
      "https://shop.example.sa/products/shahid",
    ]);
  });

  it("deduplicates repeated links and ignores fragments", () => {
    const html = `
      <a href="/products/netflix">صورة</a>
      <a href="/products/netflix">اسم</a>`;
    expect(productLinksFromHtml(html, page)).toHaveLength(1);
  });

  it("respects the limit so one page cannot trigger a huge crawl", () => {
    const html = Array.from({ length: 50 }, (_, i) => `<a href="/products/p${i}">x</a>`).join("");
    expect(productLinksFromHtml(html, page, 5)).toHaveLength(5);
  });
});

describe("sitemaps", () => {
  it("reads every <loc>", () => {
    const xml = `<urlset>
      <url><loc>https://shop.sa/products/a</loc></url>
      <url><loc> https://shop.sa/products/b </loc></url>
    </urlset>`;
    expect(parseSitemapLocs(xml)).toEqual([
      "https://shop.sa/products/a",
      "https://shop.sa/products/b",
    ]);
  });

  it("tells an index from a plain sitemap", () => {
    expect(isSitemapIndex('<sitemapindex xmlns="x"><sitemap></sitemap></sitemapindex>')).toBe(true);
    expect(isSitemapIndex("<urlset><url></url></urlset>")).toBe(false);
  });

  it("offers the common sitemap locations for an origin", () => {
    const candidates = sitemapCandidates("https://shop.sa");
    expect(candidates[0]).toBe("https://shop.sa/sitemap.xml");
    expect(candidates).toContain("https://shop.sa/product-sitemap.xml");
  });
});

describe("detectPlatform", () => {
  it("identifies stores by host", () => {
    expect(detectPlatform("", "https://mystore.salla.sa/")).toBe("salla");
    expect(detectPlatform("", "https://mystore.zid.store/")).toBe("zid");
    expect(detectPlatform("", "https://mystore.myshopify.com/")).toBe("shopify");
  });

  it("identifies stores on a custom domain by their markup", () => {
    // A merchant's own domain is the normal case; the host tells nothing.
    expect(detectPlatform('<img src="https://cdn.salla.sa/x.png">', "https://store.sa/")).toBe("salla");
    expect(detectPlatform('<script src="https://media.zid.sa/a.js">', "https://store.sa/")).toBe("zid");
    expect(detectPlatform('<link href="/wp-content/themes/x.css">', "https://store.sa/")).toBe("woocommerce");
  });

  it("says unknown rather than guessing", () => {
    expect(detectPlatform("<html><body>hi</body></html>", "https://store.sa/")).toBe("unknown");
  });
});
