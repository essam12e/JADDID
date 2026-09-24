import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { drainOutbox } from "@/lib/email/outbox";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

/**
 * Flushes the outbox on demand, so an activation approval or a finished
 * onboarding sends within seconds instead of waiting for the daily cron.
 *
 * Safe to expose to any signed-in user: it accepts no recipient, no
 * subject and no body — it only sends rows the database already decided
 * to enqueue, and each row is marked sent exactly once. Hammering it
 * therefore cannot produce a single extra email.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "authentication required" }, { status: 401 });
  }

  try {
    const summary = await drainOutbox(10);
    return NextResponse.json({ ok: true, ...summary });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "flush failed";
    console.error(`[email/flush] ${message}`);
    // Deliberately generic: the caller is a browser and the detail could
    // name internal infrastructure.
    return NextResponse.json({ error: "flush failed" }, { status: 500 });
  }
}
