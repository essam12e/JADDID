import "server-only";
import { Resend } from "resend";

/**
 * SERVER-SIDE ONLY. Never import this in a client component.
 * Throws loudly instead of silently sending from an unverified/undefined
 * sender if env vars are missing.
 */
export function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set.");
  }
  return new Resend(apiKey);
}

export function getFromAddress() {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    throw new Error("RESEND_FROM_EMAIL is not set.");
  }
  return from;
}
