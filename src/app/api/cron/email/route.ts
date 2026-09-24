import { NextResponse } from "next/server";
import { drainOutbox, enqueueRenewalDigests } from "@/lib/email/outbox";

export const maxDuration = 60;
// Must never be prerendered or cached: it sends email as a side effect.
export const dynamic = "force-dynamic";

/**
 * Daily job: build today's renewal digests, then flush the outbox.
 *
 * Vercel Cron signs its calls with `Authorization: Bearer $CRON_SECRET`.
 * Without CRON_SECRET set we refuse rather than run open to the internet
 * — an unauthenticated caller here could drain the queue on demand.
 */
function authorize(request: Request): string | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return "CRON_SECRET is not configured";
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return "unauthorized";
  return null;
}

async function run(request: Request) {
  const denied = authorize(request);
  if (denied) {
    // Same opaque body either way: a caller probing this endpoint learns
    // nothing about whether the secret is merely missing on our side.
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const digests = await enqueueRenewalDigests(7);
    const drained = await drainOutbox(50);
    return NextResponse.json({ ok: true, digests, ...drained });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "cron failed";
    console.error(`[cron/email] ${message}`);
    return NextResponse.json({ error: "cron failed" }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
