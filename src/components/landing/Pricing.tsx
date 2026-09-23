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
};

/**
 * Reads live plan data from the plans table (RLS allows anon SELECT of
 * active plans) rather than hard-coding the price here and risking it
 * drift from what admins configure in the database.
 */
export default async function Pricing() {
  const supabase = await createClient();
  const { data: plans, error: plansError } = await supabase
    .from("plans")
    .select(
      "id, slug, name, price, currency, billing_period, active_customer_limit, stores_limit, features",
    )
    .eq("is_active", true)
    .order("price", { ascending: true });

  if (plansError) {
    console.error("[Pricing] failed to load plans:", plansError);
  }

  const list = (plans ?? []) as Plan[];

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
      <Reveal>
        <SectionHeading eyebrow="الأسعار" title="باقة واحدة بسيطة، بدون تعقيد" />
      </Reveal>

      <div className="mt-10 flex justify-center">
        {list.length === 0 ? (
          <p className="text-sm text-slate-500">
            تعذّر تحميل الباقات حاليًا. حاول تحديث الصفحة.
          </p>
        ) : (
          <div className="grid w-full max-w-sm gap-6">
            {list.map((plan) => (
              <Reveal key={plan.id}>
                <div className="rounded-2xl border-2 border-[var(--jaddid-blue)]/30 bg-white p-6 shadow-sm">
                  <p className="text-sm font-bold text-[var(--jaddid-blue)]">
                    {plan.name}
                  </p>
                  <p className="mt-2 text-4xl font-extrabold text-[var(--jaddid-navy)]">
                    {plan.price}
                    <span className="text-base font-medium text-slate-400">
                      {" "}
                      {plan.currency} / {plan.billing_period === "month" ? "شهريًا" : "سنويًا"}
                    </span>
                  </p>
                  <ul className="mt-5 space-y-2 text-sm text-slate-600">
                    <li>متجر واحد{plan.stores_limit ? "" : " فأكثر"}</li>
                    <li>
                      حتى {plan.active_customer_limit ?? "غير محدود"} عميل نشط
                    </li>
                    {Object.entries(plan.features ?? {})
                      .filter(([, enabled]) => enabled)
                      .map(([key]) => (
                        <li key={key}>{FEATURE_LABELS[key] ?? key}</li>
                      ))}
                  </ul>
                  <a
                    href="/signup"
                    className="mt-6 block rounded-xl py-2.5 text-center text-sm font-bold text-white"
                    style={{ background: "var(--gradient-brand)" }}
                  >
                    ابدأ الآن
                  </a>
                </div>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
