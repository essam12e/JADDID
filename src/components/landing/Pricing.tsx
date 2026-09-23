import { createClient } from "@/lib/supabase/server";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

type Plan = {
  id: string;
  slug: string;
  name: string;
  price: number;
  currency: string;
  billing_period: string;
  active_customer_limit: number | null;
  stores_limit: number | null;
  features: Record<string, boolean>;
};

const FEATURE_LABELS: Record<string, string> = {
  imports: "استيراد المنتجات",
  analytics: "التقارير والتحليلات",
  templates: "قوالب واتساب الذكية",
  advanced_reports: "تقارير متقدمة",
  team_users: "مستخدمون للفريق",
};


/**
 * Reads live plan data from the plans table (RLS allows anon SELECT of
 * active plans) rather than hard-coding the price here and risking it
 * drift from what admins configure in the database.
 */
export default async function Pricing() {
  const supabase = await createClient();
  // A hard timeout on this query: without it, a slow or unreachable
  // database would block the entire homepage's server render indefinitely
  // (this section is the only one on the page that depends on a live
  // network call). Timing out falls back to the same friendly message as
  // any other fetch failure below, rather than hanging the page.
  const { data: plans, error: plansError } = await supabase
    .from("plans")
    .select(
      "id, slug, name, price, currency, billing_period, active_customer_limit, stores_limit, features",
    )
    .eq("is_active", true)
    .order("price", { ascending: true })
    .abortSignal(AbortSignal.timeout(6000));

  if (plansError) {
    console.error("[Pricing] failed to load plans:", plansError);
  }

  const list = (plans ?? []) as Plan[];

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
      <Reveal>
        <SectionHeading eyebrow="الأسعار" title="باقة واحدة بسيطة، بدون تعقيد" />
      </Reveal>

      <div className="mt-10">
        {list.length === 0 ? (
          <p className="text-center text-sm text-slate-500">
            تعذّر تحميل الباقات حاليًا. حاول تحديث الصفحة.
          </p>
        ) : (
          <div
            className={`mx-auto grid max-w-5xl gap-6 ${
              list.length === 3
                ? "items-center sm:grid-cols-1 lg:grid-cols-3"
                : "sm:grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {list.map((plan, i) => {
              // The middle plan of exactly-three is the natural "grown into
              // this" tier — emphasized visually only, no unverifiable
              // "best seller" claim.
              const emphasized = list.length === 3 && i === 1;
              return (
                <Reveal key={plan.id}>
                  <div
                    className={`relative flex h-full flex-col rounded-2xl border bg-white p-7 transition-shadow ${
                      emphasized
                        ? "border-[var(--jaddid-blue)] shadow-lg lg:-translate-y-2 lg:scale-[1.03]"
                        : "border-[var(--jaddid-border)] shadow-sm"
                    }`}
                  >
                    {emphasized ? (
                      <span
                        className="absolute -top-3 right-1/2 translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold text-white shadow-sm"
                        style={{ background: "var(--gradient-brand)" }}
                      >
                        للأعمال النامية
                      </span>
                    ) : null}

                    <p
                      className={`text-sm font-bold ${
                        emphasized ? "text-[var(--jaddid-blue)]" : "text-slate-500"
                      }`}
                    >
                      {plan.name}
                    </p>
                    <p className="mt-2 flex items-baseline gap-1 text-4xl font-extrabold text-[var(--jaddid-navy)]">
                      {plan.price}
                      <span className="text-base font-medium text-slate-400">
                        {plan.currency} /{" "}
                        {plan.billing_period === "month" ? "شهريًا" : "سنويًا"}
                      </span>
                    </p>

                    <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-600">
                      <li className="flex items-center gap-2">
                        <CheckIcon />
                        {plan.stores_limit
                          ? `${plan.stores_limit} ${plan.stores_limit === 1 ? "متجر" : "متاجر"}`
                          : "متاجر غير محدودة"}
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckIcon />
                        حتى {plan.active_customer_limit ?? "غير محدود"} عميل نشط
                      </li>
                      {Object.entries(plan.features ?? {})
                        .filter(([, enabled]) => enabled)
                        .map(([key]) => (
                          <li key={key} className="flex items-center gap-2">
                            <CheckIcon />
                            {FEATURE_LABELS[key] ?? key}
                          </li>
                        ))}
                    </ul>

                    <a
                      href="/signup"
                      className={`mt-7 block rounded-xl py-3 text-center text-sm font-bold transition-transform hover:-translate-y-px active:translate-y-0 ${
                        emphasized
                          ? "text-white shadow-md"
                          : "border border-[var(--jaddid-border)] text-[var(--jaddid-navy)]"
                      }`}
                      style={emphasized ? { background: "var(--gradient-brand)" } : undefined}
                    >
                      ابدأ الآن
                    </a>
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      className="shrink-0 text-[var(--jaddid-blue)]"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="8" fill="currentColor" opacity="0.12" />
      <path
        d="M5 8.3 7.1 10.4 11 6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
