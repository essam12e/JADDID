"use client";

import { useEffect, useRef } from "react";
import SectionHeading from "./SectionHeading";
import Reveal from "./Reveal";

const steps = [
  { n: "١", title: "أنشئ حسابك", desc: "تسجيل بسيط بالبريد أو الجوال، بدون بطاقة ائتمان." },
  { n: "٢", title: "أضف متجرك", desc: "اسم المتجر ورابطه — حتى لو لم يكن جاهزًا بعد." },
  { n: "٣", title: "استورد منتجاتك", desc: "جَدِّد يقرأ منتجاتك العامة تلقائيًا، أو تضيفها يدويًا." },
  { n: "٤", title: "اربط عملية البيع بالعميل", desc: "سجّل من اشترى وأي منتج، في ثوانٍ." },
  { n: "٥", title: "حدد مدة الاشتراك", desc: "شهري، ربع سنوي، سنوي — يحسب جَدِّد الباقي تلقائيًا." },
  { n: "٦", title: "جَدِّد يتابع موعد الانتهاء", desc: "بدون تذكير يدوي أو جدول إكسل منفصل." },
  { n: "٧", title: "ذكّر العميل", desc: "رسالة واتساب جاهزة بمتغيرات العميل — أنت من يرسلها." },
  { n: "٨", title: "سجل التجديد", desc: "تجديد بضغطة واحدة، دون إعادة إدخال أي بيانات." },
];

export default function HowItWorks() {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion || !trackRef.current) return;

    let ctx: { revert: () => void } | undefined;
    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        gsap.fromTo(
          ".timeline-fill",
          { scaleY: 0 },
          {
            scaleY: 1,
            transformOrigin: "top",
            ease: "none",
            scrollTrigger: {
              trigger: trackRef.current,
              start: "top 70%",
              end: "bottom 60%",
              scrub: 0.6,
            },
          },
        );
      }, trackRef);
    })();

    return () => ctx?.revert();
  }, []);

  return (
    <section id="how-it-works" className="mx-auto max-w-4xl px-6 py-20">
      <Reveal>
        <SectionHeading
          eyebrow="كيف يعمل؟"
          title="من حساب جديد إلى تجديد مسجّل"
          subtitle="ثماني خطوات متصلة — ليست ميزات منفصلة، بل رحلة واحدة من أول عميل إلى أول تجديد."
        />
      </Reveal>

      <div ref={trackRef} className="relative mt-14 ps-10 sm:ps-14">
        {/* Track rail */}
        <div className="absolute right-3.5 top-1 bottom-1 w-px bg-[var(--jaddid-border)] sm:right-5" />
        <div
          className="timeline-fill absolute right-3.5 top-1 bottom-1 w-px sm:right-5"
          style={{ background: "var(--gradient-brand)" }}
        />

        <ol className="space-y-9">
          {steps.map((s) => (
            <li key={s.n} className="relative">
              <span
                className="absolute -right-10 top-0 flex h-8 w-8 items-center justify-center rounded-full text-xs font-extrabold text-white shadow-sm sm:-right-14 sm:h-9 sm:w-9"
                style={{ background: "var(--gradient-brand)" }}
              >
                {s.n}
              </span>
              <h3 className="text-h3 text-[var(--jaddid-navy)]">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-7 text-slate-600">{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
