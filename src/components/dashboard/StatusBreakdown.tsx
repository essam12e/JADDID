import {
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_STYLES,
  type SubscriptionStatusValue,
} from "@/lib/domain/subscriptionStatus";

const ORDER: SubscriptionStatusValue[] = [
  "active",
  "expiring_soon",
  "expires_today",
  "at_risk",
  "expired",
];

const BAR_COLORS: Record<SubscriptionStatusValue, string> = {
  active: "bg-emerald-500",
  expiring_soon: "bg-amber-500",
  expires_today: "bg-orange-500",
  at_risk: "bg-red-500",
  expired: "bg-slate-300",
};

export default function StatusBreakdown({
  counts,
}: {
  counts: Record<SubscriptionStatusValue, number>;
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (total === 0) {
    return <p className="text-sm text-slate-400">لا توجد اشتراكات بعد.</p>;
  }

  return (
    <div className="space-y-2.5">
      {ORDER.map((status) => {
        const count = counts[status] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={status}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className={`rounded-full px-2 py-0.5 font-semibold ${SUBSCRIPTION_STATUS_STYLES[status]}`}>
                {SUBSCRIPTION_STATUS_LABELS[status]}
              </span>
              <span className="text-slate-500">{count}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--jaddid-surface)]">
              <div className={`h-full rounded-full ${BAR_COLORS[status]}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
