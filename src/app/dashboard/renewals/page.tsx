import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  computeSubscriptionStatus,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_STYLES,
  type SubscriptionStatusValue,
} from "@/lib/domain/subscriptionStatus";
import ReminderButton from "./ReminderButton";

const ACTIONABLE_STATUSES: SubscriptionStatusValue[] = [
  "at_risk",
  "expired",
  "expires_today",
  "expiring_soon",
];

export default async function RenewalsPage() {
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

  const { data: store } = await supabase
    .from("stores")
    .select("id, name")
    .eq("organization_id", membership.organization_id)
    .limit(1)
    .maybeSingle();

  const { data: subscriptions } = await supabase
    .from("subscriptions")
    .select(
      "id, end_date, price_paid, currency, product_id, customer_id, products(name, renewal_url), customers(name, phone)",
    )
    .eq("organization_id", membership.organization_id)
    .order("end_date", { ascending: true });

  const { data: templates } = await supabase
    .from("message_templates")
    .select("id, name, body, trigger_days")
    .eq("organization_id", membership.organization_id)
    .eq("is_active", true);

  const now = new Date();

  const rows = (subscriptions ?? [])
    .map((s) => {
      const status = computeSubscriptionStatus(s.end_date, now);
      const product = Array.isArray(s.products) ? s.products[0] : s.products;
      const customer = Array.isArray(s.customers) ? s.customers[0] : s.customers;
      const end = new Date(s.end_date);
      const remainingDays = Math.round((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      return { ...s, status, product, customer, remainingDays };
    })
    .filter((r) => ACTIONABLE_STATUSES.includes(r.status));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--jaddid-navy)]">التجديدات والتذكيرات</h1>
          <p className="text-sm text-slate-500">
            {rows.length} اشتراك يحتاج متابعة اليوم — الأقرب انتهاءً أولًا.
          </p>
        </div>
        <Link
          href="/dashboard/templates"
          className="rounded-xl border border-[var(--jaddid-border)] bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          إدارة القوالب
        </Link>
      </div>

      {(!templates || templates.length === 0) && rows.length > 0 ? (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-700">
          لا توجد قوالب مفعّلة بعد.{" "}
          <Link href="/dashboard/templates/new" className="font-semibold underline">
            أنشئ قالبًا
          </Link>{" "}
          لتتمكن من إرسال تذكيرات جاهزة.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-[var(--jaddid-border)] bg-white px-6 py-16 text-center">
          <p className="text-lg font-bold text-[var(--jaddid-navy)]">لا توجد تذكيرات مطلوبة الآن</p>
          <p className="mt-1 text-sm text-slate-500">
            ستظهر هنا الاشتراكات التي تقترب من الانتهاء أو انتهت بالفعل.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--jaddid-navy)]">
                    {r.customer?.name ?? "—"}{" "}
                    <span className="font-normal text-slate-400">· {r.product?.name ?? "منتج"}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500" dir="ltr">
                    {r.customer?.phone ?? "—"} · ينتهي في {r.end_date}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${SUBSCRIPTION_STATUS_STYLES[r.status]}`}
                >
                  {SUBSCRIPTION_STATUS_LABELS[r.status]}
                </span>
              </div>

              <div className="mt-3">
                {r.customer?.phone ? (
                  <ReminderButton
                    customerPhone={r.customer.phone}
                    vars={{
                      customer_name: r.customer?.name ?? "",
                      product_name: r.product?.name ?? "",
                      remaining_days: r.remainingDays,
                      end_date: r.end_date,
                      renewal_url: r.product?.renewal_url ?? "",
                      store_name: store?.name ?? "",
                    }}
                    templates={templates ?? []}
                  />
                ) : (
                  <p className="text-xs text-slate-400">لا يوجد رقم جوال لهذا العميل.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
