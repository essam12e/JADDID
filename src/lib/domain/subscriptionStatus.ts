/**
 * Customer Status Engine (spec sections 25-26).
 *
 * Two independent statuses are computed here, deliberately kept separate
 * because they answer different questions and must not be conflated in
 * the UI:
 *
 *  - Subscription Status: is THIS subscription currently paid-for and
 *    for how much longer (active / expiring_soon / expires_today /
 *    expired / at_risk).
 *  - Customer Value Status: is this customer, overall, someone worth
 *    extra attention (normal / vip) -- based on how many times they've
 *    renewed, not on any single subscription's state.
 *
 * Both are pure functions of their inputs (no DB calls, no Date.now()
 * baked in unless the caller omits `now`), so they're trivially unit
 * testable and safe to reuse on the server (page components) and in the
 * browser (client components) without duplicating the thresholds.
 */

export type SubscriptionStatusValue =
  | "active"
  | "expiring_soon"
  | "expires_today"
  | "expired"
  | "at_risk";

export type CustomerValueStatus = "normal" | "vip";

export interface StatusThresholds {
  /** Days before end_date at which a still-active subscription becomes "expiring_soon". */
  expiringSoonDays: number;
  /** Days after end_date, while still unrenewed, that count as "at_risk" rather than plain "expired". */
  atRiskGraceDays: number;
  /** Minimum lifetime renewal_count for a customer to be flagged VIP. */
  vipRenewalCount: number;
}

export const DEFAULT_STATUS_THRESHOLDS: StatusThresholds = {
  expiringSoonDays: 7,
  atRiskGraceDays: 3,
  vipRenewalCount: 3,
};

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / msPerDay);
}

/**
 * Computes the subscription status from its end_date alone. A
 * subscription already marked "expired" or "cancelled" in the database
 * (e.g. by an explicit action) is passed through untouched by the
 * caller -- this function only derives status from dates for
 * subscriptions the caller considers active/unresolved.
 */
export function computeSubscriptionStatus(
  endDate: string | Date,
  now: Date = new Date(),
  thresholds: StatusThresholds = DEFAULT_STATUS_THRESHOLDS,
): SubscriptionStatusValue {
  const end = typeof endDate === "string" ? new Date(endDate) : endDate;
  const diff = daysBetween(now, end); // positive = end is in the future

  if (diff < 0) {
    const daysOverdue = -diff;
    return daysOverdue <= thresholds.atRiskGraceDays ? "at_risk" : "expired";
  }
  if (diff === 0) return "expires_today";
  if (diff <= thresholds.expiringSoonDays) return "expiring_soon";
  return "active";
}

export function computeCustomerValueStatus(
  renewalCount: number,
  thresholds: StatusThresholds = DEFAULT_STATUS_THRESHOLDS,
): CustomerValueStatus {
  return renewalCount >= thresholds.vipRenewalCount ? "vip" : "normal";
}

export const SUBSCRIPTION_STATUS_LABELS: Record<SubscriptionStatusValue, string> = {
  active: "نشط",
  expiring_soon: "ينتهي قريبًا",
  expires_today: "ينتهي اليوم",
  expired: "منتهي",
  at_risk: "في خطر",
};

export const SUBSCRIPTION_STATUS_STYLES: Record<SubscriptionStatusValue, string> = {
  active: "bg-emerald-50 text-emerald-700",
  expiring_soon: "bg-amber-50 text-amber-700",
  expires_today: "bg-orange-50 text-orange-700",
  expired: "bg-slate-100 text-slate-500",
  at_risk: "bg-red-50 text-red-700",
};
