"use client";

import { useEffect, useRef } from "react";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

const CARDS = [
  { text: "تم تسجيل عميل جديد", tone: "blue" },
  { text: "اشتراك نشط", tone: "emerald" },
  { text: "متبقي 3 أيام", tone: "amber" },
  { text: "تم التجديد", tone: "emerald" },
  { text: "VIP", tone: "purple" },
  { text: "فرصة تجديد 149 ر.س", tone: "blue" },
] as const;

const TONE_CLASSES: Record<(typeof CARDS)[number]["tone"], string> = {
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-700 ring-amber-100",
  purple: "bg-purple-50 text-purple-700 ring-purple-100",
};

/**
 * Replaces the old logo-reveal video: a small animated composition of
 * UI-like status cards entering/exiting with staggered motion. Explicitly
 * illustrative — never presented as a real account.
 */
export default function ProductStory() {
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion || !wrapRef.current) return;

    let ctx: { revert: () => void } | undefined;
    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      gsap.registerPlugin(ScrollTrigger);

      ctx = gsap.context(() => {
        const cards = gsap.utils.toArray<HTMLElement>(".story-card");
        gsap.set(cards, { opacity: 0, y: 18, scale: 0.96 });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: wrapRef.current,
            start: "top 75%",
            once: true,
          },
        });
        tl.to(cards, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.5,
          ease: "power3.out",
          stagger: 0.12,
        });

        // Gentle continuous float, offset per card, GPU-only.
        cards.forEach((card, i) => {
          gsap.to(card, {
            y: "+=8",
            duration: 2.6 + (i % 3) * 0.4,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut",
            delay: 0.6 + i * 0.15,
          });
        });
      }, wrapRef);
    })();

    return () => ctx?.revert();
  }, []);

  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <Reveal>
        <SectionHeading
          eyebrow="داخل جَدِّد"
          title="متجرك، بس مرتب ومتابَع"
          subtitle="مثال توضيحي لما تراه لوحة التحكم لحظة بلحظة — بياناتك الحقيقية تبدأ فارغة وتُبنى من عملياتك أنت."
        />
      </Reveal>
      <div
        ref={wrapRef}
        className="relative mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4"
      >
        {CARDS.map((c) => (
          <div
            key={c.text}
            className={`story-card rounded-2xl px-4 py-5 text-center text-sm font-bold ring-1 ${TONE_CLASSES[c.tone]}`}
          >
            {c.text}
          </div>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-slate-400">
        بيانات توضيحية لغرض العرض — ليست من حساب حقيقي.
      </p>
    </section>
  );
}
