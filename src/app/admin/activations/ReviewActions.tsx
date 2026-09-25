"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { flushEmailQueue } from "@/lib/email/flushClient";
import { translateDbError } from "@/lib/errors";

export type ReviewPlan = {
  id: string;
  name: string;
  price: string | number;
  currency: string;
};

const DURATIONS = [
  { months: 1, label: "شهر" },
  { months: 3, label: "3 أشهر" },
  { months: 6, label: "6 أشهر" },
  { months: 12, label: "سنة" },
];

export default function ReviewActions({
  requestId,
  plans,
  currentPlanId,
}: {
  requestId: string;
  plans: ReviewPlan[];
  currentPlanId?: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "approve" | "reject">("idle");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Approving is what starts the paid period, so the plan and its length
  // are chosen here rather than assumed — this is the only place in the
  // product where a subscription's start and end dates get written.
  const [planId, setPlanId] = useState<string>(currentPlanId ?? plans[0]?.id ?? "");
  const [months, setMonths] = useState<number>(1);

  const selectedPlan = plans.find((p) => p.id === planId);
  const expiresOn = new Date();
  expiresOn.setMonth(expiresOn.getMonth() + months);
  const expiresLabel = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(expiresOn);

  async function review(decision: "approved" | "rejected") {
    if (decision === "approved" && !planId) {
      setError("اختر باقة أولًا.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_review_activation_request", {
      p_request_id: requestId,
      p_decision: decision,
      p_note: note.trim() || null,
      p_plan_id: decision === "approved" ? planId : null,
      p_duration_months: decision === "approved" ? months : 1,
    });
    setBusy(false);
    if (rpcError) {
      setError(translateDbError(rpcError));
      return;
    }
    // The RPC enqueued the outcome email inside the same transaction;
    // this just asks the server to send it now rather than at 06:00 UTC.
    flushEmailQueue();
    router.refresh();
  }

  if (mode === "approve") {
    return (
      <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
        {error ? <p className="text-xs text-red-600">{error}</p> : null}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-emerald-900">الباقة</span>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="w-full rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-xs font-semibold text-[var(--jaddid-navy)] outline-none"
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — {plan.price} {plan.currency === "SAR" ? "ر.س" : plan.currency}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold text-emerald-900">المدة</span>
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              className="w-full rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-xs font-semibold text-[var(--jaddid-navy)] outline-none"
            >
              {DURATIONS.map((d) => (
                <option key={d.months} value={d.months}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="text-xs font-semibold text-emerald-900">
          سيتم تفعيل «{selectedPlan?.name ?? "—"}» فورًا وينتهي الاشتراك في{" "}
          <span className="font-extrabold">{expiresLabel}</span>، ويُرسل بريد
          بذلك. لا يمكن التراجع عن هذا الإجراء من هنا — هل تؤكد؟
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => review("approved")}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {busy ? "جارٍ التفعيل..." : "تأكيد الموافقة والتفعيل"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setMode("idle")}
            className="rounded-lg border border-[var(--jaddid-border)] bg-white px-3 py-1.5 text-xs font-semibold text-slate-500"
          >
            إلغاء
          </button>
        </div>
      </div>
    );
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
        onClick={() => setMode("approve")}
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
