import Link from "next/link";
import { usagePercent, type AccountOverview } from "@/lib/account";

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null | undefined;
}) {
  const pct = usagePercent(used, limit);
  // At 90% the merchant needs to act before the next sale is refused,
  // so the bar changes colour before the limit is actually hit.
  const tone = pct == null ? "#2f6bff" : pct >= 90 ? "#ef4444" : pct >= 75 ? "#f59e0b" : "#10b981";

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-xs font-bold text-[var(--jaddid-navy)]">
          {used.toLocaleString("en-US")}
          {limit != null ? ` / ${limit.toLocaleString("en-US")}` : " / غير محدود"}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--jaddid-surface)]">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${pct ?? 100}%`, background: tone }}
        />
      </div>
    </div>
  );
}

/**
 * Spec point 4: the merchant must be able to see, at a glance, which plan
 * they are on, when it started, when it ends, and how much of it they have
 * used. Every number here comes from the same `my_account_overview()` call
 * the layout already made — the card costs no extra query.
 */
export default function SubscriptionCard({ account }: { account: AccountOverview }) {
  const started = formatDate(account.startedAt);
  const expires = formatDate(account.expiresAt);
  const daysLeft = account.daysLeft ?? null;

  // Roughly a month out is when a renewal conversation should start.
  const endingSoon = daysLeft != null && daysLeft <= 30;

  return (
    <section className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">باقتك الحالية</p>
          <p className="text-lg font-extrabold text-[var(--jaddid-navy)]">
            {account.planName ?? "—"}
          </p>
          {account.price != null ? (
            <p className="mt-0.5 text-xs text-slate-500">
              {Number(account.price).toLocaleString("en-US")}{" "}
              {account.currency === "SAR" ? "ر.س" : account.currency} /{" "}
              {account.billingPeriod === "year" ? "سنة" : "شهر"}
            </p>
          ) : null}
        </div>

        {daysLeft != null ? (
          <div
            className="rounded-full px-3 py-1 text-xs font-bold"
            style={{
              background: endingSoon ? "#fffbeb" : "#ecfdf5",
              color: endingSoon ? "#b45309" : "#047857",
            }}
          >
            {daysLeft === 0 ? "ينتهي اليوم" : `باقي ${daysLeft} يوم`}
          </div>
        ) : null}
      </div>

      {started || expires ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          {started ? (
            <div className="rounded-xl bg-[var(--jaddid-surface)] px-3 py-2.5">
              <p className="text-[11px] text-slate-500">بداية الاشتراك</p>
              <p className="text-sm font-bold text-[var(--jaddid-navy)]">{started}</p>
            </div>
          ) : null}
          {expires ? (
            <div className="rounded-xl bg-[var(--jaddid-surface)] px-3 py-2.5">
              <p className="text-[11px] text-slate-500">نهاية الاشتراك</p>
              <p className="text-sm font-bold text-[var(--jaddid-navy)]">{expires}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        <UsageBar
          label="العملاء النشطون"
          used={account.usage?.activeCustomers ?? 0}
          limit={account.limits?.activeCustomers}
        />
        <UsageBar
          label="المتاجر"
          used={account.usage?.stores ?? 0}
          limit={account.limits?.stores}
        />
        <UsageBar
          label="أعضاء الفريق"
          used={account.usage?.users ?? 0}
          limit={account.limits?.users}
        />
      </div>

      {endingSoon ? (
        <Link
          href="/pricing"
          className="mt-4 inline-block rounded-xl px-4 py-2 text-xs font-bold text-white"
          style={{ background: "var(--gradient-brand)" }}
        >
          جدّد أو رقّي باقتك
        </Link>
      ) : null}
    </section>
  );
}
