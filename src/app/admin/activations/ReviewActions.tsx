"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ReviewActions({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review(decision: "approved" | "rejected") {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_review_activation_request", {
      p_request_id: requestId,
      p_decision: decision,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message || "تعذّر تنفيذ الإجراء.");
      return;
    }
    router.refresh();
  }

  if (mode === "reject") {
    return (
      <div className="space-y-2">
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="سبب الرفض (اختياري، يظهر للمؤسسة)"
          rows={2}
          className="w-full rounded-lg border border-[var(--jaddid-border)] px-3 py-2 text-xs outline-none focus:border-[var(--jaddid-blue)]"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => review("rejected")}
            className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-60"
          >
            تأكيد الرفض
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="rounded-lg border border-[var(--jaddid-border)] px-3 py-1.5 text-xs font-semibold text-slate-500"
          >
            إلغاء
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => review("approved")}
        className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 disabled:opacity-60"
      >
        الموافقة والتفعيل
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setMode("reject")}
        className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-60"
      >
        رفض
      </button>
    </div>
  );
}
