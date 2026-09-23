import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeSubscriptionStatus,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_STYLES,
} from "@/lib/domain/subscriptionStatus";

export default async function ProductCustomersPage({
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

  const { data: product } = await supabase
    .from("products")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (!product) notFound();

  const { data: subs } = await supabase
    .from("subscriptions")
    .select(
      "id, status, start_date, end_date, price_paid, currency, customer_id, customers(id, name, phone, email, renewal_count, lifetime_value)",
    )
    .eq("product_id", id)
    .order("end_date", { ascending: true });

  const now = new Date();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/products" className="text-sm text-slate-500 hover:text-slate-700">
            ← العودة للمنتجات
          </Link>
          <h1 className="mt-2 text-xl font-bold text-[var(--jaddid-navy)]">
            عملاء {product.name}
          </h1>
        </div>
        <Link
          href={`/dashboard/products/${product.id}/sell`}
          className="rounded-xl px-4 py-2 text-sm font-bold text-white"
          style={{ background: "var(--gradient-brand)" }}
        >
          + تسجيل عملية بيع
        </Link>
      </div>

      {!subs || subs.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-[var(--jaddid-border)] bg-white px-6 py-16 text-center">
          <p className="text-lg font-bold text-[var(--jaddid-navy)]">لا يوجد عملاء بعد</p>
          <p className="mt-1 text-sm text-slate-500">
            سجّل أول عملية بيع لهذا المنتج ليظهر العميل هنا.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[var(--jaddid-border)] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[var(--jaddid-surface)] text-slate-500">
              <tr>
                <th className="px-4 py-3 text-right font-medium">العميل</th>
                <th className="px-4 py-3 text-right font-medium">الجوال</th>
                <th className="px-4 py-3 text-right font-medium">الحالة</th>
                <th className="px-4 py-3 text-right font-medium">ينتهي في</th>
                <th className="px-4 py-3 text-right font-medium">المدفوع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--jaddid-border)]">
              {subs.map((s) => {
                const customer = Array.isArray(s.customers) ? s.customers[0] : s.customers;
                const status = computeSubscriptionStatus(s.end_date, now);
                return (
                  <tr key={s.id}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/customers/${s.customer_id}`}
                        className="font-semibold text-[var(--jaddid-blue)] hover:underline"
                      >
                        {customer?.name ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500" dir="ltr">
                      {customer?.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${SUBSCRIPTION_STATUS_STYLES[status]}`}
                      >
                        {SUBSCRIPTION_STATUS_LABELS[status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500" dir="ltr">
                      {s.end_date}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {s.price_paid} {s.currency}
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
