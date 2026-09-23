import { requireAdmin } from "@/lib/admin/requireAdmin";
import ReviewActions from "./ReviewActions";

const STATUS_LABELS: Record<string, string> = {
  pending: "بانتظار المراجعة",
  approved: "تمت الموافقة",
  rejected: "مرفوض",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
};

export default async function AdminActivationsPage() {
  const { supabase } = await requireAdmin();

  const { data: requests } = await supabase
    .from("activation_requests")
    .select(
      "id, status, note, created_at, reviewed_at, organizations(name, account_number), account_subscriptions(plans(name, price, currency))",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const pending = (requests ?? []).filter((r) => r.status === "pending");
  const resolved = (requests ?? []).filter((r) => r.status !== "pending");

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
      <h1 className="mb-1 text-xl font-bold text-[var(--jaddid-navy)]">طلبات تفعيل المؤسسات</h1>
      <p className="mb-6 text-sm text-slate-500">
        كل مؤسسة جديدة تنتظر مراجعة يدوية قبل تفعيل حسابها.
      </p>

      <h2 className="mb-3 text-sm font-bold text-[var(--jaddid-navy)]">
        بانتظار المراجعة ({pending.length})
      </h2>
      {pending.length === 0 ? (
        <p className="mb-8 text-sm text-slate-400">لا توجد طلبات معلّقة الآن.</p>
      ) : (
        <div className="mb-8 space-y-3">
          {pending.map((r) => {
            const org = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
            const sub = Array.isArray(r.account_subscriptions) ? r.account_subscriptions[0] : r.account_subscriptions;
            const planRaw = sub?.plans;
            const plan = (Array.isArray(planRaw) ? planRaw[0] : planRaw) as
              | { name: string; price: number; currency: string }
              | undefined;
            return (
              <div key={r.id} className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-[var(--jaddid-navy)]">{org?.name ?? "—"}</p>
                    <p className="text-xs text-slate-400">
                      رقم الحساب: {org?.account_number ?? "—"}
                      {plan ? ` · الباقة: ${plan.name} (${plan.price} ${plan.currency})` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400" dir="ltr">
                      {new Date(r.created_at).toLocaleString("ar-SA")}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                </div>
                <div className="mt-3">
                  <ReviewActions requestId={r.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="mb-3 text-sm font-bold text-[var(--jaddid-navy)]">
        تمت مراجعتها ({resolved.length})
      </h2>
      {resolved.length === 0 ? (
        <p className="text-sm text-slate-400">لا يوجد سجل مراجعات بعد.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--jaddid-border)] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[var(--jaddid-surface)] text-slate-500">
              <tr>
                <th className="px-4 py-3 text-right font-medium">المؤسسة</th>
                <th className="px-4 py-3 text-right font-medium">الحالة</th>
                <th className="px-4 py-3 text-right font-medium">ملاحظة</th>
                <th className="px-4 py-3 text-right font-medium">تاريخ المراجعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--jaddid-border)]">
              {resolved.map((r) => {
                const org = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-semibold text-[var(--jaddid-navy)]">{org?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[r.status]}`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{r.note ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500" dir="ltr">
                      {r.reviewed_at ? new Date(r.reviewed_at).toLocaleDateString("ar-SA") : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
