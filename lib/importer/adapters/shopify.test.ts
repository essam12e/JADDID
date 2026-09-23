import { describe, it, expect, vi, beforeEach } from "vitest";

const safeFetchMock = vi.fn();
vi.mock("../ssrf", () => ({ safeFetch: (...args: unknown[]) => safeFetchMock(...args) }));

const { ShopifyAdapter } = await import("./shopify");

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

beforeEach(() => {
  safeFetchMock.mockReset();
});

describe("ShopifyAdapter.extract", () => {
  it("extracts name, price, image, availability, and a stable fingerprint from a real-shaped payload", async () => {
    safeFetchMock.mockResolvedValueOnce(
      jsonResponse({
        products: [
          {
            id: 123,
            title: "  Premium Plan  ",
            body_html: "<p>Great <strong>value</strong>.</p>",
            handle: "premium-plan",
            product_type: "Subscription",
            images: [{ src: "https://cdn.example.com/img.jpg" }],
            variants: [{ price: "49.00", available: true }],
          },
        ],
      }),
    );

    const result = await new ShopifyAdapter().extract(new URL("https://shop.example.com"));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.products).toHaveLength(1);
    const product = result.products[0];
    expect(product.name).toBe("Premium Plan");
    // stripHtml replaces each tag with a space and collapses whitespace,
    // so a closing tag directly before punctuation leaves a space before it.
    expect(product.description).toBe("Great value .");
    expect(product.imageUrl).toBe("https://cdn.example.com/img.jpg");
    expect(product.price).toBe(49);
    expect(product.isAvailable).toBe(true);
    expect(product.sourceUrl).toBe("https://shop.example.com/products/premium-plan");
    expect(product.fingerprint).toMatch(/^[a-f0-9]{40}$/);
  });

  it("produces the same fingerprint for the same product id across two calls (stable dedup key)", async () => {
    const payload = {
      products: [{ id: 999, title: "X", variants: [{ price: "10", available: true }] }],
    };
    safeFetchMock.mockResolvedValueOnce(jsonResponse(payload));
    safeFetchMock.mockResolvedValueOnce(jsonResponse(payload));

    const url = new URL("https://shop.example.com");
    const first = await new ShopifyAdapter().extract(url);
    const second = await new ShopifyAdapter().extract(url);

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.products[0].fingerprint).toBe(second.products[0].fingerprint);
  });

  it("gives an unavailable product a fallback name rather than an empty string", async () => {
    safeFetchMock.mockResolvedValueOnce(jsonResponse({ products: [{ id: 1, variants: [] }] }));
    const result = await new ShopifyAdapter().extract(new URL("https://shop.example.com"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.products[0].name).toBe("منتج بدون اسم");
    expect(result.products[0].price).toBeNull();
  });

  it("fails cleanly when the endpoint returns a non-2xx status (not a Shopify store)", async () => {
    safeFetchMock.mockResolvedValueOnce(jsonResponse({}, 404));
    const result = await new ShopifyAdapter().extract(new URL("https://not-shopify.example.com"));
    expect(result.ok).toBe(false);
  });

  it("fails cleanly when the response has no products array", async () => {
    safeFetchMock.mockResolvedValueOnce(jsonResponse({ unrelated: true }));
    const result = await new ShopifyAdapter().extract(new URL("https://example.com"));
    expect(result.ok).toBe(false);
  });

  it("fails cleanly when the products array is empty", async () => {
    safeFetchMock.mockResolvedValueOnce(jsonResponse({ products: [] }));
    const result = await new ShopifyAdapter().extract(new URL("https://example.com"));
    expect(result.ok).toBe(false);
  });

  it("fails cleanly (not a thrown exception) when safeFetch itself rejects", async () => {
    safeFetchMock.mockRejectedValueOnce(new Error("لا يمكن استيراد هذا الرابط."));
    const result = await new ShopifyAdapter().extract(new URL("http://169.254.169.254/"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("لا يمكن استيراد");
  });
});
