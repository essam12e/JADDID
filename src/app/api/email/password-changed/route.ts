import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { drainOutbox } from "@/lib/email/outbox";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * Sends the "your password was changed" notice.
 *
 * The password change itself happens client-side via
 * `supabase.auth.updateUser`, so there is no server hook to hang this on
 * — and a trigger on `auth.users` would mean writing into a schema
 * Supabase owns and migrates. This route is the smaller risk.
 *
 * It takes NO parameters: the recipient is read from the caller's own
 * session, so it cannot be pointed at anyone else's address. The worst a
 * caller can do is notify themselves.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const { error } = await admin.from("email_outbox").insert({
      to_email: user.email.toLowerCase(),
      template: "password_changed",
      payload: { name: profile?.full_name ?? null },
      // Deliberately no dedupe_key: changing a password twice in one day
      // is exactly the case where the second notice matters most.
    });
    if (error) throw new Error(error.message);

    await drainOutbox(5);
    return NextResponse.json({ ok: true });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "notice failed";
    console.error(`[email/password-changed] ${message}`);
    // The password change already succeeded; never imply otherwise.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
