import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Everything the dashboard shell needs about the signed-in account, in
 * one round trip (`public.my_account_overview`).
 *
 * This used to be four sequential PostgREST calls in the layout — role,
 * membership, stores, plan — which ran on *every* navigation before a
 * single pixel rendered. One RPC is both faster and the only place that
 * knows whether the account is allowed in at all.
 */
export type AccountOverview = {
  hasOrganization: boolean;
  isPlatformAdmin: boolean;
  fullName?: string | null;
  organizationId?: string;
  organizationName?: string;
  accountNumber?: number;
  status?: "pending_activation" | "active" | "rejected" | "suspended";
  planName?: string | null;
  planSlug?: string | null;
  price?: string | number | null;
  currency?: string | null;
  billingPeriod?: "month" | "year" | null;
  startedAt?: string | null;
  expiresAt?: string | null;
  daysLeft?: number | null;
  isExpired?: boolean;
  limits?: {
    activeCustomers: number | null;
    stores: number | null;
    users: number | null;
  };
  usage?: {
    activeCustomers: number;
    stores: number;
    users: number;
  };
  stores?: { id: string; name: string }[];
  features?: Record<string, boolean>;
};

export async function getAccountOverview(
  supabase: SupabaseClient,
): Promise<AccountOverview> {
  const { data, error } = await supabase.rpc("my_account_overview");
  if (error || !data) {
    // A failed overview must not hand the user a half-rendered dashboard;
    // callers treat "no organization" as "send them to onboarding".
    return { hasOrganization: false, isPlatformAdmin: false };
  }
  return data as AccountOverview;
}

/** Can this account actually use the product right now? */
export function isAccountUsable(account: AccountOverview): boolean {
  return account.status === "active" && !account.isExpired;
}

/** Percentage of a plan limit consumed, or null when the plan is unlimited. */
export function usagePercent(used: number, limit: number | null | undefined): number | null {
  if (limit == null || limit <= 0) return null;
  return Math.min(100, Math.round((used / limit) * 100));
}
