"use client";

import { useEffect, useRef, useState } from "react";
import StatusBadge from "./StatusBadge";

function ProductCardMock() {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className="h-12 w-12 shrink-0 rounded-lg"
          style={{ background: "var(--gradient-brand)" }}
        />
        <div>
          <p className="font-bold text-[var(--jaddid-navy)]">اشتراك سنوي — أدوات تصميم</p>
          <p className="text-sm text-slate-500">39 ر.س / شهريًا</p>
        </div>
      </div>
      <div className="mt-3 flex gap-4 text-xs text-slate-500">
        <span>12 عميلًا</span>
        <span className="font-semibold text-amber-600">3 تنتهي قريبًا</span>
      </div>
      <div className="mt-3 flex gap-2">
        <span className="rounded-lg bg-[var(--jaddid-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--jaddid-blue)]">
          تسجيل عملية بيع
        </span>
        <span className="rounded-lg bg-[var(--jaddid-surface)] px-3 py-1.5 text-xs font-semibold text-slate-500">
          العملاء
        </span>
      </div>
    </div>
  );
}

function CustomerRowMock() {
  const rows = [
    { name: "عميل ١", status: "expired" as const },
    { name: "عميل ٢", status: "expiring" as const },
    { name: "عميل ٣", status: "active" as const },
    { name: "عميل ٤", status: "vip" as const },
  ];
  return (
    <div className="space-y-2 rounded-xl bg-white p-4 shadow-sm">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">{r.name}</span>
          <StatusBadge status={r.status} />
        </div>
      ))}
    </div>
  );
}

const VARIABLE_EXAMPLES: Record<string, string[]> = {
  "{{customer_name}}": ["{{customer_name}}", "محمد العتيبي"],
  "{{product_name}}": ["{{product_name}}", "الباقة الشهرية"],
  "{{remaining_days}}": ["{{remaining_days}}", "٣"],
  "{{renewal_url}}": ["{{renewal_url}}", "jaddid.app/r/x9k2"],
};

function TemplateVariable({ token }: { token: keyof typeof VARIABLE_EXAMPLES }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [filled, setFilled] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    let ctx: { revert: () => void } | undefined;
    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      gsap.registerPlugin(ScrollTrigger);
      ctx = gsap.context(() => {
        ScrollTrigger.create({
          trigger: ref.current,
          start: "top 85%",
          once: true,
          onEnter: () => {
            gsap.to(ref.current, {
              opacity: 0,
              duration: 0.18,
              delay: 0.5,
              onComplete: () => setFilled(true),
            });
            gsap.fromTo(
              ref.current,
              { opacity: 0 },
              { opacity: 1, duration: 0.25, delay: 0.7 },
            );
          },
        });
      });
    })();
    return () => ctx?.revert();
  }, []);

  const [placeholder, example] = VARIABLE_EXAMPLES[token];
  return (
    <span
      ref={ref}
      dir={filled ? "rtl" : "ltr"}
      className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[13px] font-semibold text-[var(--jaddid-blue)] ring-1 ring-blue-100"
    >
      {filled ? example : placeholder}
    </span>
  );
}

function TemplateMock() {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400">معاينة القالب — قبل التجديد بـ٣ أيام</p>
        <span className="rounded-full bg-[var(--jaddid-surface)] px-2 py-0.5 text-[10px] font-bold text-slate-500">
          مسوّدة
        </span>
      </div>
      <p className="rounded-lg bg-[var(--jaddid-surface)] p-3 text-sm leading-7 text-slate-700">
        مرحبًا <TemplateVariable token="{{customer_name}}" />،
        <br />
        اشتراكك في <TemplateVariable token="{{product_name}}" /> ينتهي خلال{" "}
        <TemplateVariable token="{{remaining_days}}" /> أيام. جدّد الآن:{" "}
        <TemplateVariable token="{{renewal_url}}" />
      </p>
      <p className="mt-2 text-[11px] text-slate-400">
        رابط التجديد يُدرج تلقائيًا من رابط الدفع الخاص بالمنتج.
      </p>
    </div>
  );
}

function StatusMock() {
  return (
    <div className="flex flex-wrap gap-2 rounded-xl bg-white p-5 shadow-sm">
      <StatusBadge status="active" />
      <StatusBadge status="expiring" />
      <StatusBadge status="expired" />
      <StatusBadge status="at_risk" />
      <StatusBadge status="vip" />
    </div>
  );
}

function RenewalOpportunityMock() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold text-slate-400">فرص تجديد خلال 7 أيام</p>
        <p className="mt-1 text-3xl font-extrabold text-[var(--jaddid-navy)]">
          2,430 <span className="text-base font-medium text-slate-400">ر.س</span>
        </p>
        <p className="mt-1 text-xs text-slate-400">قيمة محتملة، وليست إيرادًا محققًا</p>
      </div>
      <div className="rounded-xl bg-white p-4 shadow-sm">
        <p className="text-xs font-bold text-[var(--jaddid-navy)]">رابط التجديد لكل منتج</p>
        <p className="mt-1 text-xs leading-6 text-slate-500">
          اربط رابط دفع بكل منتج مرة واحدة — يُستخدم تلقائيًا في كل رسالة تجديد
          تُرسل لعملائه.
        </p>
      </div>
    </div>
  );
}

export type FeatureTab = {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  visual: React.ReactNode;
};

export const FEATURES: FeatureTab[] = [
  {
    id: "import",
    label: "الاستيراد",
    eyebrow: "استيراد المنتجات",
    title: "منتجات متجرك معك من البداية",
    description:
      "جَدِّد لا يبني متجرًا بديلًا — يقرأ منتجاتك العامة من رابط متجرك الحالي ويحوّلها لبطاقات جاهزة للمتابعة. الاستيراد الفعلي يتم داخل لوحة التحكم بعد إنشاء الحساب.",
    bullets: [
      "اسم المنتج، السعر، والصورة يُستخرجون تلقائيًا حين يكون ذلك ممكنًا",
      "إذا تعذّر الاستيراد، تقدر تضيف منتجاتك يدويًا في ثوانٍ",
      "إعادة الاستيراد لا تكرر نفس المنتج مرتين",
    ],
    visual: <ProductCardMock />,
  },
  {
    id: "customers",
    label: "العملاء",
    eyebrow: "تسجيل العملاء",
    title: "كل عملية بيع، بعميل ومدة واضحة",
    description:
      "سجّل من اشترى، أي منتج، وأي مدة — ويحسب جَدِّد تاريخ الانتهاء والمتبقي تلقائيًا.",
    bullets: [
      "بحث وفلترة سريعة بين كل عملائك",
      "صفحة خاصة لكل عميل بكامل سجل اشتراكاته وتجديداته",
      "تمييز عملاء VIP تلقائيًا حسب عدد مرات التجديد",
    ],
    visual: <CustomerRowMock />,
  },
  {
    id: "subscriptions",
    label: "الاشتراكات",
    eyebrow: "متابعة الاشتراكات",
    title: "لا تفوّت موعد تجديد بعد اليوم",
    description:
      "قسم «يحتاج إجراء اليوم» يجمع كل من ينتهي اشتراكه أو انتهى فعلًا، في مكان واحد — بنظام حالة واضح، لا تخمين.",
    bullets: [
      "تنبيهات عند 7 أيام، 3 أيام، 24 ساعة، ويوم الانتهاء",
      "تمييز العملاء «معرّضين للفقدان» ممن انتهى اشتراكهم دون تجديد",
      "تجديد بضغطة واحدة دون إعادة إدخال بيانات العميل",
    ],
    visual: <StatusMock />,
  },
  {
    id: "templates",
    label: "قوالب واتساب",
    eyebrow: "قوالب واتساب ذكية",
    title: "رسالة جاهزة، أنت من يضغط إرسال",
    description:
      "جَدِّد يجهّز رسالة التذكير بمتغيرات العميل والمنتج والمدة، ثم يفتحها في واتساب جاهزة — الإرسال يبقى بضغطة منك، بدون أتمتة كاملة عبر واتساب.",
    bullets: [
      "قوالب افتراضية جاهزة (7 أيام، 3 أيام، يوم الانتهاء، بعد الانتهاء)",
      "تعديل كامل على نص القالب ومتغيراته",
      "رابط التجديد يُستبدل تلقائيًا من بيانات المنتج",
    ],
    visual: <TemplateMock />,
  },
  {
    id: "opportunities",
    label: "فرص التجديد",
    eyebrow: "فرص التجديد",
    title: "اعرف قيمة ما هو قابل للتجديد",
    description:
      "لوحة التحكم تحسب القيمة المحتملة للاشتراكات المقبلة على الانتهاء — بوضوح أنها فرصة، لا إيرادًا محققًا.",
    bullets: [
      "تمييز واضح بين الإيراد الفعلي والقيمة المحتملة",
      "ترتيب حسب الأقرب انتهاءً",
      "رابط تجديد ثابت لكل منتج يُدرج تلقائيًا في كل رسالة",
    ],
    visual: <RenewalOpportunityMock />,
  },
];
