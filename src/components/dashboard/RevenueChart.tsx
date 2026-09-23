import type { MonthlyRevenuePoint } from "@/lib/domain/analytics";

/**
 * Dependency-free bar chart (plain divs, no charting library) -- keeps
 * the bundle self-contained and avoids relying on an external package
 * this sandbox may not be able to fetch reliably.
 */
export default function RevenueChart({ data }: { data: MonthlyRevenuePoint[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));

  return (
    <div className="flex items-end gap-3" style={{ height: 140 }} dir="ltr">
      {data.map((point) => {
        const heightPct = Math.max(4, Math.round((point.total / max) * 100));
        return (
          <div key={point.label} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-[10px] font-semibold text-slate-500">
              {point.total > 0 ? point.total.toLocaleString("en-US") : ""}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t-md"
                style={{
                  height: `${heightPct}%`,
                  background: point.total > 0 ? "var(--gradient-brand)" : "var(--jaddid-border)",
                  minHeight: 4,
                }}
              />
            </div>
            <span className="text-[10px] text-slate-400" dir="rtl">
              {point.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
