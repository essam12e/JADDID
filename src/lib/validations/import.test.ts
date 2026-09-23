import { describe, it, expect } from "vitest";
import { startImportSchema } from "./import";

describe("startImportSchema", () => {
  const validStoreId = "11111111-1111-4111-8111-111111111111";

  it("accepts a valid uuid storeId and a valid url", () => {
    expect(
      startImportSchema.safeParse({ storeId: validStoreId, sourceUrl: "https://shop.example.com" }).success,
    ).toBe(true);
  });

  it("rejects a non-uuid storeId", () => {
    expect(
      startImportSchema.safeParse({ storeId: "not-a-uuid", sourceUrl: "https://shop.example.com" }).success,
    ).toBe(false);
  });

  it("rejects an empty sourceUrl", () => {
    expect(startImportSchema.safeParse({ storeId: validStoreId, sourceUrl: "" }).success).toBe(false);
  });

  it("rejects a sourceUrl with no protocol", () => {
    expect(
      startImportSchema.safeParse({ storeId: validStoreId, sourceUrl: "shop.example.com" }).success,
    ).toBe(false);
  });

  it("note: format validation alone does not block SSRF targets by design", () => {
    // This schema is intentionally format-only (see the comment in
    // onboarding.ts / import.ts) -- the real SSRF defense lives in
    // src/lib/importer/ssrf.ts (see ssrf.test.ts), which is what actually
    // rejects a URL like this one before any fetch happens. Asserting the
    // schema's pass-through behavior here documents that split rather than
    // implying this schema is itself the security boundary.
    expect(
      startImportSchema.safeParse({ storeId: validStoreId, sourceUrl: "http://169.254.169.254/x.json" })
        .success,
    ).toBe(true);
  });
});
