/**
 * Dashboard analytics (Phase 9). Pure aggregation functions over rows
 * the caller already fetched -- no Supabase client here, so these are
 * unit-testable the same way as the status engine and stay reusable if
 * the queries that feed them change.
 */

import type { SubscriptionStatusValue } from "./subscriptionStatus";

export interface SubscriptionRow {
  status_computed: SubscriptionStatusValue;
  price_paid: number;
  created_at: string;
}

export interface RenewalRow {
  amount: number;
  created_at: string;
}

/** A generic "money changed hands on this date" event -- a sale or a renewal, normalized to the same shape for charting. */
export interface MoneyEvent {
  amount: number;
  created_at: string;
}

export interface DashboardStats {
  totalCustomers: number;
  activeSubscriptions: number;
  needsActionCount: number;
  vipCustomers: number;
  revenueThisMonth: number;
}

export function computeDashboardStats(params: {
  customerCount: number;
  vipCount: number;
  subscriptions: SubscriptionRow[];
  renewals: RenewalRow[];
  now?: Date;
}): DashboardStats {
  const now = params.now ?? new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;

  const activeSubscriptions = params.subscriptions.filter(
    (s) => s.status_computed === "active" || s.status_computed === "expiring_soon" || s.status_computed === "expires_today",
  ).length;

  const needsActionCount = params.subscriptions.filter(
    (s) =>
      s.status_computed === "expiring_soon" ||
      s.status_computed === "expires_today" ||
      s.status_computed === "expired" ||
      s.status_computed === "at_risk",
  ).length;

  const isSameMonth = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${d.getMonth()}` === monthKey;
  };

  const salesThisMonth = params.subscriptions
    .filter((s) => isSameMonth(s.created_at))
    .reduce((sum, s) => sum + s.price_paid, 0);
  const renewalsThisMonth = params.renewals
    .filter((r) => isSameMonth(r.created_at))
    .reduce((sum, r) => sum + r.amount, 0);

  return {
    totalCustomers: params.customerCount,
    activeSubscriptions,
    needsActionCount,
    vipCustomers: params.vipCount,
    revenueThisMonth: salesThisMonth + renewalsThisMonth,
  };
}

export interface MonthlyRevenuePoint {
  label: string;
  total: number;
}

/**
 * Buckets sale + renewal amounts into the last `months` calendar months
 * (oldest first), for a simple revenue-over-time chart. Uses each row's
 * own timestamp, not a running balance, so it reflects money actually
 * collected in that month.
 */
export function computeMonthlyRevenue(
  sales: MoneyEvent[],
  renewals: MoneyEvent[],
  months = 6,
  now: Date = new Date(),
): MonthlyRevenuePoint[] {
  const monthNames = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
  ];

  const buckets: MonthlyRevenuePoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ label: monthNames[d.getMonth()], total: 0 });
  }

  const addToBucket = (iso: string, amount: number) => {
    const d = new Date(iso);
    const diffMonths =
      (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    const index = months - 1 - diffMonths;
    if (index >= 0 && index < buckets.length) {
      buckets[index].total += amount;
    }
  };

  for (const s of sales) addToBucket(s.created_at, s.amount);
  for (const r of renewals) addToBucket(r.created_at, r.amount);

  return buckets;
}
