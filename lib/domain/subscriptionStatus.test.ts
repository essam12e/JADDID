import { describe, it, expect } from "vitest";
import {
  computeSubscriptionStatus,
  computeCustomerValueStatus,
  DEFAULT_STATUS_THRESHOLDS,
} from "./subscriptionStatus";

const NOW = new Date("2026-09-23T12:00:00Z");

describe("computeSubscriptionStatus", () => {
  it("is active when far from expiry", () => {
    expect(computeSubscriptionStatus("2026-10-15", NOW)).toBe("active");
  });

  it("is expiring_soon at exactly the threshold boundary (7 days out)", () => {
    expect(computeSubscriptionStatus("2026-09-30", NOW)).toBe("expiring_soon");
  });

  it("is active one day beyond the expiring_soon threshold (8 days out)", () => {
    expect(computeSubscriptionStatus("2026-10-01", NOW)).toBe("active");
  });

  it("is expiring_soon the day after tomorrow", () => {
    expect(computeSubscriptionStatus("2026-09-25", NOW)).toBe("expiring_soon");
  });

  it("is expires_today when the end date is today", () => {
    expect(computeSubscriptionStatus("2026-09-23", NOW)).toBe("expires_today");
  });

  it("is at_risk the day after expiry", () => {
    expect(computeSubscriptionStatus("2026-09-22", NOW)).toBe("at_risk");
  });

  it("is at_risk at exactly the grace-period boundary (3 days overdue)", () => {
    expect(computeSubscriptionStatus("2026-09-20", NOW)).toBe("at_risk");
  });

  it("is expired once the grace period has fully elapsed (4 days overdue)", () => {
    expect(computeSubscriptionStatus("2026-09-19", NOW)).toBe("expired");
  });

  it("is expired long after expiry", () => {
    expect(computeSubscriptionStatus("2025-01-01", NOW)).toBe("expired");
  });

  it("accepts a Date object as well as an ISO string", () => {
    expect(computeSubscriptionStatus(new Date("2026-09-23T00:00:00Z"), NOW)).toBe("expires_today");
  });

  it("ignores the time-of-day component (dates are compared, not instants)", () => {
    const lateInDay = new Date("2026-09-23T23:59:00Z");
    expect(computeSubscriptionStatus("2026-09-23", lateInDay)).toBe("expires_today");
  });

  it("respects custom thresholds", () => {
    const looseThresholds = { ...DEFAULT_STATUS_THRESHOLDS, expiringSoonDays: 14, atRiskGraceDays: 10 };
    expect(computeSubscriptionStatus("2026-10-05", NOW, looseThresholds)).toBe("expiring_soon");
    expect(computeSubscriptionStatus("2026-09-15", NOW, looseThresholds)).toBe("at_risk");
  });
});

describe("computeCustomerValueStatus", () => {
  it("is normal below the VIP threshold", () => {
    expect(computeCustomerValueStatus(0)).toBe("normal");
    expect(computeCustomerValueStatus(2)).toBe("normal");
  });

  it("is vip at exactly the threshold", () => {
    expect(computeCustomerValueStatus(3)).toBe("vip");
  });

  it("is vip above the threshold", () => {
    expect(computeCustomerValueStatus(50)).toBe("vip");
  });

  it("respects a custom threshold", () => {
    expect(computeCustomerValueStatus(1, { ...DEFAULT_STATUS_THRESHOLDS, vipRenewalCount: 1 })).toBe("vip");
  });
});
