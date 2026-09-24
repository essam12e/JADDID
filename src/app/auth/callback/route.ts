import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles Supabase's link-based flows (email confirmation, password
 * recovery) via the PKCE `code` param.
 *
 * Two real-world failures are handled explicitly rather than lumped into
 * one error:
 *
 *  - The code was already spent. Mail clients and security scanners
 *    pre-fetch links, so the *user's* click is frequently the second one.
 *    The account is confirmed; they just need to sign in.
 *  - The link was opened in a different browser or device from the one
 *    that started the signup. PKCE keeps the `code_verifier` in that
 *    first browser's storage, so the exchange cannot succeed here — no
 *    amount of retrying fixes it, and saying "invalid link" sends people
 *    in circles.
 *
 * In both cases the account is usually fine, so send them to the login
 * screen with a notice instead of a dead end.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const errorParam = searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(`${origin}/login?notice=link_unusable`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    // The exchange failed — but if a valid session already exists (the
    // first click landed), just carry on instead of bouncing them out.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    return NextResponse.redirect(`${origin}/login?notice=link_unusable`);
  }

  return NextResponse.redirect(`${origin}/login?notice=link_unusable`);
}
