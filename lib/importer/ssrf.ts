import "server-only";
import { promises as dns } from "node:dns";
import net from "node:net";

/**
 * SSRF guards for the store importer. The importer fetches a URL the
 * user supplies, which is exactly the kind of feature that turns into a
 * server-side-request-forgery hole if the target isn't validated: an
 * attacker could point "their store" at http://169.254.169.254/ (cloud
 * metadata), http://localhost:5432, or an internal-only service and use
 * this server as a proxy to reach it.
 *
 * Defense in depth:
 * 1. Only http/https, only default-ish ports are allowed unless
 *    explicitly it's 80/443.
 * 2. The hostname itself is checked against literal blocked hosts.
 * 3. Every IP address the hostname resolves to (A + AAAA -- an
 *    attacker-controlled DNS name can resolve to a private IP, known as
 *    DNS rebinding) is checked against private/loopback/link-local/
 *    reserved/cloud-metadata ranges.
 * 4. The actual fetch never follows redirects automatically -- each
 *    redirect target is re-validated through this same gate before
 *    being followed, up to a small limit.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
]);

function ipv4ToLong(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return null;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function inCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const ipLong = ipv4ToLong(ip);
  const rangeLong = ipv4ToLong(range);
  if (ipLong === null || rangeLong === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipLong & mask) === (rangeLong & mask);
}

const BLOCKED_IPV4_RANGES = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10", // carrier-grade NAT
  "127.0.0.0/8", // loopback
  "169.254.0.0/16", // link-local, includes 169.254.169.254 cloud metadata
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24", // TEST-NET
  "192.168.0.0/16",
  "198.18.0.0/15",
  "198.51.100.0/24", // TEST-NET-2
  "203.0.113.0/24", // TEST-NET-3
  "224.0.0.0/4", // multicast
  "240.0.0.0/4", // reserved
];

function isBlockedIpv4(ip: string): boolean {
  return BLOCKED_IPV4_RANGES.some((range) => inCidr(ip, range));
}

/**
 * Expands a (possibly "::"-compressed, possibly IPv4-tailed) IPv6 address
 * into its 8 hex groups. Node's URL parser normalizes an IPv4-mapped
 * literal like "::ffff:127.0.0.1" into hex form ("::ffff:7f00:1") --
 * without this, a naive string check for the dotted-quad tail silently
 * stops matching and the mapped-IPv4 defense below is bypassed entirely.
 */
function expandIpv6Groups(ip: string): string[] | null {
  // Normalize an embedded IPv4 tail (e.g. "::ffff:127.0.0.1") into two
  // hex groups first, so the rest of the parser only ever deals with
  // plain hex-group IPv6 syntax.
  const ipv4TailMatch = ip.match(/^(.*:)((?:\d{1,3}\.){3}\d{1,3})$/);
  let working = ip;
  if (ipv4TailMatch) {
    const long = ipv4ToLong(ipv4TailMatch[2]);
    if (long === null) return null;
    const high = ((long >>> 16) & 0xffff).toString(16);
    const low = (long & 0xffff).toString(16);
    working = `${ipv4TailMatch[1]}${high}:${low}`;
  }

  const halves = working.split("::");
  if (halves.length > 2) return null; // "::" may appear at most once

  const head = halves[0] ? halves[0].split(":").filter((s) => s !== "") : [];
  if (halves.length === 1) {
    return head.length === 8 ? head : null;
  }

  const tail = halves[1] ? halves[1].split(":").filter((s) => s !== "") : [];
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;
  return [...head, ...Array(missing).fill("0"), ...tail];
}

function isBlockedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true; // loopback
  if (normalized === "::") return true; // unspecified
  if (normalized.startsWith("fe80:")) return true; // link-local
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local (fc00::/7)

  const groups = expandIpv6Groups(normalized);
  if (groups) {
    // IPv4-mapped IPv6 (::ffff:0:0/96): first 5 groups zero, 6th is ffff,
    // last two groups are the mapped IPv4 address's two 16-bit halves.
    const isV4Mapped = groups.slice(0, 5).every((g) => g === "0") && groups[5] === "ffff";
    if (isV4Mapped) {
      const high = parseInt(groups[6], 16);
      const low = parseInt(groups[7], 16);
      const mapped = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
      return isBlockedIpv4(mapped);
    }
  }
  return false;
}

export type UrlSafetyResult =
  | { safe: true; url: URL }
  | { safe: false; reason: string };

export async function assertSafeImportUrl(
  rawUrl: string,
): Promise<UrlSafetyResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { safe: false, reason: "الرابط غير صحيح." };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { safe: false, reason: "يُسمح فقط بروابط http أو https." };
  }

  // Node's URL keeps the brackets around an IPv6 literal host
  // ("[::1]"); strip them before treating it as a raw IP for net.isIP.
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { safe: false, reason: "لا يمكن استيراد هذا الرابط." };
  }

  // Literal IP in the URL itself.
  const ipVersion = net.isIP(hostname);
  if (ipVersion === 4 && isBlockedIpv4(hostname)) {
    return { safe: false, reason: "لا يمكن استيراد هذا الرابط." };
  }
  if (ipVersion === 6 && isBlockedIpv6(hostname)) {
    return { safe: false, reason: "لا يمكن استيراد هذا الرابط." };
  }

  // Resolve DNS and check every address (defends against DNS rebinding).
  if (ipVersion === 0) {
    let addresses: { address: string; family: number }[];
    try {
      addresses = await dns.lookup(hostname, { all: true, verbatim: true });
    } catch {
      return { safe: false, reason: "تعذّر الوصول إلى هذا النطاق." };
    }

    if (addresses.length === 0) {
      return { safe: false, reason: "تعذّر الوصول إلى هذا النطاق." };
    }

    for (const { address, family } of addresses) {
      if (family === 4 && isBlockedIpv4(address)) {
        return { safe: false, reason: "لا يمكن استيراد هذا الرابط." };
      }
      if (family === 6 && isBlockedIpv6(address)) {
        return { safe: false, reason: "لا يمكن استيراد هذا الرابط." };
      }
    }
  }

  return { safe: true, url };
}

/**
 * Fetches a URL that has already passed assertSafeImportUrl, re-validating
 * every redirect hop before following it (fetch's automatic redirect
 * following would otherwise bypass the checks above entirely).
 */
export async function safeFetch(
  startUrl: string,
  init: RequestInit = {},
  maxRedirects = 3,
): Promise<Response> {
  let currentUrl = startUrl;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const check = await assertSafeImportUrl(currentUrl);
    if (!check.safe) {
      throw new Error(check.reason);
    }

    const response = await fetch(check.url, {
      ...init,
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("إعادة توجيه غير صالحة.");
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    return response;
  }

  throw new Error("عدد كبير جدًا من إعادة التوجيه.");
}
