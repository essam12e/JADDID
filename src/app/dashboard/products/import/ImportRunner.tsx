"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DEFAULT_IMPORT_LIMIT,
  IMPORT_LIMIT_CHOICES,
  MAX_IMPORT_LIMIT,
} from "@/lib/validations/import";

type ImportResult = {
  status: "completed" | "partial" | "failed";
  total: number;
  imported: number;
  unchanged: number;
  failed: number;
  reason?: string;
  attempts?: { adapter: string; reason: string }[];
  /** The crawl stopped on its time budget with pages still queued. */
  partial?: boolean;
  remaining?: number;
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
  const [progress, setProgress] = useState<{ read: number; left: number } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [limit, setLimit] = useState<number>(DEFAULT_IMPORT_LIMIT);

  /**
   * Imports the whole catalogue, however many passes that takes.
   *
   * One request can only crawl for as long as the serverless function
   * lives, and the store rate-limits us on top of that — so a large shop
   * comes back marked `partial`. Each pass skips what is already stored,
   * so calling again continues rather than repeats. The merchant presses
   * the button once.
   */
  async function run() {
    setLoading(true);
    setResult(null);
    setProgress(null);

    const failure: ImportResult = {
      status: "failed",
      total: 0,
      imported: 0,
      unchanged: 0,
      failed: 0,
    };

    let imported = 0;
    let unchanged = 0;
    let failed = 0;
    let total = 0;
    let last: ImportResult | null = null;

    // Bounded so a store that always reports work left can't loop here
    // forever; what is left is reported instead. A rate-limited store
    // hands back roughly sixty products a pass, so this covers a
    // catalogue of over a thousand.
    for (let pass = 0; pass < 20; pass++) {
      let data: ImportResult;
      try {
        const res = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storeId, sourceUrl: storeUrl, limit }),
        });
        data = await res.json();
        if (!res.ok) {
          setResult(last ?? failure);
          setLoading(false);
          return;
        }
      } catch {
        setResult(last ?? failure);
        setLoading(false);
        return;
      }

      if (data.status === "failed" && pass === 0) {
        setResult(data);
        setLoading(false);
        return;
      }

      imported += data.imported ?? 0;
      unchanged += data.unchanged ?? 0;
      failed += data.failed ?? 0;
      total += data.total ?? 0;
      last = { ...data, imported, unchanged, failed, total };

      if (!data.partial) break;
      // The merchant asked for this many; stop once they have them.
      if (total >= limit) break;

      setProgress({ read: total, left: data.remaining ?? 0 });
      // Nothing new came back, so another identical pass won't help.
      if ((data.total ?? 0) === 0) break;
    }

    setProgress(null);
    setResult(last ?? failure);
    setLoading(false);
    // Whatever came in is already stored; show it on the products page.
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {!result ? (
        <>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              كم منتجًا تبغى تستورد؟
            </span>
            <select
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              disabled={loading}
              className="w-full rounded-xl border border-[var(--jaddid-border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--jaddid-blue)] focus:ring-2 focus:ring-[var(--jaddid-blue)]/20"
            >
              {IMPORT_LIMIT_CHOICES.map((choice) => (
                <option key={choice} value={choice}>
                  {choice === MAX_IMPORT_LIMIT ? "كل المنتجات" : `${choice} منتج`}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              تقدر تعيد الاستيراد لاحقًا وياخذ اللي بقي — ما يعيد اللي دخل.
            </span>
          </label>

          <button
          type="button"
          onClick={run}
          disabled={loading}
          className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-70"
          style={{ background: "var(--gradient-brand)" }}
        >
          {loading
            ? progress
              ? `جاري الاستيراد... قرأنا ${progress.read}، باقي ${progress.left}`
              : "جاري الاستيراد..."
            : "بدء الاستيراد"}
          </button>
        </>
      ) : result.status === "failed" ? (
        <p className="rounded-lg bg-red-50 px-3 py-3 text-sm leading-6 text-red-700">
          تعذّر الاستيراد.
          {result.reason ? (
            <span className="mt-2 block text-xs text-red-600">{result.reason}</span>
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
          {result.partial && result.remaining ? (
            <span className="mt-2 block text-xs">
              بقي {result.remaining} صفحة منتج ما وصلناها في هالجولة — اضغط «بدء
              الاستيراد» مرة ثانية ويكمل من عندها.
            </span>
          ) : null}
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
