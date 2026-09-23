import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ADMIN_ROLES = ["admin", "support", "super_admin"];

/**
 * Route guard for /admin/*. This is a UX convenience, not the real
 * security boundary -- the actual boundary is the database's
 * private.is_platform_admin() check baked into every admin-only RLS
 * policy and into the admin_review_activation_request RPC itself. Even
 * if this check were skipped entirely, a non-admin session still
 * couldn't read another org's data or call the review RPC; this just
 * keeps a non-admin user from landing on a page that would render
 * empty/broken for them.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, platform_role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = !!profile && ADMIN_ROLES.includes(profile.platform_role);
  if (!isAdmin) redirect("/dashboard");

  return { user, profile, supabase };
}
