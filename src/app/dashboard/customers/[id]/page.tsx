import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeCustomerValueStatus,
  computeSubscriptionStatus,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_STYLES,
} from "@/lib/domain/subscriptionStatus";
import RenewForm from "./RenewForm";

export default async function CustomerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS-scoped: null if this customer doesn't belong to the caller's org.
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, phone, email, notes, renewal_count, lifetime_value, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!customer) notFound();

  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select("id, status, start_date, end_date, price_paid, currency, product_id, products(name)")
    .eq("customer_id", id)
    .order("end_date", { ascending: false });

  const { data: renewals } = await supabase
    .from("renewals")
    .select("id, previous_end_date, new_end_date, amount, currency, created_at, subscription_id")
    .in("subscription_id", (subscriptions ?? []).map((s) => s.id))
    .order("created_at", { ascending: false });

  const now = new Date();
  const valueStatus = computeCustomerValueStatus(customer.renewal_count);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <Link href="/dashboard/customers" className="text-sm text-slate-500 hover:text-slate-700">
        ← العودة للعملاء
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-[var(--jaddid-navy)]">
            {customer.name}
            {valueStatus === "vip" ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                VIP
              </span>
            ) : null}
          </h1>
          <p className="mt-1 text-sm text-slate-500" dir="ltr">
            {customer.phone} {customer.email ? `· ${customer.email}` : ""}
          </p>
        </div>
        <div className="flex gap-4 text-center text-sm">
          <div>
            <p className="text-lg font-bold text-[var(--jaddid-navy)]">{customer.renewal_count}</p>
            <p className="text-xs text-slate-500">عدد التجديدات</p>
          </div>
          <div>
            <p className="text-lg font-bold text-[var(--jaddid-navy)]">{customer.lifetime_value} ر.س</p>
            <p className="text-xs text-slate-500">إجمالي المدفوعات</p>
          </div>
        </div>
      </div>

      {customer.notes ? (
        <p className="mt-4 rounded-xl bg-[var(--jaddid-surface)] px-4 py-3 text-sm text-slate-600">
          {customer.notes}
        </p>
      ) : null}

      <h2 className="mt-8 mb-3 text-sm font-bold text-[var(--jaddid-navy)]">الاشتراكات</h2>
      {!subscriptions || subscriptions.length === 0 ? (
        <p className="text-sm text-slate-500">لا توجد اشتراكات لهذا العميل.</p>
      ) : (
        <div className="space-y-3">
          {subscriptions.map((s) => {
            const status = computeSubscriptionStatus(s.end_date, now);
            const product = Array.isArray(s.products) ? s.products[0] : s.products;
            return (
              <div
                key={s.id}
                className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[var(--jaddid-navy)]">{product?.name ?? "منتج"}</p>
                    <p className="text-xs text-slate-500" dir="ltr">
                      {s.start_date} → {s.end_date}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${SUBSCRIPTION_STATUS_STYLES[status]}`}
                  >
                    {SUBSCRIPTION_STATUS_LABELS[status]}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  آخر دفعة: {s.price_paid} {s.currency}
                </p>
                <div className="mt-3">
                  <RenewForm
                    subscriptionId={s.id}
                    productName={product?.name ?? "المنتج"}
                    defaultAmount={s.price_paid}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h2 className="mt-8 mb-3 text-sm font-bold text-[var(--jaddid-navy)]">سجل التجديدات</h2>
      {!renewals || renewals.length === 0 ? (
        <p className="text-sm text-slate-500">لا يوجد سجل تجديدات بعد.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--jaddid-border)] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[var(--jaddid-surface)] text-slate-500">
              <tr>
                <th className="px-4 py-3 text-right font-medium">التاريخ</th>
                <th className="px-4 py-3 text-right font-medium">من</th>
                <th className="px-4 py-3 text-right font-medium">إلى</th>
                <th className="px-4 py-3 text-right font-medium">المبلغ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--jaddid-border)]">
              {renewals.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-slate-500" dir="ltr">
                    {new Date(r.created_at).toLocaleDateString("ar-SA")}
                  </td>
                  <td className="px-4 py-3 text-slate-500" dir="ltr">
                    {r.previous_end_date}
                  </td>
                  <td className="px-4 py-3 text-slate-500" dir="ltr">
                    {r.new_end_date}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {r.amount} {r.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
