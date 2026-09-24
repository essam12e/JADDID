import { describe, it, expect } from "vitest";
import { isPublicSupabaseKey } from "./keyShape";

const ANON_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.signature";

describe("isPublicSupabaseKey", () => {
  it("catches the legacy anon JWT by equality", () => {
    expect(isPublicSupabaseKey(ANON_JWT, ANON_JWT)).toBe(true);
  });

  it("catches the newer publishable key by shape", () => {
    // The case the first version of this guard missed: a different
    // string for the same mistake, so equality alone let it through and
    // every privileged query kept returning 403.
    expect(isPublicSupabaseKey("sb_publishable_abc123XYZ", ANON_JWT)).toBe(true);
  });

  it("catches a publishable key even when the anon key is unknown", () => {
    expect(isPublicSupabaseKey("sb_publishable_abc123XYZ")).toBe(true);
    expect(isPublicSupabaseKey("sb_publishable_abc123XYZ", null)).toBe(true);
  });

  it("accepts a real secret key", () => {
    expect(isPublicSupabaseKey("sb_secret_oiXyZ123", ANON_JWT)).toBe(false);
  });

  it("accepts the legacy service_role JWT", () => {
    const serviceJwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.sig";
    expect(isPublicSupabaseKey(serviceJwt, ANON_JWT)).toBe(false);
  });

  it("is not fooled by surrounding whitespace on a pasted key", () => {
    // Copy-paste from a dashboard routinely brings a trailing newline.
    expect(isPublicSupabaseKey("  sb_publishable_abc  ", ANON_JWT)).toBe(true);
    expect(isPublicSupabaseKey(`  ${ANON_JWT}\n`, ANON_JWT)).toBe(true);
  });

  it("does not flag an empty value as public", () => {
    // Empty is its own error ("not set"), handled before this check.
    expect(isPublicSupabaseKey("", ANON_JWT)).toBe(false);
    expect(isPublicSupabaseKey("   ", ANON_JWT)).toBe(false);
  });

  it("does not match a key that merely contains the prefix later on", () => {
    expect(isPublicSupabaseKey("sb_secret_sb_publishable_decoy")).toBe(false);
  });
});
