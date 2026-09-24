import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { drainOutbox } from "@/lib/email/outbox";

/**
 * Sends JADDID's own Arabic auth emails instead of Supabase's.
 *
 * `auth.admin.generateLink()` mints the confirmation / recovery link and
 * its one-time code **without mailing anything**, which is the whole
 * trick: Supabase's own templates live only in its dashboard — no
 * migration, and no API this project holds, can reach them — so relying
 * on them meant shipping a stock English message to Arabic merchants
 * forever, and hoping somebody remembered to paste a template in.
 */

/** Only ever redirect back to our own origin — never a caller-supplied host. */
export function safeOrigin(requestUrl: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(requestUrl).origin;
}

/**
 * Cheap, storage-free throttle: the outbox already records every message
 * with its recipient and time, so counting recent rows is an accurate
 * per-address rate limit without another table to keep.
 */
export async function recentlySent(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  template: string,
  windowMinutes = 10,
  max = 3,
): Promise<boolean> {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count } = await admin
    .from("email_outbox")
    .select("id", { count: "exact", head: true })
    .eq("to_email", email.toLowerCase())
    .eq("template", template)
    .gte("created_at", since);
  return (count ?? 0) >= max;
}

export type LinkKind = "signup" | "recovery";

/**
 * Generates the link and queues the matching Arabic email.
 *
 * Returns nothing useful on purpose — callers must answer the browser
 * identically whether or not an account exists, so no screen in the
 * product can be used to enumerate registered addresses.
 */
export async function sendAuthEmail(params: {
  kind: LinkKind;
  email: string;
  password?: string;
  fullName?: string | null;
  requestUrl: string;
}): Promise<void> {
  const admin = createAdminClient();
  const email = params.email.trim().toLowerCase();
  const template = params.kind === "signup" ? "confirm_signup" : "reset_password";

  if (await recentlySent(admin, email, template)) return;

  const origin = safeOrigin(params.requestUrl);
  const redirectTo =
    params.kind === "signup"
      ? `${origin}/auth/callback`
      : `${origin}/auth/callback?next=/reset-password`;

  const { data, error } =
    params.kind === "signup"
      ? await admin.auth.admin.generateLink({
          type: "signup",
          email,
          password: params.password ?? "",
          options: { data: { full_name: params.fullName ?? "" }, redirectTo },
        })
      : await admin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo },
        });

  // Most often "user already registered" (signup) or "user not found"
  // (recovery). Both are normal and both must look identical to the
  // browser, so this stays silent rather than surfacing.
  if (error || !data?.properties?.action_link) return;

  let fullName = params.fullName ?? null;
  if (!fullName && data.user?.id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", data.user.id)
      .maybeSingle();
    fullName = profile?.full_name || null;
  }

  const { error: queueError } = await admin.from("email_outbox").insert({
    to_email: email,
    template,
    payload: {
      name: fullName,
      actionLink: data.properties.action_link,
      code: data.properties.email_otp ?? null,
    },
    // No dedupe key: asking for a second reset link is a legitimate
    // thing to do, and `recentlySent` already bounds the rate.
  });
  if (queueError) throw new Error(queueError.message);

  await drainOutbox(5);
}
