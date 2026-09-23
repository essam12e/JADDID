import { describe, it, expect } from "vitest";
import { productSchema } from "./product";

describe("productSchema", () => {
  it("accepts a minimal valid product (only name required)", () => {
    expect(productSchema.safeParse({ name: "منتج" }).success).toBe(true);
  });

  it("rejects a one-character name", () => {
    expect(productSchema.safeParse({ name: "م" }).success).toBe(false);
  });

  it("accepts a numeric-string price of zero", () => {
    expect(productSchema.safeParse({ name: "منتج", price: "0" }).success).toBe(true);
  });

  it("rejects a negative price", () => {
    expect(productSchema.safeParse({ name: "منتج", price: "-5" }).success).toBe(false);
  });

  it("rejects a non-numeric price", () => {
    expect(productSchema.safeParse({ name: "منتج", price: "abc" }).success).toBe(false);
  });

  it("accepts a valid image url and rejects an invalid one", () => {
    expect(productSchema.safeParse({ name: "منتج", imageUrl: "https://cdn.example.com/a.jpg" }).success).toBe(
      true,
    );
    expect(productSchema.safeParse({ name: "منتج", imageUrl: "not-a-url" }).success).toBe(false);
  });

  it("rejects a description over 2000 characters", () => {
    expect(productSchema.safeParse({ name: "منتج", description: "a".repeat(2001) }).success).toBe(false);
  });
});
