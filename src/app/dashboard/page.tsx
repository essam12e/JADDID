import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Minimal, real (not decorative) placeholder: it fetches the actual
 * signed-in user and profile from Supabase so the auth flow is
 * end-to-end testable. The real dashboard (stats, "needs action today",
 * store switcher, etc.) is Phase 9 — not built yet, and this page does
 * not pretend otherwise.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, platform_role")
    .eq("id", user.id)
    .single();

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role, organizations(name, status)")
    .eq("user_id", user.id);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-bold text-[var(--jaddid-navy)]">
        مرحبًا{profile?.full_name ? `، ${profile.full_name}` : ""} 👋
      </h1>
      <p className="mt-2 text-sm text-slate-500">{user.email}</p>

      <div className="mt-6 rounded-2xl border border-[var(--jaddid-border)] bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">متاجرك</h2>
        {memberships && memberships.length > 0 ? (
          <ul className="space-y-2 text-sm">
            {memberships.map((m, i) => (
              <li key={i} className="flex items-center justify-between">
                <span>{(m.organizations as unknown as { name: string })?.name}</span>
                <span className="text-xs text-slate-400">
                  {(m.organizations as unknown as { status: string })?.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">
            لا يوجد متجر بعد. أكمل خطوات الإعداد لإضافة متجرك الأول.
          </p>
        )}
      </div>

      <a
        href="/dashboard/products"
        className="mt-6 inline-block rounded-xl px-5 py-2.5 text-sm font-bold text-white"
        style={{ background: "var(--gradient-brand)" }}
      >
        عرض المنتجات
      </a>

      <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
        هذه لوحة تحكم مبدئية — الإحصائيات و&ldquo;يحتاج إجراء اليوم&rdquo;
        قادمة في مرحلة لاحقة (بعد بناء العملاء والاشتراكات).
      </p>
    </main>
  );
}
