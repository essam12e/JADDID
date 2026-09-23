import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardNav from "./DashboardNav";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("platform_role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = !!profile && ["admin", "support", "super_admin"].includes(profile.platform_role);

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  let stores: { id: string; name: string }[] = [];
  let storesLimit: number | null = null;

  if (membership) {
    const [{ data: storeRows }, { data: subRow }] = await Promise.all([
      supabase
        .from("stores")
        .select("id, name")
        .eq("organization_id", membership.organization_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("account_subscriptions")
        .select("plans(stores_limit)")
        .eq("organization_id", membership.organization_id)
        .maybeSingle(),
    ]);
    stores = storeRows ?? [];
    const plan = Array.isArray(subRow?.plans) ? subRow.plans[0] : subRow?.plans;
    storesLimit = plan?.stores_limit ?? null;
  }

  return (
    <div className="flex min-h-full flex-1 flex-col sm:flex-row">
      <DashboardNav
        userEmail={user.email ?? ""}
        isAdmin={isAdmin}
        stores={stores}
        storesLimit={storesLimit}
      />
      <div className="flex-1 bg-[var(--jaddid-surface)]">{children}</div>
    </div>
  );
}
