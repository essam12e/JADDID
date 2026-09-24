import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAccountUsable } from "@/lib/account";
import { getAccountOverviewCached } from "@/lib/account.server";
import DashboardNav from "./DashboardNav";

/**
 * The gate for the whole product.
 *
 * Three things are enforced here, in order, before any dashboard page
 * renders — and all three are spec requirements that previously existed
 * only as intentions:
 *
 *   1. signed in            (was enforced)
 *   2. email actually confirmed   (was NOT — an unconfirmed session
 *      could reach the dashboard, which point 3 of the spec forbids)
 *   3. account approved by an admin and not expired  (was NOT — a
 *      pending merchant could roam the dashboard and only discover the
 *      truth when an action failed)
 *
 * All of it comes from ONE `my_account_overview()` call. The previous
 * version issued four sequential PostgREST requests here, on every
 * navigation, before rendering anything.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Supabase only issues a session after confirmation *when* the project
  // requires it. Checking the claim directly means the gate holds even if
  // that project setting is ever turned off by mistake.
  if (!user.email_confirmed_at) {
    redirect(`/verify-email?email=${encodeURIComponent(user.email ?? "")}`);
  }

  const account = await getAccountOverviewCached();

  if (!account.hasOrganization) {
    // Platform staff legitimately have no store of their own.
    redirect(account.isPlatformAdmin ? "/admin" : "/onboarding");
  }

  if (!isAccountUsable(account)) {
    redirect("/pending-activation");
  }

  return (
    <div className="flex min-h-full flex-1 flex-col sm:flex-row">
      <DashboardNav
        userEmail={user.email ?? ""}
        isAdmin={account.isPlatformAdmin}
        stores={account.stores ?? []}
        storesLimit={account.limits?.stores ?? null}
      />
      <div className="flex-1 bg-[var(--jaddid-surface)]">{children}</div>
    </div>
  );
}
