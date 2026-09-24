import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/admin",
  "/onboarding",
  "/pending-activation",
];
const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

/**
 * Pages that are the same for everyone, signed in or not.
 *
 * This list is the single biggest thing standing between a visitor and
 * the landing page. `supabase.auth.getUser()` is a network call to
 * Supabase Auth, and it used to run on EVERY request — so the marketing
 * site waited on a round trip to another service before rendering a page
 * whose content never depends on who is asking.
 *
 * Skipping the refresh here is safe: the moment anyone navigates to a
 * protected route, middleware runs and refreshes the session as before.
 */
const PUBLIC_PATHS = new Set([
  "/",
  "/about",
  "/pricing",
  "/privacy",
  "/terms",
  "/robots.txt",
  "/sitemap.xml",
]);

/**
 * Refreshes the Supabase session on every request and gates protected
 * routes server-side (not just by hiding a link in the UI).
 */
export async function updateSession(request: NextRequest) {
  if (PUBLIC_PATHS.has(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p));
  const isAuthPage = AUTH_PAGES.some((p) => path.startsWith(p));

  if (isProtected && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", path);
    return NextResponse.redirect(redirectUrl);
  }

  // Spec point 3: an unconfirmed account gets nowhere. Supabase normally
  // withholds the session until confirmation, but that is a project
  // setting someone can turn off; the claim on the session is the fact.
  // Free to check here — `user` is already loaded for the cookie refresh,
  // so this costs no extra round trip.
  if (isProtected && user && !user.email_confirmed_at) {
    const verifyUrl = new URL("/verify-email", request.url);
    if (user.email) verifyUrl.searchParams.set("email", user.email);
    return NextResponse.redirect(verifyUrl);
  }

  if (isAuthPage && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}
