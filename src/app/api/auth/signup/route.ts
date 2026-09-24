import { NextResponse } from "next/server";
import { signupSchema } from "@/lib/validations/auth";
import { sendAuthEmail } from "@/lib/auth/mailLinks";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * Creates the account and sends JADDID's own Arabic confirmation email.
 *
 * Signup moved off the browser's `supabase.auth.signUp()` for exactly one
 * reason: that call makes Supabase send its own confirmation mail, from a
 * template that only exists in its dashboard. Going through
 * `generateLink` server-side gets the same account and the same link,
 * and lets the product send the message it actually wants to send.
 *
 * The response is identical whether or not the address is already
 * registered — the screen must not become a way to test which emails
 * have accounts.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" },
      { status: 400 },
    );
  }

  try {
    await sendAuthEmail({
      kind: "signup",
      email: parsed.data.email,
      password: parsed.data.password,
      fullName: parsed.data.fullName,
      requestUrl: request.url,
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "signup failed";
    console.error(`[auth/signup] ${message}`);
    return NextResponse.json({ error: "تعذّر إنشاء الحساب الآن. حاول مرة ثانية." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
