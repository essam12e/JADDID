import { describe, it, expect } from "vitest";
import { extractVisibleHtml } from "./visible";
import { extractFromHtml } from "./extract";

const PAGE = "https://shop.example.sa/product/12";

describe("extractVisibleHtml", () => {
  it("reads a plain shop page that has no structured data at all", () => {
    const html = `
      <html><head><title>ساعة ذكية | متجر النور</title></head>
      <body>
        <h1>ساعة ذكية</h1>
        <img src="/media/watch.jpg" />
        <span class="product-price">249.00 ر.س</span>
        <button>أضف للسلة</button>
      </body></html>`;

    const [product] = extractVisibleHtml(html, PAGE);
    expect(product.name).toBe("ساعة ذكية");
    expect(product.price).toBe(249);
    expect(product.currency).toBe("SAR");
    expect(product.imageUrl).toBe("https://shop.example.sa/media/watch.jpg");
    expect(product.isAvailable).toBe(true);
  });

  it("prefers a price the template marked over any other number on the page", () => {
    const html = `
      <h1>عطر شرقي</h1>
      <p>شحن مجاني للطلبات فوق 200 ر.س</p>
      <div class="price">89 ر.س</div>`;
    expect(extractVisibleHtml(html, PAGE)[0].price).toBe(89);
  });

  it("reads a price carried as an attribute", () => {
    const html = `<h1>سماعة</h1><meta itemprop="price" content="120.50" />`;
    expect(extractVisibleHtml(html, PAGE)[0].price).toBe(120.5);
  });

  it("reads Arabic-Indic digits", () => {
    const html = `<h1>كتاب</h1><span class="price">٧٥ ر.س</span>`;
    expect(extractVisibleHtml(html, PAGE)[0].price).toBe(75);
  });

  it("falls back to loose text when nothing is marked as a price", () => {
    const html = `<h1>حقيبة سفر</h1><div>السعر: 310 ر.س</div>`;
    const [product] = extractVisibleHtml(html, PAGE);
    expect(product.price).toBe(310);
    expect(product.name).toBe("حقيبة سفر");
  });

  it("returns nothing for a page with no price", () => {
    expect(extractVisibleHtml(`<h1>من نحن</h1><p>متجرنا يخدمكم منذ 2015</p>`, PAGE)).toEqual([]);
  });

  it("returns nothing when a price has no name to attach it to", () => {
    expect(extractVisibleHtml(`<div class="price">50 ر.س</div>`, PAGE)).toEqual([]);
  });

  it("drops the shop name when the title is all it has", () => {
    const html = `<html><head><title>عدسات لاصقة | متجر الرؤية</title></head>
      <body><span class="price">60 ر.س</span></body></html>`;
    expect(extractVisibleHtml(html, PAGE)[0].name).toBe("عدسات لاصقة");
  });

  it("skips logos and inline data URIs when picking an image", () => {
    const html = `
      <h1>منتج</h1><span class="price">10 ر.س</span>
      <img src="/assets/logo.png" /><img src="data:image/gif;base64,AA" />
      <img data-src="/media/real.jpg" />`;
    expect(extractVisibleHtml(html, PAGE)[0].imageUrl).toBe("https://shop.example.sa/media/real.jpg");
  });

  it("marks a sold-out product unavailable", () => {
    const html = `<h1>جوال</h1><span class="price">1500 ر.س</span><p>نفدت الكمية</p>`;
    expect(extractVisibleHtml(html, PAGE)[0].isAvailable).toBe(false);
  });

  it("ignores prices written inside scripts and styles", () => {
    const html = `<h1>منتج</h1><script>var shipping = "20 ر.س";</script>`;
    expect(extractVisibleHtml(html, PAGE)).toEqual([]);
  });
});

describe("extractFromHtml with the visible-HTML fallback", () => {
  it("imports an ordinary store page that earlier passes cannot read", () => {
    const html = `<html><head><meta property="og:type" content="website" /></head>
      <body><h1>شاحن سريع</h1><span class="price">٤٥ ر.س</span></body></html>`;
    const products = extractFromHtml(html, PAGE);
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({ name: "شاحن سريع", price: 45, currency: "SAR" });
  });

  it("does not fire when JSON-LD already answered", () => {
    const html =
      `<script type="application/ld+json">{"@type":"Product","name":"من LD","offers":{"price":10}}</script>` +
      `<h1>عنوان الصفحة</h1><span class="price">99 ر.س</span>`;
    const products = extractFromHtml(html, PAGE);
    expect(products).toHaveLength(1);
    expect(products[0].name).toBe("من LD");
  });
});
