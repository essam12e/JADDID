import { describe, it, expect } from "vitest";
import { saleSchema } from "./sale";

describe("saleSchema", () => {
  const base = {
    customerName: "أحمد محمد",
    customerPhone: "0500000000",
    pricePaid: "100",
    startDate: "2026-09-23",
    durationValue: "30",
    durationUnit: "days" as const,
  };

  it("accepts a fully valid sale", () => {
    expect(saleSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a phone number with letters", () => {
    expect(saleSchema.safeParse({ ...base, customerPhone: "05abc00000" }).success).toBe(false);
  });

  it("rejects a phone number shorter than 6 characters", () => {
    expect(saleSchema.safeParse({ ...base, customerPhone: "123" }).success).toBe(false);
  });

  it("accepts a phone number with dashes, spaces, and a leading +", () => {
    expect(saleSchema.safeParse({ ...base, customerPhone: "+966 50-000-0000" }).success).toBe(true);
  });

  it("rejects a negative price paid", () => {
    expect(saleSchema.safeParse({ ...base, pricePaid: "-1" }).success).toBe(false);
  });

  it("accepts a price paid of zero (free/trial sale)", () => {
    expect(saleSchema.safeParse({ ...base, pricePaid: "0" }).success).toBe(true);
  });

  it("rejects a non-integer duration value", () => {
    expect(saleSchema.safeParse({ ...base, durationValue: "1.5" }).success).toBe(false);
  });

  it("rejects a zero or negative duration value", () => {
    expect(saleSchema.safeParse({ ...base, durationValue: "0" }).success).toBe(false);
    expect(saleSchema.safeParse({ ...base, durationValue: "-3" }).success).toBe(false);
  });

  it("rejects an invalid duration unit", () => {
    expect(saleSchema.safeParse({ ...base, durationUnit: "weeks" }).success).toBe(false);
  });

  it("accepts an omitted customerEmail but rejects an invalid one", () => {
    expect(saleSchema.safeParse(base).success).toBe(true);
    expect(saleSchema.safeParse({ ...base, customerEmail: "not-an-email" }).success).toBe(false);
    expect(saleSchema.safeParse({ ...base, customerEmail: "a@b.com" }).success).toBe(true);
  });

  it("rejects a missing start date", () => {
    expect(saleSchema.safeParse({ ...base, startDate: "" }).success).toBe(false);
  });
});
