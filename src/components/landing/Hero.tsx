"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import OrbitMotif from "./OrbitMotif";

export default function Hero() {
  const logoRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const sweepRef = useRef<HTMLDivElement>(null);

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
          .from(logoRef.current, { opacity: 0, scale: 0.85, duration: 0.7 }, "-=0.5");

        // Calm, continuous float + tilt — never spinning or bouncy.
        gsap.to(logoRef.current, {
          y: -14,
          rotate: 1.5,
          duration: 4.2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });

        // Soft breathing glow behind the mark.
        gsap.to(glowRef.current, {
          opacity: 0.55,
          scale: 1.08,
          duration: 3.4,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });

        // Gradient light sweep across the mark.
        gsap.fromTo(
          sweepRef.current,
          { xPercent: -130 },
          { xPercent: 130, duration: 3.2, repeat: -1, repeatDelay: 1.6, ease: "power1.inOut" },
        );
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
              href="#how-it-works"
              className="w-full rounded-xl border border-[var(--jaddid-border)] bg-white px-7 py-3.5 text-center text-sm font-bold text-[var(--jaddid-navy)] transition-colors hover:border-[var(--jaddid-blue)]/40 sm:w-auto"
            >
              اكتشف كيف يعمل
            </a>
          </div>
        </div>

        {/* Logo visual — large, animated, asymmetric */}
        <div className="relative flex items-center justify-center lg:order-1 lg:justify-start">
          <div
            ref={glowRef}
            className="pointer-events-none absolute h-64 w-64 rounded-full opacity-30 blur-3xl sm:h-80 sm:w-80"
            style={{ background: "var(--gradient-brand)" }}
            aria-hidden="true"
          />
          <OrbitMotif
            size={320}
            className="pointer-events-none absolute hidden sm:block"
          />
          <div ref={logoRef} className="relative">
            <div className="relative overflow-hidden rounded-[2rem]">
              <Image
                src="/brand/jaddid-logo.png"
                alt="جَدِّد | JADDID"
                width={220}
                height={220}
                priority
                className="relative z-10 h-44 w-44 rounded-[2rem] sm:h-56 sm:w-56"
              />
              <div
                ref={sweepRef}
                className="pointer-events-none absolute inset-y-0 z-20 w-1/3 -skew-x-12"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
                }}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
