type Status = "active" | "expiring" | "expired" | "at_risk" | "vip";

const CONFIG: Record<
  Status,
  { label: string; classes: string; icon: React.ReactNode }
> = {
  active: {
    label: "نشط",
    classes: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
        <circle cx="10" cy="10" r="5" />
      </svg>
    ),
  },
  expiring: {
    label: "قريب من الانتهاء",
    classes: "bg-amber-50 text-amber-700 ring-amber-100",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
        <circle cx="10" cy="10" r="7.25" />
        <path d="M10 6v4.2l2.6 1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  expired: {
    label: "منتهٍ",
    classes: "bg-red-50 text-red-700 ring-red-100",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
        <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
      </svg>
    ),
  },
  at_risk: {
    label: "معرّض للفقدان",
    classes: "bg-orange-50 text-orange-700 ring-orange-100",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
        <path d="M10 3.5l7.5 13h-15L10 3.5z" strokeLinejoin="round" />
        <path d="M10 8.2v3.4" strokeLinecap="round" />
        <circle cx="10" cy="14.2" r="0.6" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  vip: {
    label: "VIP",
    classes: "bg-purple-50 text-purple-700 ring-purple-100",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
        <path d="M3 6.5l3.2 2.5L10 4l3.8 5 3.2-2.5-1.4 8.5H4.4L3 6.5z" />
      </svg>
    ),
  },
};

export const STATUS_ORDER: Status[] = ["active", "expiring", "expired", "at_risk", "vip"];

export default function StatusBadge({ status }: { status: Status }) {
  const c = CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ${c.classes}`}
    >
      {c.icon}
      {c.label}
    </span>
  );
}
