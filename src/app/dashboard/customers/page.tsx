import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  computeCustomerValueStatus,
  computeSubscriptionStatus,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_STYLES,
} from "@/lib/domain/subscriptionStatus";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg font-bold text-[var(--jaddid-navy)]">لا يوجد متجر بعد</p>
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

  let query = supabase
    .from("customers")
    .select(
      "id, name, phone, email, renewal_count, lifetime_value, is_archived, subscriptions(id, status, end_date, product_id, products(name))",
    )
    .eq("organization_id", membership.organization_id)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  if (q && q.trim()) {
    query = query.or(`name.ilike.%${q.trim()}%,phone.ilike.%${q.trim()}%`);
  }

  const { data: customers } = await query;
  const now = new Date();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--jaddid-navy)]">العملاء</h1>
          <p className="text-sm text-slate-500">{customers?.length ?? 0} عميل</p>
        </div>
        <Link
          href="/dashboard/customers/new"
          className="shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold text-white"
          style={{ background: "var(--gradient-brand)" }}
        >
          + إضافة عميل
        </Link>
      </div>

      <form className="mb-5">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="ابحث بالاسم أو رقم الجوال..."
          className="w-full rounded-xl border border-[var(--jaddid-border)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--jaddid-blue)] focus:ring-2 focus:ring-[var(--jaddid-blue)]/20"
        />
      </form>

      {!customers || customers.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-[var(--jaddid-border)] bg-white px-6 py-16 text-center">
          <p className="text-lg font-bold text-[var(--jaddid-navy)]">
            {q ? "لا توجد نتائج مطابقة" : "لا يوجد عملاء بعد"}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            أضف عميلًا يدويًا، أو سجّل عملية بيع من صفحة أحد المنتجات.
          </p>
          {q ? null : (
            <Link
              href="/dashboard/customers/new"
              className="mt-5 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
              style={{ background: "var(--gradient-brand)" }}
            >
              + إضافة عميل
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--jaddid-border)] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[var(--jaddid-surface)] text-slate-500">
              <tr>
                <th className="px-4 py-3 text-right font-medium">الاسم</th>
                <th className="px-4 py-3 text-right font-medium">الجوال</th>
                <th className="px-4 py-3 text-right font-medium">الحالة</th>
                <th className="px-4 py-3 text-right font-medium">التجديدات</th>
                <th className="px-4 py-3 text-right font-medium">إجمالي المدفوعات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--jaddid-border)]">
              {customers.map((c) => {
                const subs = Array.isArray(c.subscriptions) ? c.subscriptions : [];
                const soonestEnd = subs
                  .map((s) => s.end_date)
                  .filter(Boolean)
                  .sort()[0];
                const status = soonestEnd ? computeSubscriptionStatus(soonestEnd, now) : null;
                const valueStatus = computeCustomerValueStatus(c.renewal_count);
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/customers/${c.id}`}
                        className="font-semibold text-[var(--jaddid-blue)] hover:underline"
                      >
                        {c.name}
                      </Link>
                      {valueStatus === "vip" ? (
                        <span className="ms-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          VIP
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-500" dir="ltr">
                      {c.phone}
                    </td>
                    <td className="px-4 py-3">
                      {status ? (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${SUBSCRIPTION_STATUS_STYLES[status]}`}
                        >
                          {SUBSCRIPTION_STATUS_LABELS[status]}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">بدون اشتراك</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{c.renewal_count}</td>
                    <td className="px-4 py-3 text-slate-500">{c.lifetime_value} ر.س</td>
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
