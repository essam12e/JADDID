import { describe, it, expect, vi, beforeEach } from "vitest";

const safeFetchMock = vi.fn();
vi.mock("../ssrf", () => ({ safeFetch: (...args: unknown[]) => safeFetchMock(...args) }));

const { JsonLdAdapter } = await import("./jsonld");

function htmlResponse(html: string, opts: { ok?: boolean; status?: number; contentLength?: string | null } = {}) {
  const { ok = true, status = 200, contentLength = String(html.length) } = opts;
  return {
    ok,
    status,
    headers: { get: (key: string) => (key === "content-length" ? contentLength : null) },
    text: async () => html,
  } as unknown as Response;
}

beforeEach(() => {
  safeFetchMock.mockReset();
});

describe("JsonLdAdapter.extract", () => {
  it("extracts a single Product node", async () => {
    const html = `
      <html><head>
      <script type="application/ld+json">
      {"@type":"Product","name":"اشتراك بريميوم","description":"وصف طويل","image":"https://cdn.example.com/a.jpg","offers":{"price":"99.5","priceCurrency":"SAR","availability":"http://schema.org/InStock"}}
      </script>
      </head></html>`;
    safeFetchMock.mockResolvedValueOnce(htmlResponse(html));

    const result = await new JsonLdAdapter().extract(new URL("https://shop.example.com/p/1"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.products).toHaveLength(1);
    const product = result.products[0];
    expect(product.name).toBe("اشتراك بريميوم");
    expect(product.price).toBe(99.5);
    expect(product.currency).toBe("SAR");
    expect(product.isAvailable).toBe(true);
    expect(product.imageUrl).toBe("https://cdn.example.com/a.jpg");
    expect(product.fingerprint).toMatch(/^[a-f0-9]{40}$/);
  });

  it("extracts Product nodes wrapped in an @graph", async () => {
    const html = `<script type="application/ld+json">
      {"@graph":[{"@type":"WebPage"},{"@type":"Product","name":"منتج ١","offers":{"price":10}}]}
      </script>`;
    safeFetchMock.mockResolvedValueOnce(htmlResponse(html));

    const result = await new JsonLdAdapter().extract(new URL("https://shop.example.com/p/2"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe("منتج ١");
  });

  it("skips a malformed JSON-LD block without failing the whole extraction", async () => {
    const html = `
      <script type="application/ld+json">{not valid json</script>
      <script type="application/ld+json">{"@type":"Product","name":"منتج سليم","offers":{"price":5}}</script>
    `;
    safeFetchMock.mockResolvedValueOnce(htmlResponse(html));

    const result = await new JsonLdAdapter().extract(new URL("https://shop.example.com/"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe("منتج سليم");
  });

  it("filters out non-Product typed nodes", async () => {
    const html = `<script type="application/ld+json">
      [{"@type":"BreadcrumbList"},{"@type":"Organization","name":"Not a product"}]
      </script>`;
    safeFetchMock.mockResolvedValueOnce(htmlResponse(html));

    const result = await new JsonLdAdapter().extract(new URL("https://shop.example.com/"));
    expect(result.ok).toBe(false);
  });

  it("returns null gracefully for missing offers/image rather than throwing", async () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"بدون سعر"}</script>`;
    safeFetchMock.mockResolvedValueOnce(htmlResponse(html));

    const result = await new JsonLdAdapter().extract(new URL("https://shop.example.com/"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.products[0].price).toBeNull();
    expect(result.products[0].imageUrl).toBeNull();
    expect(result.products[0].isAvailable).toBeNull();
  });

  it("rejects when the page reports an oversized content-length", async () => {
    safeFetchMock.mockResolvedValueOnce(
      htmlResponse("<html></html>", { contentLength: String(4_000_000) }),
    );
    const result = await new JsonLdAdapter().extract(new URL("https://shop.example.com/"));
    expect(result.ok).toBe(false);
  });

  it("rejects when no JSON-LD Product nodes are found on the page", async () => {
    safeFetchMock.mockResolvedValueOnce(htmlResponse("<html><body>no scripts here</body></html>"));
    const result = await new JsonLdAdapter().extract(new URL("https://shop.example.com/"));
    expect(result.ok).toBe(false);
  });

  it("rejects on a non-ok HTTP status", async () => {
    safeFetchMock.mockResolvedValueOnce(htmlResponse("", { ok: false, status: 500 }));
    const result = await new JsonLdAdapter().extract(new URL("https://shop.example.com/"));
    expect(result.ok).toBe(false);
  });

  it("fails cleanly when safeFetch itself rejects", async () => {
    safeFetchMock.mockRejectedValueOnce(new Error("لا يمكن استيراد هذا الرابط."));
    const result = await new JsonLdAdapter().extract(new URL("http://169.254.169.254/"));
    expect(result.ok).toBe(false);
  });
});
