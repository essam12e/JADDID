import { describe, it, expect } from "vitest";
import { customerSchema } from "./customer";

const valid = { name: "محمد العتيبي", phone: "0500000000", storeId: "store-1" };

describe("customerSchema", () => {
  it("accepts a name and a phone alone", () => {
    expect(customerSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts a phone written the way people write it", () => {
    for (const phone of ["+966 50 000 0000", "(050) 000-0000", "00966500000000"]) {
      expect(customerSchema.safeParse({ ...valid, phone }).success, phone).toBe(true);
    }
  });

  it("rejects a one-letter name", () => {
    expect(customerSchema.safeParse({ ...valid, name: "م" }).success).toBe(false);
  });

  it("rejects letters in a phone number", () => {
    expect(customerSchema.safeParse({ ...valid, phone: "call me" }).success).toBe(false);
  });

  it("rejects a malformed email but allows none at all", () => {
    expect(customerSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
    expect(customerSchema.safeParse({ ...valid, email: "a@b.co" }).success).toBe(true);
    expect(customerSchema.safeParse(valid).success).toBe(true);
  });

  it("requires a store", () => {
    expect(customerSchema.safeParse({ ...valid, storeId: "" }).success).toBe(false);
  });
});
