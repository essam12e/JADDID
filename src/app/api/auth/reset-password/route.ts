import { NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { sendAuthEmail } from "@/lib/auth/mailLinks";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * Sends JADDID's own Arabic password-reset email.
 *
 * Replaces `supabase.auth.resetPasswordForEmail()`, which mails
 * Supabase's dashboard-only English template. Same link, same one-time
 * code, our message.
 *
 * Always answers `{ ok: true }`, including for an address that has no
 * account — the reset screen is the classic place to probe for
 * registered emails.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "بريد إلكتروني غير صحيح" },
      { status: 400 },
    );
  }

  try {
    await sendAuthEmail({
      kind: "recovery",
      email: parsed.data.email,
      requestUrl: request.url,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "reset failed";
    // Logged, not surfaced: the caller still gets the neutral response.
    console.error(`[auth/reset-password] ${message}`);
  }

  return NextResponse.json({ ok: true });
}
