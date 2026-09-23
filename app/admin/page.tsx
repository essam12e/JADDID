import Link from "next/link";
import { requireAdmin } from "@/lib/admin/requireAdmin";

const STATUS_LABELS: Record<string, string> = {
  pending_activation: "بانتظار التفعيل",
  active: "نشط",
  suspended: "موقوف",
  rejected: "مرفوض",
  expired: "منتهٍ",
};

const STATUS_STYLES: Record<string, string> = {
  pending_activation: "bg-amber-50 text-amber-700",
  active: "bg-emerald-50 text-emerald-700",
  suspended: "bg-slate-100 text-slate-500",
  rejected: "bg-red-50 text-red-700",
  expired: "bg-slate-100 text-slate-500",
};

const ACTION_LABELS: Record<string, string> = {
  "subscription.created": "تسجيل عملية بيع",
  "subscription.renewed": "تجديد اشتراك",
  "activation.approved": "الموافقة على تفعيل مؤسسة",
  "activation.rejected": "رفض تفعيل مؤسسة",
};

export default async function AdminOverviewPage() {
  const { supabase } = await requireAdmin();

  const [{ data: organizations }, { count: profileCount }, { data: pendingRequests }, { data: recentLogs }] =
    await Promise.all([
      supabase.from("organizations").select("id, status"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("activation_requests").select("id").eq("status", "pending"),
      supabase
        .from("audit_logs")
        .select("id, action, created_at, organization_id, organizations(name)")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const statusCounts = (organizations ?? []).reduce(
    (acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <h1 className="mb-6 text-xl font-bold text-[var(--jaddid-navy)]">نظرة عامة على المنصة</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">إجمالي المؤسسات</p>
          <p className="mt-1 text-2xl font-extrabold text-[var(--jaddid-navy)]">{organizations?.length ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">إجمالي المستخدمين</p>
          <p className="mt-1 text-2xl font-extrabold text-[var(--jaddid-navy)]">{profileCount ?? 0}</p>
        </div>
        <Link href="/admin/activations" className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">طلبات بانتظار المراجعة</p>
          <p
            className={`mt-1 text-2xl font-extrabold ${
              (pendingRequests?.length ?? 0) > 0 ? "text-amber-600" : "text-[var(--jaddid-navy)]"
            }`}
          >
            {pendingRequests?.length ?? 0}
          </p>
        </Link>
        <div className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">مؤسسات نشطة</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-600">{statusCounts.active ?? 0}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-5">
          <h2 className="mb-4 text-sm font-bold text-[var(--jaddid-navy)]">حالة المؤسسات</h2>
          {Object.keys(statusCounts).length === 0 ? (
            <p className="text-sm text-slate-400">لا توجد مؤسسات بعد.</p>
          ) : (
            <ul className="space-y-2">
              {Object.entries(statusCounts).map(([status, count]) => (
                <li key={status} className="flex items-center justify-between text-sm">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status] ?? ""}`}>
                    {STATUS_LABELS[status] ?? status}
                  </span>
                  <span className="font-semibold text-slate-600">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-5">
          <h2 className="mb-4 text-sm font-bold text-[var(--jaddid-navy)]">آخر النشاطات على المنصة</h2>
          {!recentLogs || recentLogs.length === 0 ? (
            <p className="text-sm text-slate-400">لا يوجد نشاط بعد.</p>
          ) : (
            <ul className="space-y-3">
              {recentLogs.map((log) => {
                const org = Array.isArray(log.organizations) ? log.organizations[0] : log.organizations;
                return (
                  <li key={log.id} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <p className="truncate text-slate-600">{ACTION_LABELS[log.action] ?? log.action}</p>
                      <p className="truncate text-xs text-slate-400">{org?.name ?? "—"}</p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400" dir="ltr">
                      {new Date(log.created_at).toLocaleDateString("ar-SA")}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
