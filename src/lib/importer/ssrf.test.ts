import { describe, it, expect, vi, beforeEach } from "vitest";

// dns.lookup is mocked so the DNS-rebinding-defense branch (a hostname
// that isn't a literal IP) is testable without real network access --
// this sandbox's egress is blocked anyway, but this is also just the
// correct way to unit test this branch: it isolates "does the code
// correctly reject every address DNS returns" from "is DNS reachable
// right now."
const lookupMock = vi.fn();
vi.mock("node:dns", () => ({
  promises: { lookup: (...args: unknown[]) => lookupMock(...args) },
}));

const { assertSafeImportUrl } = await import("./ssrf");

beforeEach(() => {
  lookupMock.mockReset();
});

describe("assertSafeImportUrl", () => {
  it("rejects a non-http(s) protocol", async () => {
    const result = await assertSafeImportUrl("ftp://example.com/file");
    expect(result.safe).toBe(false);
  });

  it("rejects an unparseable URL", async () => {
    const result = await assertSafeImportUrl("not a url");
    expect(result.safe).toBe(false);
  });

  it("rejects the literal hostname localhost", async () => {
    const result = await assertSafeImportUrl("http://localhost/products.json");
    expect(result.safe).toBe(false);
  });

  it("rejects the cloud metadata hostname", async () => {
    const result = await assertSafeImportUrl("http://metadata.google.internal/");
    expect(result.safe).toBe(false);
  });

  it("rejects a literal loopback IP", async () => {
    const result = await assertSafeImportUrl("http://127.0.0.1/");
    expect(result.safe).toBe(false);
  });

  it("rejects the literal cloud metadata IP (169.254.169.254)", async () => {
    const result = await assertSafeImportUrl("http://169.254.169.254/latest/meta-data/");
    expect(result.safe).toBe(false);
  });

  it("rejects a private 10.x address", async () => {
    const result = await assertSafeImportUrl("http://10.0.0.5:8080/");
    expect(result.safe).toBe(false);
  });

  it("rejects a private 192.168.x address", async () => {
    const result = await assertSafeImportUrl("http://192.168.1.1/");
    expect(result.safe).toBe(false);
  });

  it("rejects IPv6 loopback ::1", async () => {
    const result = await assertSafeImportUrl("http://[::1]/");
    expect(result.safe).toBe(false);
  });

  it("rejects an IPv4-mapped IPv6 address pointing at a blocked range (dotted-quad form)", async () => {
    const result = await assertSafeImportUrl("http://[::ffff:127.0.0.1]/");
    expect(result.safe).toBe(false);
  });

  it("rejects an IPv4-mapped IPv6 address in hex form -- the form Node's URL parser actually normalizes to", async () => {
    // new URL("http://[::ffff:127.0.0.1]/").hostname is "[::ffff:7f00:1]",
    // not the dotted-quad literal above -- this is the real bypass a naive
    // string-suffix check would miss.
    const result = await assertSafeImportUrl("http://[::ffff:7f00:1]/");
    expect(result.safe).toBe(false);
  });

  it("rejects an IPv4-mapped IPv6 address for the cloud metadata IP in hex form", async () => {
    // 169.254.169.254 -> 0xa9fea9fe -> a9fe:a9fe
    const result = await assertSafeImportUrl("http://[::ffff:a9fe:a9fe]/");
    expect(result.safe).toBe(false);
  });

  it("rejects a hostname whose DNS resolves to a private address (rebinding defense)", async () => {
    lookupMock.mockResolvedValueOnce([{ address: "10.1.2.3", family: 4 }]);
    const result = await assertSafeImportUrl("http://attacker-controlled.example.com/");
    expect(result.safe).toBe(false);
  });

  it("rejects a hostname where only ONE of several resolved addresses is private", async () => {
    lookupMock.mockResolvedValueOnce([
      { address: "93.184.216.34", family: 4 }, // public
      { address: "169.254.169.254", family: 4 }, // metadata -- must still block
    ]);
    const result = await assertSafeImportUrl("http://mixed-dns.example.com/");
    expect(result.safe).toBe(false);
  });

  it("allows a hostname whose DNS resolves only to public addresses", async () => {
    lookupMock.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }]);
    const result = await assertSafeImportUrl("https://shop.example.com/products.json");
    expect(result.safe).toBe(true);
  });

  it("rejects when DNS resolution fails entirely", async () => {
    lookupMock.mockRejectedValueOnce(new Error("ENOTFOUND"));
    const result = await assertSafeImportUrl("http://does-not-exist.invalid/");
    expect(result.safe).toBe(false);
  });

  it("rejects when DNS resolves to zero addresses", async () => {
    lookupMock.mockResolvedValueOnce([]);
    const result = await assertSafeImportUrl("http://no-records.example.com/");
    expect(result.safe).toBe(false);
  });

  it("allows a public IPv6 address", async () => {
    // 2001:4860:4860::8888 is a public Google DNS address, not in any
    // blocked range.
    const result = await assertSafeImportUrl("http://[2001:4860:4860::8888]/");
    expect(result.safe).toBe(true);
  });
});

describe("port restrictions", () => {
  it("allows the ports a storefront actually answers on", async () => {
    lookupMock.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    for (const url of [
      "https://shop.example.com/",
      "https://shop.example.com:443/",
      "http://shop.example.com:80/",
      "https://shop.example.com:8443/",
    ]) {
      const result = await assertSafeImportUrl(url);
      expect(result.safe, url).toBe(true);
    }
  });

  it("refuses service ports, so the importer is not a port scanner", async () => {
    for (const port of [22, 25, 3306, 5432, 6379, 9200, 11211]) {
      const result = await assertSafeImportUrl(`https://shop.example.com:${port}/`);
      expect(result.safe, `port ${port}`).toBe(false);
    }
  });
});
