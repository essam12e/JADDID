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

  // Both in one trip: the requests, and the plan catalogue the approve
  // form needs. Approving is what writes started_at/expires_at, so the
  // admin has to pick a plan and a duration at that moment.
  const [{ data: requests }, { data: planRows }] = await Promise.all([
    supabase
      .from("activation_requests")
      .select(
        "id, status, kind, requested_plan_id, note, created_at, reviewed_at, organizations(name, account_number), account_subscriptions(plan_id, plans(name, price, currency))",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("plans")
      .select("id, name, price, currency")
      .eq("is_active", true)
      .order("price", { ascending: true }),
  ]);

  const plans = planRows ?? [];

  const planById = new Map(plans.map((p) => [p.id, p]));
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
            const isUpgrade = r.kind === "plan_change";
            const requested = r.requested_plan_id ? planById.get(r.requested_plan_id) : undefined;
            return (
              <div key={r.id} className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-[var(--jaddid-navy)]">{org?.name ?? "—"}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isUpgrade ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {isUpgrade ? "تغيير باقة" : "تفعيل جديد"}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      رقم الحساب: {org?.account_number ?? "—"}
                      {plan ? ` · الباقة الحالية: ${plan.name} (${plan.price} ${plan.currency})` : ""}
                    </p>
                    {requested ? (
                      <p className="mt-0.5 text-xs font-semibold text-violet-700">
                        طلب الترقية إلى: {requested.name} ({requested.price} {requested.currency})
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-slate-400" dir="ltr">
                      {new Date(r.created_at).toLocaleString("ar-SA")}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                </div>
                <div className="mt-3">
                  <ReviewActions
                    requestId={r.id}
                    plans={plans}
                    currentPlanId={r.requested_plan_id ?? sub?.plan_id ?? null}
                    isUpgrade={isUpgrade}
                  />
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
