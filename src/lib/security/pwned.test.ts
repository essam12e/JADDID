import { describe, it, expect, vi } from "vitest";
import {
  sha1Hex,
  countInRangeResponse,
  checkPasswordPwned,
  pwnedMessage,
} from "./pwned";

describe("sha1Hex", () => {
  it("matches the known SHA-1 of a famously breached password", async () => {
    // "password" -> 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    expect(await sha1Hex("password")).toBe("5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8");
  });

  it("hashes non-ASCII correctly", async () => {
    // Arabic passwords must hash the same way HIBP hashed them: UTF-8.
    const hash = await sha1Hex("كلمةالمرور");
    expect(hash).toMatch(/^[0-9A-F]{40}$/);
  });
});

describe("countInRangeResponse", () => {
  const body = [
    "003D68EB55068C33ACE09247EE4C639306B:3",
    "012C192B2F16F82EA0EB9EF18D9D539B0DD:1",
    "1E4C9B93F3F0682250B6CF8331B7EE68FD8:37359195",
  ].join("\r\n");

  it("finds the suffix and returns its breach count", () => {
    expect(countInRangeResponse(body, "1E4C9B93F3F0682250B6CF8331B7EE68FD8")).toBe(37359195);
  });

  it("is case-insensitive about the suffix", () => {
    expect(countInRangeResponse(body, "1e4c9b93f3f0682250b6cf8331b7ee68fd8")).toBe(37359195);
  });

  it("returns 0 for a suffix that is not listed", () => {
    expect(countInRangeResponse(body, "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")).toBe(0);
  });

  it("treats padding entries as not-found, not as a hit", () => {
    // The Add-Padding header makes HIBP pad the response with count-0
    // rows; reading one as a hit would reject a perfectly good password.
    const padded = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:0";
    expect(countInRangeResponse(padded, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")).toBe(0);
  });
});

describe("checkPasswordPwned", () => {
  it("sends only the 5-character prefix, never the password", async () => {
    // Typed params so `mock.calls[0][0]` is a known element, not a
    // zero-length tuple.
    const fetchSpy = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response("1E4C9B93F3F0682250B6CF8331B7EE68FD8:37359195"),
    );

    const result = await checkPasswordPwned("password", fetchSpy as unknown as typeof fetch);

    expect(result).toEqual({ checked: true, count: 37359195 });
    const calledUrl = new URL(String(fetchSpy.mock.calls[0][0]));
    const sent = calledUrl.pathname.split("/").pop() ?? "";

    // Assert on the path segment, not the whole URL: the hostname is
    // literally "api.pwnedpasswords.com", so a naive `not.toContain
    // ("password")` over the full URL fails on the domain name and
    // proves nothing about what was actually sent.
    expect(calledUrl.pathname).toBe("/range/5BAA6");
    expect(sent).toBe("5BAA6");
    expect(sent).toHaveLength(5);
    // Neither the password nor the rest of its hash may be on the wire.
    expect(sent).not.toContain("password");
    expect(sent).not.toContain("1E4C9B93");
  });

  it("reports a clean password as count 0", async () => {
    const fetchImpl = vi.fn(async () => new Response("ABCDEF0123456789ABCDEF0123456789ABC:5"));
    const result = await checkPasswordPwned("a-very-unlikely-passphrase", fetchImpl as unknown as typeof fetch);
    expect(result).toEqual({ checked: true, count: 0 });
  });

  it("fails OPEN when the service is unreachable", async () => {
    // A third-party outage must never stop someone signing up.
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    });
    expect(await checkPasswordPwned("password", fetchImpl as unknown as typeof fetch)).toEqual({
      checked: false,
      count: 0,
    });
  });

  it("fails OPEN on a non-200 response", async () => {
    const fetchImpl = vi.fn(async () => new Response("rate limited", { status: 429 }));
    expect(await checkPasswordPwned("password", fetchImpl as unknown as typeof fetch)).toEqual({
      checked: false,
      count: 0,
    });
  });

  it("does not call out at all for an empty password", async () => {
    const fetchImpl = vi.fn();
    expect(await checkPasswordPwned("", fetchImpl as unknown as typeof fetch)).toEqual({
      checked: false,
      count: 0,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("pwnedMessage", () => {
  it("warns only on a confirmed hit", () => {
    expect(pwnedMessage({ checked: true, count: 12 })).toContain("مكشوفة في تسريبات");
    expect(pwnedMessage({ checked: true, count: 0 })).toBeNull();
    expect(pwnedMessage({ checked: false, count: 0 })).toBeNull();
  });
});
