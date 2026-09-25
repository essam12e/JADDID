"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateDbError } from "@/lib/errors";

/**
 * Asking for a different plan.
 *
 * This used to open WhatsApp and nothing else — no row anywhere, so the
 * admin panel had no queue and the merchant's message was the only
 * record of what was asked for. Now the ask is recorded first; WhatsApp
 * still opens, because a human is what actually collects the money.
 */
export default function ChoosePlanButton({
  planId,
  planName,
  whatsappUrl,
}: {
  planId: string;
  planName: string;
  whatsappUrl: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function choose() {
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("request_plan_change", { p_plan_id: planId });

    if (rpcError) {
      setError(translateDbError(rpcError));
      setBusy(false);
      return;
    }

    setDone(true);
    setBusy(false);
    router.refresh();

    // Opened after the request is safely stored: if the popup is blocked
    // the ask still reached the admin.
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }

  if (done) {
    return (
      <p className="mt-5 rounded-xl bg-emerald-50 px-3 py-2.5 text-center text-xs leading-5 text-emerald-700">
        وصل طلبك لباقة {planName}. نتواصل معك على واتساب لإتمام الاشتراك.
      </p>
    );
  }

  return (
    <div className="mt-5">
      <button
        type="button"
        onClick={choose}
        disabled={busy}
        className="w-full rounded-xl px-4 py-2.5 text-center text-xs font-bold text-white disabled:opacity-70"
        style={{ background: "var(--gradient-brand)" }}
      >
        {busy ? "جاري الإرسال..." : "اختر هذي الباقة"}
      </button>
      {error ? <p className="mt-2 text-center text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
