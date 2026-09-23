"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function TemplateActions({
  templateId,
  isActive,
}: {
  templateId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleActive() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase
      .from("message_templates")
      .update({ is_active: !isActive })
      .eq("id", templateId);
    setBusy(false);
    if (rpcError) {
      setError("تعذّر تحديث الحالة.");
      return;
    }
    router.refresh();
  }

  async function remove() {
    if (!confirm("حذف هذا القالب نهائيًا؟")) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.from("message_templates").delete().eq("id", templateId);
    setBusy(false);
    if (rpcError) {
      setError("تعذّر حذف القالب.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
      <button
        type="button"
        disabled={busy}
        onClick={toggleActive}
        className="rounded-lg bg-[var(--jaddid-surface)] px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-60"
      >
        {isActive ? "تعطيل" : "تفعيل"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={remove}
        className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-60"
      >
        حذف
      </button>
    </div>
  );
}
