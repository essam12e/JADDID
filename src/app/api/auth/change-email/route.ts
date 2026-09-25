import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { changeEmailSchema } from "@/lib/validations/settings";
import { sendEmailChange } from "@/lib/auth/mailLinks";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * Starts an email change, and sends JADDID's own Arabic messages.
 *
 * The browser could call `supabase.auth.updateUser({ email })` directly,
 * but that makes Supabase send its own English template — the same
 * reason signup and recovery moved server-side. Going through
 * `generateLink` here produces the same tokens and lets the product send
 * the message it wants to send.
 *
 * The current address is taken from the session, never from the request:
 * a caller cannot start a change on someone else's account.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = changeEmailSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "بيانات غير صحيحة" },
      { status: 400 },
    );
  }

  const newEmail = parsed.data.newEmail.toLowerCase();
  if (newEmail === user.email.toLowerCase()) {
    return NextResponse.json({ error: "هذا هو بريدك الحالي." }, { status: 400 });
  }

  try {
    const sent = await sendEmailChange({
      currentEmail: user.email,
      newEmail,
      fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
      requestUrl: request.url,
    });

    if (!sent) {
      return NextResponse.json(
        { error: "أرسلنا رسالة تأكيد قبل شوي. راجع بريدك أو انتظر عشر دقائق." },
        { status: 429 },
      );
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "email change failed";
    console.error(`[auth/change-email] ${message}`);
    // Never echo the cause: it can name an existing account.
    return NextResponse.json(
      { error: "تعذّر بدء تغيير البريد الآن. حاول مرة ثانية." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
