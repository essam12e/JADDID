import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, maskEmail } from "./send";
import {
  welcomeEmail,
  activationSubmittedEmail,
  activationApprovedEmail,
  activationRejectedEmail,
  renewalDigestEmail,
  passwordChangedEmail,
  confirmSignupEmail,
  resetPasswordEmail,
  type RenderedEmail,
  type ExpiringItem,
} from "./templates";

type Payload = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/**
 * Maps an outbox row onto its template. Returns null for a template name
 * we don't know — which is a data problem to record, not a crash.
 */
export function renderTemplate(template: string, payload: Payload): RenderedEmail | null {
  switch (template) {
    case "welcome":
      return welcomeEmail({ name: strOrNull(payload.name) ?? undefined, storeName: str(payload.storeName) });
    case "activation_submitted":
      return activationSubmittedEmail({
        orgName: str(payload.orgName),
        accountNumber: (payload.accountNumber as number | string | null) ?? null,
      });
    case "activation_approved":
      return activationApprovedEmail({ orgName: str(payload.orgName), planName: strOrNull(payload.planName) });
    case "activation_rejected":
      return activationRejectedEmail({ orgName: str(payload.orgName), note: strOrNull(payload.note) });
    case "renewal_digest":
      return renewalDigestEmail({
        storeName: str(payload.storeName),
        items: (Array.isArray(payload.items) ? payload.items : []) as ExpiringItem[],
      });
    case "password_changed":
      return passwordChangedEmail({ name: strOrNull(payload.name) });
    case "confirm_signup":
      return confirmSignupEmail({
        name: strOrNull(payload.name),
        actionLink: str(payload.actionLink),
        code: strOrNull(payload.code),
      });
    case "reset_password":
      return resetPasswordEmail({
        name: strOrNull(payload.name),
        actionLink: str(payload.actionLink),
        code: strOrNull(payload.code),
      });
    default:
      return null;
  }
}

export type DrainSummary = { claimed: number; sent: number; failed: number; retrying: number };

/** Give up after this many tries and stop burning Resend quota on it. */
const MAX_ATTEMPTS = 4;

function backoffMinutes(attempts: number): number {
  return Math.min(60, 5 * 2 ** Math.max(0, attempts - 1));
}

/**
 * Sends everything due in the outbox.
 *
 * Each row is *claimed* with a conditional update before it is sent, so
 * two overlapping runs (the daily cron and a post-action flush firing at
 * the same moment) can't both send the same message: the second update
 * matches zero rows and that runner skips it. Claiming row-by-row costs
 * an extra round trip per email, which is the right trade at this volume
 * — a duplicate email is far more expensive than a round trip.
 */
export async function drainOutbox(limit = 25): Promise<DrainSummary> {
  const supabase = createAdminClient();
  const summary: DrainSummary = { claimed: 0, sent: 0, failed: 0, retrying: 0 };

  const { data: due, error } = await supabase
    .from("email_outbox")
    .select("id, to_email, template, payload, attempts")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`outbox read failed: ${error.message}`);
  if (!due || due.length === 0) return summary;

  for (const row of due) {
    const attempts = (row.attempts ?? 0) + 1;

    // Atomic claim: push scheduled_at out so nothing else picks this row
    // up while we're awaiting Resend.
    const { data: claimed } = await supabase
      .from("email_outbox")
      .update({
        attempts,
        scheduled_at: new Date(Date.now() + backoffMinutes(attempts) * 60_000).toISOString(),
      })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (!claimed) continue; // another runner took it
    summary.claimed += 1;

    const rendered = renderTemplate(row.template, (row.payload ?? {}) as Payload);
    if (!rendered) {
      await supabase
        .from("email_outbox")
        .update({ status: "failed", last_error: `unknown template: ${row.template}` })
        .eq("id", row.id);
      summary.failed += 1;
      continue;
    }

    const result = await sendEmail(row.to_email, rendered);

    if (result.ok) {
      await supabase
        .from("email_outbox")
        .update({ status: "sent", sent_at: new Date().toISOString(), last_error: null })
        .eq("id", row.id);
      summary.sent += 1;
      continue;
    }

    const giveUp = attempts >= MAX_ATTEMPTS;
    await supabase
      .from("email_outbox")
      .update({ status: giveUp ? "failed" : "pending", last_error: result.error })
      .eq("id", row.id);

    if (giveUp) {
      summary.failed += 1;
      console.error(`[email] giving up on ${row.template} to ${maskEmail(row.to_email)}: ${result.error}`);
    } else {
      summary.retrying += 1;
    }
  }

  return summary;
}

/** Builds today's renewal digests. Returns how many were enqueued. */
export async function enqueueRenewalDigests(days = 7): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("enqueue_renewal_digests", { p_days: days });
  if (error) throw new Error(`renewal digest enqueue failed: ${error.message}`);
  return typeof data === "number" ? data : 0;
}
