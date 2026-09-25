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
const PRODUCTION_ORIGIN = "https://j-addid.com";

export function safeOrigin(requestUrl: string): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");

  // Falling back to the request's own origin means the Host header
  // decides where a confirmation link points. A forged Host on an
  // unauthenticated signup would mail the victim a link to the
  // attacker's site, carrying a real token. Every other part of the app
  // falls back to the production origin; so does this.
  const origin = new URL(requestUrl).origin;
  return isLocalOrigin(origin) ? origin : PRODUCTION_ORIGIN;
}

/** Keeps local development working without a configured app URL. */
function isLocalOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  } catch {
    return false;
  }
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

/**
 * Starts an email change and sends both messages in Arabic.
 *
 * Supabase can be configured either way ("Secure email change"): when it
 * is on, BOTH the old and the new address must confirm; when it is off,
 * only the new one does. We cannot read that setting from here, so we
 * ask for both links and let the answer tell us — the old address gets a
 * button if a link came back, and a security notice if it did not.
 * Either way the owner of the address being replaced hears about it.
 *
 * Returns false when the caller is asking too often, so the UI can say
 * so instead of silently doing nothing.
 */
export async function sendEmailChange(params: {
  currentEmail: string;
  newEmail: string;
  fullName?: string | null;
  requestUrl: string;
}): Promise<boolean> {
  const admin = createAdminClient();
  const currentEmail = params.currentEmail.trim().toLowerCase();
  const newEmail = params.newEmail.trim().toLowerCase();

  if (await recentlySent(admin, newEmail, "email_change_confirm", 10, 2)) return false;

  const origin = safeOrigin(params.requestUrl);
  const redirectTo = `${origin}/auth/callback?next=/dashboard/settings/profile`;

  // The new address always has to prove it exists. If this fails there
  // is nothing to confirm, so nothing is sent at all.
  const { data: newLink, error } = await admin.auth.admin.generateLink({
    type: "email_change_new",
    email: currentEmail,
    newEmail,
    options: { redirectTo },
  });
  if (error || !newLink?.properties?.action_link) {
    throw new Error(error?.message ?? "could not generate the confirmation link");
  }

  // Only meaningful when Supabase requires the current address to agree.
  const { data: currentLink } = await admin.auth.admin.generateLink({
    type: "email_change_current",
    email: currentEmail,
    newEmail,
    options: { redirectTo },
  });

  let fullName = params.fullName ?? null;
  if (!fullName && newLink.user?.id) {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", newLink.user.id)
      .maybeSingle();
    fullName = profile?.full_name || null;
  }

  const { error: queueError } = await admin.from("email_outbox").insert([
    {
      to_email: newEmail,
      template: "email_change_confirm",
      payload: {
        name: fullName,
        newEmail,
        actionLink: newLink.properties.action_link,
        code: newLink.properties.email_otp ?? null,
      },
    },
    {
      to_email: currentEmail,
      template: "email_change_notice",
      payload: {
        name: fullName,
        newEmail,
        actionLink: currentLink?.properties?.action_link ?? null,
        code: currentLink?.properties?.email_otp ?? null,
      },
    },
  ]);
  if (queueError) throw new Error(queueError.message);

  await drainOutbox(5);
  return true;
}
