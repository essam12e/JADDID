import { describe, it, expect } from "vitest";
import { templateSchema } from "./template";

describe("templateSchema", () => {
  const base = { name: "تذكير قبل يوم", body: "مرحبا {{customer_name}}, ينتهي اشتراكك غدًا.", isActive: true };

  it("accepts a valid template with no triggerDays", () => {
    expect(templateSchema.safeParse(base).success).toBe(true);
  });

  it("accepts a valid triggerDays of zero", () => {
    expect(templateSchema.safeParse({ ...base, triggerDays: "0" }).success).toBe(true);
  });

  it("rejects a negative triggerDays", () => {
    expect(templateSchema.safeParse({ ...base, triggerDays: "-1" }).success).toBe(false);
  });

  it("rejects a non-integer triggerDays", () => {
    expect(templateSchema.safeParse({ ...base, triggerDays: "1.5" }).success).toBe(false);
  });

  it("rejects a body shorter than 5 characters", () => {
    expect(templateSchema.safeParse({ ...base, body: "قصير" }).success).toBe(false);
  });

  it("rejects a name shorter than 2 characters", () => {
    expect(templateSchema.safeParse({ ...base, name: "ق" }).success).toBe(false);
  });

  it("requires isActive to be a boolean", () => {
    const withWrongType: unknown = { ...base, isActive: "true" };
    expect(templateSchema.safeParse(withWrongType).success).toBe(false);
  });
});
