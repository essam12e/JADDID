"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ImportResult = {
  status: "completed" | "partial" | "failed";
  total: number;
  imported: number;
  unchanged: number;
  failed: number;
  attempts?: { adapter: string; reason: string }[];
};

export default function ImportRunner({
  storeId,
  storeUrl,
}: {
  storeId: string;
  storeUrl: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function run() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, sourceUrl: storeUrl }),
      });
      const data = await res.json();
      setResult(
        res.ok
          ? data
          : { status: "failed", total: 0, imported: 0, unchanged: 0, failed: 0 },
      );
    } catch {
      setResult({ status: "failed", total: 0, imported: 0, unchanged: 0, failed: 0 });
    }
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      {!result ? (
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
          style={{ background: "var(--gradient-brand)" }}
        >
          {loading ? "جاري الاستيراد..." : "بدء الاستيراد"}
        </button>
      ) : result.status === "failed" ? (
        <p className="rounded-lg bg-red-50 px-3 py-3 text-sm leading-6 text-red-700">
          تعذّر الاستيراد.
          {result.attempts && result.attempts.length > 0 ? (
            <span className="mt-2 block text-xs text-red-600" dir="ltr">
              {result.attempts.map((a) => a.reason).join(" — ")}
            </span>
          ) : null}
        </p>
      ) : (
        <p
          className={`rounded-lg px-3 py-3 text-sm leading-6 ${
            result.status === "completed"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          تم استيراد {result.imported} منتج جديد/محدَّث، {result.unchanged} بدون
          تغيير من أصل {result.total}
          {result.failed > 0 ? `، وتعذّر حفظ ${result.failed}.` : "."}
        </p>
      )}

      <div className="flex gap-2">
        <Link
          href="/dashboard/products"
          className="flex-1 rounded-xl border border-[var(--jaddid-border)] py-2.5 text-center text-sm font-semibold text-slate-600"
        >
          العودة للمنتجات
        </Link>
        {result ? (
          <button
            type="button"
            onClick={() => router.refresh()}
            className="flex-1 rounded-xl border border-[var(--jaddid-border)] py-2.5 text-sm font-semibold text-slate-600"
          >
            تحديث
          </button>
        ) : null}
      </div>
    </div>
  );
}
