/**
 * Nudges the server to flush the email outbox right after an action that
 * enqueued something, so the user's inbox doesn't wait for the daily cron.
 *
 * Fire-and-forget by design: delivery is the outbox's job, not this
 * call's. If it fails, is blocked, or the user navigates away mid-flight,
 * the cron still picks the row up. `keepalive` keeps it alive across the
 * navigation that usually follows.
 */
export function flushEmailQueue(): void {
  void fetch("/api/email/flush", { method: "POST", keepalive: true }).catch(() => {
    // Intentionally silent: a failed nudge is not a failed action, and
    // surfacing it would only confuse the user about what just happened.
  });
}
