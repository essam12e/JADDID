import type { NextConfig } from "next";

/**
 * Security headers (Phase 11). Applied to every route via headers()
 * rather than per-page, so a new route can't accidentally ship without
 * them. The CSP is intentionally not maximally strict about
 * connect-src -- it has to allow the Supabase project URL (set at
 * build/runtime via NEXT_PUBLIC_SUPABASE_URL) for the browser client to
 * work at all -- but it does block framing entirely (frame-ancestors
 * 'none'), inline object/embed content, and any script/style origin
 * outside self and the small set of things this app actually loads.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
let supabaseOrigin = "";
try {
  supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : "";
} catch {
  supabaseOrigin = "";
}

const csp = [
  "default-src 'self'",
  // Next.js needs 'unsafe-inline' for its own hydration/RSC bootstrap
  // scripts and 'unsafe-eval' in dev only; kept broad here since this
  // is a from-scratch app with no third-party ad/analytics scripts to
  // exclude, but scoped to 'self' -- no external script hosts.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: blob:", // product images are imported from arbitrary merchant store domains
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin}`.trim(),
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
