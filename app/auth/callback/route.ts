import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles Supabase's link-based flows (email confirmation, password
 * recovery) via the PKCE `code` param. This is the fallback/primary path
 * when the project's email templates use {{ .ConfirmationURL }} rather
 * than a raw {{ .Token }} — which is Supabase's default, so this route,
 * not the OTP screen, is what actually works out of the box today.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=auth_callback_failed`,
  );
}
