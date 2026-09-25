import { describe, it, expect } from "vitest";
import { safeNextPath, DEFAULT_NEXT_PATH } from "./redirects";

describe("safeNextPath", () => {
  it("keeps an ordinary path on this site", () => {
    expect(safeNextPath("/reset-password")).toBe("/reset-password");
    expect(safeNextPath("/dashboard/products?q=x")).toBe("/dashboard/products?q=x");
  });

  it("falls back when nothing was asked for", () => {
    expect(safeNextPath(null)).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath("")).toBe(DEFAULT_NEXT_PATH);
  });

  it("refuses a protocol-relative URL", () => {
    // The whole point: `origin + "//evil.com"` navigates off-site.
    expect(safeNextPath("//evil.com")).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath("//evil.com/login")).toBe(DEFAULT_NEXT_PATH);
  });

  it("refuses a backslash variant, which some browsers normalise to //", () => {
    expect(safeNextPath("/\\evil.com")).toBe(DEFAULT_NEXT_PATH);
  });

  it("refuses an absolute URL", () => {
    for (const value of ["https://evil.com", "http://evil.com", "javascript:alert(1)"]) {
      expect(safeNextPath(value), value).toBe(DEFAULT_NEXT_PATH);
    }
  });

  it("refuses an encoded protocol-relative URL", () => {
    expect(safeNextPath("/%2Fevil.com")).toBe(DEFAULT_NEXT_PATH);
    expect(safeNextPath("%2F%2Fevil.com")).toBe(DEFAULT_NEXT_PATH);
  });

  it("refuses a scheme smuggled behind slashes", () => {
    expect(safeNextPath("/https:/evil.com")).toBe(DEFAULT_NEXT_PATH);
  });

  it("refuses control characters", () => {
    expect(safeNextPath("/dashboard\nLocation: https://evil.com")).toBe(DEFAULT_NEXT_PATH);
  });

  it("refuses a malformed escape rather than guessing", () => {
    expect(safeNextPath("/%E0%A4%A")).toBe(DEFAULT_NEXT_PATH);
  });
});
