import Link from "next/link";
import type { Metadata } from "next";
import { getAccountOverviewCached } from "@/lib/account.server";
import { getPublicPlans } from "@/lib/plans";
import { whatsappPlanChangeUrl } from "@/lib/contact";

export const metadata: Metadata = { title: "الباقات" };

const PERIOD_LABELS: Record<string, string> = {
  month: "شهريًا",
  year: "سنويًا",
};

function formatDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ar-SA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function limitText(limit: number | null, unit: string): string {
  return limit == null ? `${unit} بلا حد` : `حتى ${limit} ${unit}`;
}

/**
 * Plan switching, from inside the account.
 *
 * The dashboard used to send merchants to the public /pricing page, which
 * answers a visitor's questions — an FAQ, a sign-up call to action — and
 * says nothing about which plan they are already on. From here the plan
 * they hold is marked and locked, and the only thing left to do is pick
 * one of the others.
 */
export default async function SubscriptionPage() {
  const [account, plans] = await Promise.all([getAccountOverviewCached(), getPublicPlans()]);

  const started = formatDate(account.startedAt);
  const expires = formatDate(account.expiresAt);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
      <div className="mb-6">
        <Link href="/dashboard" className="text-xs text-slate-500 hover:text-[var(--jaddid-blue)]">
          ← العودة للوحة
        </Link>
        <h1 className="mt-2 text-xl font-bold text-[var(--jaddid-navy)]">الباقات</h1>
        <p className="text-sm text-slate-500">
          {account.planName
            ? `أنت مشترك حاليًا في باقة ${account.planName}.`
            : "ما عندك باقة مفعّلة حاليًا."}
        </p>
      </div>

      {started || expires ? (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {started ? (
            <div className="rounded-xl bg-[var(--jaddid-surface)] px-4 py-3">
              <p className="text-[11px] text-slate-500">بداية الاشتراك</p>
              <p className="text-sm font-bold text-[var(--jaddid-navy)]">{started}</p>
            </div>
          ) : null}
          {expires ? (
            <div className="rounded-xl bg-[var(--jaddid-surface)] px-4 py-3">
              <p className="text-[11px] text-slate-500">نهاية الاشتراك</p>
              <p className="text-sm font-bold text-[var(--jaddid-navy)]">{expires}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {plans.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--jaddid-border)] bg-white px-6 py-12 text-center text-sm text-slate-500">
          تعذّر تحميل الباقات حاليًا. حاول تحديث الصفحة.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.slug === account.planSlug;
            return (
              <div
                key={plan.id}
                className={`flex flex-col rounded-2xl border bg-white p-5 ${
                  isCurrent
                    ? "border-[var(--jaddid-blue)] ring-2 ring-[var(--jaddid-blue)]/20"
                    : "border-[var(--jaddid-border)]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-base font-bold text-[var(--jaddid-navy)]">{plan.name}</h2>
                  {isCurrent ? (
                    <span className="rounded-full bg-[var(--jaddid-blue)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--jaddid-blue)]">
                      باقتك الحالية
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 text-2xl font-extrabold text-[var(--jaddid-navy)]">
                  {plan.price}
                  <span className="mr-1 text-sm font-medium text-slate-500">
                    {plan.currency} / {PERIOD_LABELS[plan.billing_period] ?? plan.billing_period}
                  </span>
                </p>

                <ul className="mt-4 flex-1 space-y-1.5 text-xs text-slate-600">
                  <li>{limitText(plan.active_customer_limit, "عميل نشط")}</li>
                  <li>{limitText(plan.stores_limit, "متجر")}</li>
                </ul>

                {isCurrent ? (
                  <button
                    type="button"
                    disabled
                    className="mt-5 w-full cursor-not-allowed rounded-xl bg-[var(--jaddid-surface)] px-4 py-2.5 text-xs font-bold text-slate-400"
                  >
                    مشترك فيها
                  </button>
                ) : (
                  <a
                    href={whatsappPlanChangeUrl({
                      planName: plan.name,
                      organizationName: account.organizationName,
                      accountNumber: account.accountNumber,
                      currentPlanName: account.planName,
                    })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 block rounded-xl px-4 py-2.5 text-center text-xs font-bold text-white"
                    style={{ background: "var(--gradient-brand)" }}
                  >
                    اختر هذي الباقة
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-slate-500">
        التفعيل يتم يدويًا — بعد اختيارك الباقة نتواصل معك على واتساب لإتمام الاشتراك.
      </p>
    </main>
  );
}
