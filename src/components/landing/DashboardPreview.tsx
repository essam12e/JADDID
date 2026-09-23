"use client";

import { useEffect, useRef } from "react";
import Reveal from "./Reveal";

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
    if (!gridRef.current) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) {
      gridRef.current.querySelectorAll<HTMLElement>(".stat-number").forEach((el) => {
        el.textContent = Number(el.dataset.value ?? 0).toLocaleString("ar-SA");
      });
      return;
    }

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
    <section
      className="section-edge-both relative overflow-hidden px-6 py-20"
      style={{ background: "var(--gradient-ink)" }}
    >
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-[26rem] w-[40rem] -translate-x-1/2 rounded-full opacity-[0.16] blur-3xl"
        style={{ background: "var(--gradient-brand)" }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-5xl">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 text-sm font-bold text-[var(--jaddid-cyan)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--jaddid-cyan)]" />
              لوحة التحكم
            </span>
            <h2 className="text-h2 mt-2 text-white">كل شيء يهمك، في شاشة واحدة</h2>
            <p className="text-body mx-auto mt-3 text-base text-white/60">
              أرقام توضيحية لغرض العرض فقط — حسابك الحقيقي يبدأ فارغًا ويُبنى من
              بياناتك.
            </p>
          </div>
        </Reveal>

        {/* Browser-chrome frame around the mock UI, for a "this is a real
            product" feel rather than a floating card of numbers. */}
        <Reveal delay={0.1}>
          <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-2xl backdrop-blur">
            <div className="flex items-center gap-1.5 border-b border-white/10 bg-white/[0.04] px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
              <span className="mx-auto rounded-md bg-white/5 px-3 py-1 text-[11px] text-white/40">
                jaddid.app/dashboard
              </span>
            </div>

            <div className="p-5 sm:p-7">
              <div ref={gridRef} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-center">
                    <p
                      className="stat-number text-2xl font-extrabold text-white"
                      data-value={s.value}
                    >
                      0
                    </p>
                    <p className="mt-1 text-xs text-white/50">{s.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-dashed border-white/15 p-4">
                <p className="mb-3 text-xs font-bold text-white/60">
                  يحتاج إجراء اليوم — 3 تنتهي اليوم، 7 خلال 3 أيام، 4 معرّضون للفقدان
                </p>
                <ul className="space-y-2">
                  {ACTIONS.map((a) => (
                    <li
                      key={a.name}
                      className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-sm"
                    >
                      <span className="text-white/80">
                        <span className="font-semibold text-white">{a.name}</span>
                        <span className="text-white/45"> — {a.detail}</span>
                      </span>
                      <span className="shrink-0 rounded-lg bg-white px-3 py-1 text-xs font-bold text-[var(--jaddid-navy)] shadow-sm">
                        {a.cta}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
