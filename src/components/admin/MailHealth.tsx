import { checkAdminAccess, createAdminClient } from "@/lib/supabase/admin";

/**
 * Makes email delivery failures visible instead of silent.
 *
 * The outbox queued four real messages and sent none of them for hours,
 * because SUPABASE_SERVICE_ROLE_KEY held the publishable key and every
 * query came back 403. Nothing in the product said so: the flush is
 * fire-and-forget by design, so the browser never saw the error and no
 * screen showed the queue. This strip is that missing screen.
 */
export default async function MailHealth() {
  const health = await checkAdminAccess();

  let pending = 0;
  let failed = 0;
  let lastError: string | null = null;

  if (health.ok) {
    const admin = createAdminClient();
    const [{ count: p }, { count: f }, { data: recent }] = await Promise.all([
      admin.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "pending"),
      admin.from("email_outbox").select("id", { count: "exact", head: true }).eq("status", "failed"),
      admin
        .from("email_outbox")
        .select("last_error")
        .not("last_error", "is", null)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    pending = p ?? 0;
    failed = f ?? 0;
    lastError = recent?.[0]?.last_error ?? null;
  }

  const broken = !health.ok || failed > 0;
  if (!broken && pending === 0) return null;

  return (
    <div
      role="status"
      className="mb-6 rounded-2xl border p-4"
      style={{
        borderColor: broken ? "#fecaca" : "#fde68a",
        background: broken ? "#fef2f2" : "#fffbeb",
      }}
    >
      <p className="text-sm font-bold" style={{ color: broken ? "#b91c1c" : "#b45309" }}>
        {health.ok ? "حالة إرسال البريد" : "⚠️ إرسال البريد متوقّف"}
      </p>

      {!health.ok ? (
        <p className="mt-1.5 text-xs leading-6 text-red-800">
          الخادم ما يقدر يوصل لطابور البريد، فكل الرسائل محجوزة وما تُرسل. غالبًا
          مفتاح <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> في
          Vercel هو المفتاح العام (publishable) بدل السرّي.
        </p>
      ) : (
        <p className="mt-1.5 text-xs leading-6 text-amber-900">
          {pending} في الانتظار
          {failed > 0 ? ` · ${failed} فشلت` : ""}
          {pending > 0 ? " — تُرسل تلقائيًا عند التفعيل أو في مهمة 9 صباحًا." : ""}
        </p>
      )}

      {lastError ? (
        <p className="mt-2 font-mono text-[11px] text-slate-500" dir="ltr">
          {lastError.slice(0, 200)}
        </p>
      ) : null}
    </div>
  );
}
