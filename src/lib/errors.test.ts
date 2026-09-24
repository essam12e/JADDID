import { describe, it, expect } from "vitest";
import { translateDbError, isAccountBlockedError, FALLBACK_ERROR } from "./errors";

describe("translateDbError", () => {
  it("maps a bare code", () => {
    expect(translateDbError("JADDID_NOT_ACTIVATED")).toContain("تحت المراجعة");
  });

  it("maps a code wrapped in Postgres prose", () => {
    // The supabase-js error message is not the bare raise text.
    const real = { message: 'new row violates ... JADDID_SUBSCRIPTION_EXPIRED' };
    expect(translateDbError(real)).toContain("انتهى اشتراكك");
  });

  it("interpolates the limit that came with the code", () => {
    expect(translateDbError("JADDID_LIMIT_STORES:3")).toContain("(3)");
    expect(translateDbError("JADDID_LIMIT_CUSTOMERS:500")).toContain("(500)");
  });

  it("does not print a raw placeholder when no limit was sent", () => {
    const out = translateDbError("JADDID_LIMIT_STORES");
    expect(out).not.toContain("{limit}");
    expect(out).toContain("(—)");
  });

  it("never leaks a raw SQL message", () => {
    const sql = 'duplicate key value violates unique constraint "customers_pkey"';
    expect(translateDbError(sql)).toBe(FALLBACK_ERROR);
    expect(translateDbError(sql)).not.toContain("customers_pkey");
  });

  it("handles null and undefined", () => {
    expect(translateDbError(null)).toBe(FALLBACK_ERROR);
    expect(translateDbError(undefined)).toBe(FALLBACK_ERROR);
  });
});

describe("isAccountBlockedError", () => {
  it("separates account-level blocks from action-level ones", () => {
    expect(isAccountBlockedError("JADDID_NOT_ACTIVATED")).toBe(true);
    expect(isAccountBlockedError("JADDID_SUBSCRIPTION_EXPIRED")).toBe(true);
    expect(isAccountBlockedError("JADDID_LIMIT_STORES:1")).toBe(false);
    expect(isAccountBlockedError(null)).toBe(false);
  });
});
