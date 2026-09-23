import { describe, it, expect } from "vitest";
import { profileSchema, storeSettingsSchema } from "./settings";

describe("profileSchema", () => {
  it("accepts a valid name", () => {
    expect(profileSchema.safeParse({ fullName: "محمد العتيبي" }).success).toBe(true);
  });

  it("rejects a one-character name", () => {
    expect(profileSchema.safeParse({ fullName: "م" }).success).toBe(false);
  });

  it("rejects a name over 100 characters", () => {
    expect(profileSchema.safeParse({ fullName: "a".repeat(101) }).success).toBe(false);
  });

  it("trims whitespace before validating length", () => {
    const result = profileSchema.safeParse({ fullName: "  محمد  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.fullName).toBe("محمد");
  });
});

describe("storeSettingsSchema", () => {
  it("accepts a valid name and url", () => {
    expect(
      storeSettingsSchema.safeParse({
        storeName: "متجري",
        storeUrl: "https://shop.example.com",
      }).success,
    ).toBe(true);
  });

  it("accepts an omitted url", () => {
    expect(storeSettingsSchema.safeParse({ storeName: "متجري" }).success).toBe(true);
  });

  it("rejects a one-character store name", () => {
    expect(
      storeSettingsSchema.safeParse({ storeName: "م", storeUrl: "" }).success,
    ).toBe(false);
  });

  it("rejects an invalid url", () => {
    expect(
      storeSettingsSchema.safeParse({ storeName: "متجري", storeUrl: "not-a-url" })
        .success,
    ).toBe(false);
  });
});
