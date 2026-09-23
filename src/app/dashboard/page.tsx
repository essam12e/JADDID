import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeSubscriptionStatus,
  computeCustomerValueStatus,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_STYLES,
  type SubscriptionStatusValue,
} from "@/lib/domain/subscriptionStatus";
import { computeDashboardStats, computeMonthlyRevenue } from "@/lib/domain/analytics";
import RevenueChart from "@/components/dashboard/RevenueChart";
import StatusBreakdown from "@/components/dashboard/StatusBreakdown";

const ACTIONABLE_STATUSES: SubscriptionStatusValue[] = [
  "at_risk",
  "expired",
  "expires_today",
  "expiring_soon",
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, organizations(name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-bold text-[var(--jaddid-navy)]">
          مرحبًا{profile?.full_name ? `، ${profile.full_name}` : ""} 👋
        </h1>
        <p className="mt-4 rounded-2xl border border-dashed border-[var(--jaddid-border)] bg-white p-6 text-sm text-slate-500">
          لا يوجد متجر بعد. أكمل خطوات الإعداد لإضافة متجرك الأول.
        </p>
        <Link
          href="/onboarding"
          className="mt-4 inline-block rounded-xl px-5 py-2.5 text-sm font-bold text-white"
          style={{ background: "var(--gradient-brand)" }}
        >
          إكمال الإعداد
        </Link>
      </main>
    );
  }

  const orgId = membership.organization_id;
  const orgName = (membership.organizations as unknown as { name: string } | null)?.name;

  const [{ count: customerCount }, { data: customers }, { data: subscriptions }, { data: renewals }, { data: recentLogs }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("is_archived", false),
      supabase.from("customers").select("renewal_count").eq("organization_id", orgId),
      supabase
        .from("subscriptions")
        .select(
          "id, end_date, price_paid, created_at, product_id, customer_id, products(name), customers(name, phone)",
        )
        .eq("organization_id", orgId),
      supabase.from("renewals").select("amount, created_at").eq("organization_id", orgId),
      supabase
        .from("audit_logs")
        .select("id, action, created_at, target_id, metadata")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const now = new Date();

  const enrichedSubs = (subscriptions ?? []).map((s) => {
    const product = Array.isArray(s.products) ? s.products[0] : s.products;
    const customer = Array.isArray(s.customers) ? s.customers[0] : s.customers;
    return {
      ...s,
      product,
      customer,
      status_computed: computeSubscriptionStatus(s.end_date, now),
    };
  });

  const vipCount = (customers ?? []).filter((c) => computeCustomerValueStatus(c.renewal_count) === "vip").length;

  const stats = computeDashboardStats({
    customerCount: customerCount ?? 0,
    vipCount,
    subscriptions: enrichedSubs.map((s) => ({
      status_computed: s.status_computed,
      price_paid: s.price_paid,
      created_at: s.created_at,
    })),
    renewals: renewals ?? [],
    now,
  });

  const revenueByMonth = computeMonthlyRevenue(
    enrichedSubs.map((s) => ({ amount: s.price_paid, created_at: s.created_at })),
    renewals ?? [],
    6,
    now,
  );

  const statusCounts = enrichedSubs.reduce(
    (acc, s) => {
      acc[s.status_computed] = (acc[s.status_computed] ?? 0) + 1;
      return acc;
    },
    {} as Record<SubscriptionStatusValue, number>,
  );

  const needsAction = enrichedSubs
    .filter((s) => ACTIONABLE_STATUSES.includes(s.status_computed))
    .sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime())
    .slice(0, 5);

  const ACTION_LABELS: Record<string, string> = {
    "subscription.created": "تسجيل عملية بيع جديدة",
    "subscription.renewed": "تجديد اشتراك",
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--jaddid-navy)]">
          مرحبًا{profile?.full_name ? `، ${profile.full_name}` : ""} 👋
        </h1>
        <p className="text-sm text-slate-500">{orgName ?? user.email}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="العملاء" value={stats.totalCustomers} />
        <StatCard label="اشتراكات نشطة" value={stats.activeSubscriptions} />
        <StatCard
          label="تحتاج متابعة"
          value={stats.needsActionCount}
          tone={stats.needsActionCount > 0 ? "amber" : undefined}
          href="/dashboard/renewals"
        />
        <StatCard label="عملاء VIP" value={stats.vipCustomers} tone="purple" />
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--jaddid-border)] bg-white p-5">
        <p className="text-xs font-semibold text-slate-500">إيرادات هذا الشهر</p>
        <p className="mt-1 text-2xl font-extrabold text-[var(--jaddid-navy)]">
          {stats.revenueThisMonth.toLocaleString("en-US")} ر.س
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-bold text-[var(--jaddid-navy)]">الإيرادات (آخر 6 أشهر)</h2>
          <RevenueChart data={revenueByMonth} />
        </div>
        <div className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-5">
          <h2 className="mb-4 text-sm font-bold text-[var(--jaddid-navy)]">حالة الاشتراكات</h2>
          <StatusBreakdown counts={statusCounts} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-[var(--jaddid-navy)]">يحتاج إجراء اليوم</h2>
            <Link href="/dashboard/renewals" className="text-xs font-semibold text-[var(--jaddid-blue)]">
              عرض الكل
            </Link>
          </div>
          {needsAction.length === 0 ? (
            <p className="text-sm text-slate-400">لا يوجد ما يحتاج متابعة الآن.</p>
          ) : (
            <ul className="space-y-3">
              {needsAction.map((s) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/customers/${s.customer_id}`}
                      className="truncate font-semibold text-[var(--jaddid-blue)] hover:underline"
                    >
                      {s.customer?.name ?? "—"}
                    </Link>
                    <p className="truncate text-xs text-slate-400">{s.product?.name ?? "منتج"}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${SUBSCRIPTION_STATUS_STYLES[s.status_computed]}`}
                  >
                    {SUBSCRIPTION_STATUS_LABELS[s.status_computed]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-5">
          <h2 className="mb-4 text-sm font-bold text-[var(--jaddid-navy)]">آخر النشاطات</h2>
          {!recentLogs || recentLogs.length === 0 ? (
            <p className="text-sm text-slate-400">لا يوجد نشاط بعد.</p>
          ) : (
            <ul className="space-y-3">
              {recentLogs.map((log) => (
                <li key={log.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{ACTION_LABELS[log.action] ?? log.action}</span>
                  <span className="text-xs text-slate-400" dir="ltr">
                    {new Date(log.created_at).toLocaleDateString("ar-SA")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/dashboard/products"
          className="rounded-xl border border-[var(--jaddid-border)] bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          عرض المنتجات
        </Link>
        <Link
          href="/dashboard/customers"
          className="rounded-xl border border-[var(--jaddid-border)] bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          عرض العملاء
        </Link>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  tone,
  href,
}: {
  label: string;
  value: number;
  tone?: "amber" | "purple";
  href?: string;
}) {
  const toneClass =
    tone === "amber"
      ? "text-amber-600"
      : tone === "purple"
        ? "text-purple-600"
        : "text-[var(--jaddid-navy)]";

  const content = (
    <div className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${toneClass}`}>{value}</p>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
