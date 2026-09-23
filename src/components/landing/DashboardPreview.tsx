"use client";

import { useEffect, useRef } from "react";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

const stats = [
  { label: "إجمالي العملاء", value: 184 },
  { label: "اشتراكات نشطة", value: 231 },
  { label: "تنتهي خلال 7 أيام", value: 26 },
  { label: "معرّضون للفقدان", value: 9 },
  { label: "عملاء VIP", value: 14 },
  { label: "فرص تجديد (ر.س)", value: 2430 },
];

const ACTIONS = [
  { name: "أحمد", detail: "ينتهي اليوم", cta: "ذكّر" },
  { name: "لينا", detail: "متبقي 3 أيام", cta: "عرض" },
  { name: "فهد", detail: "انتهى منذ 7 أيام — معرّض للفقدان", cta: "تجديد" },
  { name: "منى", detail: "متبقي أسبوع", cta: "عرض" },
];

export default function DashboardPreview() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion || !gridRef.current) return;

    let ctx: { revert: () => void } | undefined;
    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        const numbers = gsap.utils.toArray<HTMLElement>(".stat-number");
        ScrollTrigger.create({
          trigger: gridRef.current,
          start: "top 75%",
          once: true,
          onEnter: () => {
            numbers.forEach((el) => {
              const target = Number(el.dataset.value ?? 0);
              const counter = { v: 0 };
              gsap.to(counter, {
                v: target,
                duration: 1.1,
                ease: "power2.out",
                onUpdate: () => {
                  el.textContent = Math.round(counter.v).toLocaleString("ar-SA");
                },
              });
            });
          },
        });
      }, gridRef);
    })();

    return () => ctx?.revert();
  }, []);

  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <Reveal>
        <SectionHeading
          eyebrow="لوحة التحكم"
          title="كل شيء يهمك، في شاشة واحدة"
          subtitle="أرقام توضيحية لغرض العرض فقط — حسابك الحقيقي يبدأ فارغًا ويُبنى من بياناتك."
        />
      </Reveal>
      <Reveal delay={0.1}>
        <div className="mt-10 rounded-2xl border border-[var(--jaddid-border)] bg-white p-6 shadow-sm">
          <div ref={gridRef} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl bg-[var(--jaddid-surface)] p-4 text-center"
              >
                <p className="stat-number text-2xl font-extrabold text-[var(--jaddid-navy)]" data-value={s.value}>
                  0
                </p>
                <p className="mt-1 text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-dashed border-[var(--jaddid-border)] p-4">
            <p className="mb-3 text-xs font-bold text-slate-500">
              يحتاج إجراء اليوم — 3 تنتهي اليوم، 7 خلال 3 أيام، 4 معرّضون للفقدان
            </p>
            <ul className="space-y-2">
              {ACTIONS.map((a) => (
                <li
                  key={a.name}
                  className="flex items-center justify-between gap-3 rounded-lg bg-[var(--jaddid-surface)] px-3 py-2 text-sm"
                >
                  <span className="text-slate-700">
                    <span className="font-semibold">{a.name}</span>
                    <span className="text-slate-400"> — {a.detail}</span>
                  </span>
                  <span className="shrink-0 rounded-lg bg-white px-3 py-1 text-xs font-bold text-[var(--jaddid-blue)] shadow-sm">
                    {a.cta}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
