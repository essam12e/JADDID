import "server-only";
import { getResendClient, getFromAddress } from "@/lib/resend";
import type { RenderedEmail } from "./templates";

export type SendResult = { ok: true; id: string | null } | { ok: false; error: string };

/**
 * Masks an address before it reaches a log line. Delivery debugging needs
 * to know *which* address failed; it does not need the whole inbox in
 * plaintext in a log aggregator.
 */
export function maskEmail(address: string): string {
  const [user, domain] = String(address).split("@");
  if (!domain) return "***";
  const head = user.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
}

/**
 * Never throws. A transactional email failing must not take down the
 * request that triggered it, and the outbox needs the reason as a value
 * so it can decide between retry and give-up.
 */
export async function sendEmail(to: string, email: RenderedEmail): Promise<SendResult> {
  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: getFromAddress(),
      to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    if (error) {
      return { ok: false, error: `${error.name ?? "resend_error"}: ${error.message ?? "unknown"}` };
    }
    return { ok: true, id: data?.id ?? null };
  } catch (cause) {
    // Covers the missing-env throws from getResendClient/getFromAddress
    // and any network failure. The message is written to the outbox row,
    // so keep it descriptive but free of anything secret.
    const message = cause instanceof Error ? cause.message : "unknown send failure";
    return { ok: false, error: message };
  }
}
