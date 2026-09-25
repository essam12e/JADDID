import { describe, it, expect, vi, beforeEach } from "vitest";

const safeFetchMock = vi.fn();
vi.mock("../ssrf", () => ({ safeFetch: (...args: unknown[]) => safeFetchMock(...args) }));

const { StorefrontAdapter } = await import("./storefront");

const ORIGIN = "https://shop.example.sa";

function textResponse(body: string, url: string) {
  return {
    ok: true,
    status: 200,
    url,
    headers: new Headers(),
    text: async () => body,
  } as unknown as Response;
}

function notFound(url: string) {
  return { ok: false, status: 404, url, headers: new Headers() } as unknown as Response;
}

/** A Salla-shaped product page: JSON-LD inside @graph, opaque slug URL. */
function productPage(index: number) {
  return `<html><head><script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: `منتج رقم ${index}`,
        sku: `SKU${index}`,
        offers: { "@type": "Offer", price: 10 + index, priceCurrency: "SAR" },
      },
    ],
  })}</script></head><body></body></html>`;
}

function catalogue(count: number) {
  const urls = Array.from({ length: count }, (_, i) => `${ORIGIN}/ar/slug${i}`);
  const sitemap = `<?xml version="1.0"?><urlset>${urls
    .map((u) => `<loc>${u}</loc>`)
    .join("")}</urlset>`;

  return { urls, sitemap };
}

/**
 * Routes every fetch the adapter makes: the landing page, the sitemap,
 * and each product page.
 */
function serve(count: number, options: { delayMs?: number } = {}) {
  const { sitemap } = catalogue(count);

  safeFetchMock.mockImplementation(async (url: string) => {
    if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    if (url === `${ORIGIN}/` || url === ORIGIN) {
      return textResponse(`<html><head><title>المتجر</title></head><body>cdn.salla.sa</body></html>`, url);
    }
    if (url === `${ORIGIN}/sitemap.xml`) return textResponse(sitemap, url);
    const match = /\/ar\/slug(\d+)$/.exec(url);
    if (match) return textResponse(productPage(Number(match[1])), url);
    return notFound(url);
  });
}

beforeEach(() => {
  safeFetchMock.mockReset();
});

describe("StorefrontAdapter.extract", () => {
  it("reads a whole catalogue, not a fixed first page of it", async () => {
    // 619 is what the merchant's store actually holds; the crawl used to
    // stop at 40 and report success.
    serve(619);

    const result = await new StorefrontAdapter().extract(new URL(`${ORIGIN}/`), { maxRequestsPerSecond: 5_000 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.products).toHaveLength(619);
    expect(result.partial).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("hands back what it has when it runs out of time", async () => {
    serve(400, { delayMs: 2 });

    const result = await new StorefrontAdapter().extract(new URL(`${ORIGIN}/`), {
      deadline: Date.now() + 25,
      maxRequestsPerSecond: 5_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products.length).toBeLessThan(400);
    expect(result.partial).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it("reads the pages it has never seen before re-reading the stored ones", async () => {
    serve(30);

    const alreadyStored = new Set(
      Array.from({ length: 25 }, (_, i) => `${ORIGIN}/ar/slug${i}`),
    );

    const result = await new StorefrontAdapter().extract(new URL(`${ORIGIN}/`), {
      knownSourceUrls: alreadyStored,
      maxPages: 5,
      maxRequestsPerSecond: 5_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Only the five unseen ones fit in the budget, and those are the five
    // the crawl picked.
    expect(result.products.map((p) => p.name).sort()).toEqual(
      ["منتج رقم 25", "منتج رقم 26", "منتج رقم 27", "منتج رقم 28", "منتج رقم 29"].sort(),
    );
  });

  it("reports how many pages it could not open", async () => {
    safeFetchMock.mockImplementation(async (url: string) => {
      if (url === `${ORIGIN}/`) {
        return textResponse("<html><body>متجر</body></html>", url);
      }
      if (url === `${ORIGIN}/sitemap.xml`) {
        return textResponse(catalogue(3).sitemap, url);
      }
      return { ok: false, status: 403, url, headers: new Headers() } as unknown as Response;
    });

    const result = await new StorefrontAdapter().extract(new URL(`${ORIGIN}/`), { maxRequestsPerSecond: 5_000 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("ما سمح لنا نفتحها");
    expect(result.reason).toContain("تشخيص");
  });
});

describe("a store that rate-limits the crawl", () => {
  function servePages(count: number, allowPerBurst: number) {
    const { sitemap } = catalogue(count);
    let served = 0;

    safeFetchMock.mockImplementation(async (url: string) => {
      if (url === `${ORIGIN}/`) return textResponse("<html><body>متجر</body></html>", url);
      if (url === `${ORIGIN}/sitemap.xml`) return textResponse(sitemap, url);

      const match = /\/ar\/slug(\d+)$/.exec(url);
      if (!match) return notFound(url);

      // Answers a handful of pages, then pushes back — the behaviour a
      // real Salla store showed under a parallel crawl.
      served += 1;
      if (served > allowPerBurst) {
        return {
          ok: false,
          status: 429,
          url,
          headers: new Headers({ "retry-after": "0" }),
        } as unknown as Response;
      }
      return textResponse(productPage(Number(match[1])), url);
    });
  }

  it("slows down and retries instead of losing the pages", async () => {
    servePages(20, 8);

    const result = await new StorefrontAdapter().extract(new URL(`${ORIGIN}/`), { maxRequestsPerSecond: 5_000 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rateLimited).toBe(true);
    // The 8 it was allowed, not a crawl that burned the rest on 429s.
    expect(result.products.length).toBe(8);
    // And it says the rest are still out there rather than calling it done.
    expect(result.partial).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it("stops at its deadline rather than waiting out a long cooldown", async () => {
    servePages(50, 2);

    const startedAt = Date.now();
    const result = await new StorefrontAdapter().extract(new URL(`${ORIGIN}/`), {
      deadline: Date.now() + 120,
      maxRequestsPerSecond: 5_000,
    });

    expect(Date.now() - startedAt).toBeLessThan(3_000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.partial).toBe(true);
  });
});
