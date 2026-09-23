import { describe, it, expect } from "vitest";
import { renewalSchema, RENEWAL_PRESETS } from "./renewal";

describe("renewalSchema", () => {
  const base = { durationValue: "1", durationUnit: "months" as const, amount: "50" };

  it("accepts a valid renewal", () => {
    expect(renewalSchema.safeParse(base).success).toBe(true);
  });

  it("accepts an amount of zero (courtesy/free renewal)", () => {
    expect(renewalSchema.safeParse({ ...base, amount: "0" }).success).toBe(true);
  });

  it("rejects a negative amount", () => {
    expect(renewalSchema.safeParse({ ...base, amount: "-10" }).success).toBe(false);
  });

  it("rejects a non-integer duration value", () => {
    expect(renewalSchema.safeParse({ ...base, durationValue: "2.5" }).success).toBe(false);
  });

  it("rejects a zero duration value", () => {
    expect(renewalSchema.safeParse({ ...base, durationValue: "0" }).success).toBe(false);
  });

  it("rejects an invalid duration unit", () => {
    expect(renewalSchema.safeParse({ ...base, durationUnit: "weeks" }).success).toBe(false);
  });
});

describe("RENEWAL_PRESETS", () => {
  it("is non-empty and every preset validates against renewalSchema's duration fields", () => {
    expect(RENEWAL_PRESETS.length).toBeGreaterThan(0);
    for (const preset of RENEWAL_PRESETS) {
      const result = renewalSchema.safeParse({
        durationValue: String(preset.value),
        durationUnit: preset.unit,
        amount: "10",
      });
      expect(result.success).toBe(true);
    }
  });
});
