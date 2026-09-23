import { describe, it, expect } from "vitest";
import { computeDashboardStats, computeMonthlyRevenue } from "./analytics";

const NOW = new Date("2026-09-23T12:00:00Z");

describe("computeDashboardStats", () => {
  it("counts active + expiring_soon + expires_today as active subscriptions", () => {
    const stats = computeDashboardStats({
      customerCount: 5,
      vipCount: 1,
      subscriptions: [
        { status_computed: "active", price_paid: 0, created_at: "2026-01-01" },
        { status_computed: "expiring_soon", price_paid: 0, created_at: "2026-01-01" },
        { status_computed: "expires_today", price_paid: 0, created_at: "2026-01-01" },
        { status_computed: "expired", price_paid: 0, created_at: "2026-01-01" },
        { status_computed: "at_risk", price_paid: 0, created_at: "2026-01-01" },
      ],
      renewals: [],
      now: NOW,
    });
    expect(stats.activeSubscriptions).toBe(3);
  });

  it("counts expiring_soon + expires_today + expired + at_risk as needing action", () => {
    const stats = computeDashboardStats({
      customerCount: 0,
      vipCount: 0,
      subscriptions: [
        { status_computed: "active", price_paid: 0, created_at: "2026-01-01" },
        { status_computed: "expiring_soon", price_paid: 0, created_at: "2026-01-01" },
        { status_computed: "expires_today", price_paid: 0, created_at: "2026-01-01" },
        { status_computed: "expired", price_paid: 0, created_at: "2026-01-01" },
        { status_computed: "at_risk", price_paid: 0, created_at: "2026-01-01" },
      ],
      renewals: [],
      now: NOW,
    });
    expect(stats.needsActionCount).toBe(4);
  });

  it("sums only this calendar month's sales and renewals into revenueThisMonth", () => {
    const stats = computeDashboardStats({
      customerCount: 0,
      vipCount: 0,
      subscriptions: [
        { status_computed: "active", price_paid: 100, created_at: "2026-09-01T00:00:00Z" }, // this month
        { status_computed: "active", price_paid: 999, created_at: "2026-08-31T23:59:00Z" }, // last month, excluded
      ],
      renewals: [
        { amount: 20, created_at: "2026-09-23T00:00:00Z" }, // this month
        { amount: 999, created_at: "2025-09-23T00:00:00Z" }, // same day/month, different year, excluded
      ],
      now: NOW,
    });
    expect(stats.revenueThisMonth).toBe(120);
  });

  it("passes through customerCount and vipCount unchanged", () => {
    const stats = computeDashboardStats({
      customerCount: 42,
      vipCount: 7,
      subscriptions: [],
      renewals: [],
      now: NOW,
    });
    expect(stats.totalCustomers).toBe(42);
    expect(stats.vipCustomers).toBe(7);
  });
});

describe("computeMonthlyRevenue", () => {
  it("buckets a sale and a renewal into the correct months, oldest first", () => {
    const buckets = computeMonthlyRevenue(
      [{ amount: 100, created_at: "2026-04-15T00:00:00Z" }],
      [{ amount: 20, created_at: "2026-09-01T00:00:00Z" }],
      6,
      NOW,
    );
    expect(buckets).toHaveLength(6);
    expect(buckets[0]).toEqual({ label: "أبريل", total: 100 });
    expect(buckets[5]).toEqual({ label: "سبتمبر", total: 20 });
    // months with no activity are still present, at zero
    expect(buckets[1].total).toBe(0);
  });

  it("excludes events older than the requested window", () => {
    const buckets = computeMonthlyRevenue(
      [{ amount: 500, created_at: "2025-01-01T00:00:00Z" }], // 20 months ago, outside a 6-month window
      [],
      6,
      NOW,
    );
    expect(buckets.reduce((sum, b) => sum + b.total, 0)).toBe(0);
  });

  it("sums multiple events landing in the same month", () => {
    const buckets = computeMonthlyRevenue(
      [
        { amount: 100, created_at: "2026-09-05T00:00:00Z" },
        { amount: 50, created_at: "2026-09-20T00:00:00Z" },
      ],
      [],
      6,
      NOW,
    );
    expect(buckets[5].total).toBe(150);
  });
});
