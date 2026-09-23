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

  return (
    <div className="flex min-h-full flex-1 flex-col sm:flex-row">
      <DashboardNav userEmail={user.email ?? ""} isAdmin={isAdmin} />
      <div className="flex-1 bg-[var(--jaddid-surface)]">{children}</div>
    </div>
  );
}
