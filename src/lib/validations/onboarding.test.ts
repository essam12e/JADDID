import { describe, it, expect } from "vitest";
import { storeNameSchema, storeUrlSchema } from "./onboarding";

describe("storeNameSchema", () => {
  it("accepts a valid store name", () => {
    expect(storeNameSchema.safeParse({ storeName: "متجري" }).success).toBe(true);
  });

  it("rejects a one-character name", () => {
    expect(storeNameSchema.safeParse({ storeName: "م" }).success).toBe(false);
  });

  it("rejects a name over 80 characters", () => {
    expect(storeNameSchema.safeParse({ storeName: "a".repeat(81) }).success).toBe(false);
  });
});

describe("storeUrlSchema", () => {
  it("accepts an empty/omitted url (optional field)", () => {
    expect(storeUrlSchema.safeParse({}).success).toBe(true);
    expect(storeUrlSchema.safeParse({ storeUrl: "" }).success).toBe(true);
  });

  it("accepts a valid https url", () => {
    expect(storeUrlSchema.safeParse({ storeUrl: "https://shop.example.com" }).success).toBe(true);
  });

  it("accepts a valid http url", () => {
    expect(storeUrlSchema.safeParse({ storeUrl: "http://shop.example.com" }).success).toBe(true);
  });

  it("rejects a url with no protocol", () => {
    expect(storeUrlSchema.safeParse({ storeUrl: "shop.example.com" }).success).toBe(false);
  });

  it("rejects a non-http(s) protocol", () => {
    expect(storeUrlSchema.safeParse({ storeUrl: "ftp://shop.example.com" }).success).toBe(false);
  });

  it("rejects a url with no dot in the host", () => {
    expect(storeUrlSchema.safeParse({ storeUrl: "https://localhost" }).success).toBe(false);
  });
});
