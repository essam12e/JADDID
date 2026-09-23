"use client";

import { useEffect, useRef } from "react";
import OrbitMotif from "./OrbitMotif";

export default function Hero() {
  const visualRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    let ctx: { revert: () => void } | undefined;
    (async () => {
      const { gsap } = await import("gsap");
      ctx = gsap.context(() => {
        const entrance = gsap.timeline({ defaults: { ease: "power3.out" } });
        entrance
          .from(".hero-eyebrow", { opacity: 0, y: 14, duration: 0.5 })
          .from(".hero-title", { opacity: 0, y: 18, duration: 0.6 }, "-=0.3")
          .from(".hero-sub", { opacity: 0, y: 14, duration: 0.5 }, "-=0.35")
          .from(".hero-ctas > *", { opacity: 0, y: 12, duration: 0.45, stagger: 0.08 }, "-=0.3")
          .from(visualRef.current, { opacity: 0, scale: 0.9, duration: 0.7 }, "-=0.5");

        // Calm, continuous float on the whole logo+orbit composition —
        // never spinning or bouncy.
        gsap.to(visualRef.current, {
          y: -10,
          duration: 4.6,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });

        // Soft breathing glow behind the mark.
        gsap.to(glowRef.current, {
          opacity: 0.5,
          scale: 1.08,
          duration: 3.4,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });
    })();

    return () => ctx?.revert();
  }, []);

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #ffffff 0%, #f6f8ff 65%, #ffffff 100%)" }}
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-16 pt-14 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-6">
        {/* Copy — leads on the right in RTL reading order */}
        <div className="text-center lg:order-2 lg:text-right">
          <span className="hero-eyebrow inline-flex items-center gap-2 rounded-full border border-[var(--jaddid-border)] bg-white px-3 py-1 text-xs font-bold text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--jaddid-blue)]" />
            إدارة اشتراكات العملاء
          </span>

          <h1 className="hero-title text-display mt-5 text-[var(--jaddid-navy)]">
            كل اشتراك له موعد...
            <br />
            <span className="text-accent">جَدِّد</span> يتذكره عنك.
          </h1>

          <p className="hero-sub text-body mx-auto mt-5 text-base text-slate-600 sm:text-lg lg:mx-0">
            جَدِّد يجمع منتجات متجرك وعملاءك واشتراكاتهم، ويتابع مواعيد
            الانتهاء والتجديد من مكان واحد — بدل ملاحظات متناثرة ومحادثات
            واتساب لا تنتهي.
          </p>

          <div className="hero-ctas mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <a
              href="/signup"
              className="w-full rounded-xl px-7 py-3.5 text-center text-sm font-bold text-white shadow-md transition-transform hover:scale-[1.02] active:scale-[0.99] sm:w-auto"
              style={{ background: "var(--gradient-brand)" }}
            >
              ابدأ مع جَدِّد
            </a>
            <a
              href="#features"
              className="w-full rounded-xl border border-[var(--jaddid-border)] bg-white px-7 py-3.5 text-center text-sm font-bold text-[var(--jaddid-navy)] transition-colors hover:border-[var(--jaddid-blue)]/40 sm:w-auto"
            >
              اكتشف كيف يعمل
            </a>
          </div>
        </div>

        {/* Logo + orbit — one integrated composition, logo at true ring center */}
        <div className="relative flex items-center justify-center lg:order-1 lg:justify-start">
          <div
            ref={glowRef}
            className="pointer-events-none absolute h-56 w-56 rounded-full opacity-25 blur-3xl sm:h-72 sm:w-72"
            style={{ background: "var(--gradient-brand)" }}
            aria-hidden="true"
          />
          <div ref={visualRef} className="relative w-56 sm:w-72 lg:w-[22rem]">
            <OrbitMotif size={360} className="w-full" />
          </div>
        </div>
      </div>
    </section>
  );
}
