"use client";

import { useEffect, useRef } from "react";
import { BRAND_ICONS, type BrandIcon } from "./brandIcons";

/**
 * Dual-row infinite service marquee. Each chip renders the brand's real,
 * official mark (bundled SVG path data — see brandIcons.ts), spanning
 * design, AI, productivity, dev tools, gaming and entertainment so it
 * doesn't read as a two-brand showcase.
 */
type Service = { name: string; icon: BrandIcon };

function svc(slug: keyof typeof BRAND_ICONS, name?: string): Service {
  return { name: name ?? BRAND_ICONS[slug].title, icon: BRAND_ICONS[slug] };
}

const ROW_A: Service[] = [
  svc("figma"),
  svc("claude", "Claude Pro"),
  svc("notion"),
  svc("playstation", "PlayStation Plus"),
  svc("netflix"),
  svc("githubcopilot", "GitHub Copilot"),
  svc("zoom", "Zoom Pro"),
  svc("spotify"),
];

const ROW_B: Service[] = [
  svc("sketch"),
  svc("perplexity", "Perplexity Pro"),
  svc("dropbox"),
  svc("steam"),
  svc("youtube", "YouTube Premium"),
  svc("vercel"),
  svc("airtable"),
  svc("soundcloud"),
];

function Chip({ service }: { service: Service }) {
  const { icon } = service;
  return (
    <span className="flex h-11 shrink-0 items-center gap-2.5 rounded-full border border-[var(--jaddid-border)] bg-white py-2 pl-4 pr-2.5 text-sm font-semibold text-slate-700 shadow-sm">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
        style={{ background: `#${icon.hex}` }}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="#ffffff"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d={icon.path} />
        </svg>
      </span>
      <span className="whitespace-nowrap">{service.name}</span>
    </span>
  );
}

function Row({
  items,
  reverse,
  duration,
}: {
  items: Service[];
  reverse: boolean;
  duration: number;
}) {
  const doubled = [...items, ...items];
  const trackRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<{ timeScale: (v: number) => void; kill: () => void } | null>(
    null,
  );

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion || !trackRef.current) return;

    let tween: { timeScale: (v: number) => void; kill: () => void } | undefined;
    let cancelled = false;
    (async () => {
      const { gsap } = await import("gsap");
      if (cancelled || !trackRef.current) return;
      tween = gsap.fromTo(
        trackRef.current,
        { xPercent: reverse ? -50 : 0 },
        {
          xPercent: reverse ? 0 : -50,
          duration,
          ease: "none",
          repeat: -1,
        },
      );
      tweenRef.current = tween;
    })();

    return () => {
      cancelled = true;
      tween?.kill();
    };
  }, [reverse, duration]);

  return (
    <div
      className="overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
      }}
    >
      <div
        ref={trackRef}
        className="marquee-track flex w-max gap-3 will-change-transform"
        data-dir={reverse ? "ltr" : "rtl"}
        onMouseEnter={() => tweenRef.current?.timeScale(0.28)}
        onMouseLeave={() => tweenRef.current?.timeScale(1)}
      >
        {doubled.map((service, i) => (
          <Chip key={`${service.name}-${i}`} service={service} />
        ))}
      </div>
    </div>
  );
}

export default function Marquee() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      <p className="text-center text-xs font-bold uppercase tracking-wide text-slate-400">
        يعمل جَدِّد مع أي اشتراك تبيعه — أمثلة شائعة
      </p>
      <div className="mt-6 space-y-3">
        <Row items={ROW_A} reverse={false} duration={42} />
        <Row items={ROW_B} reverse duration={48} />
      </div>
      <p className="mx-auto mt-6 max-w-lg text-center text-xs leading-6 text-slate-400">
        العلامات التجارية المعروضة لأغراض توضيحية فقط ولا تعني وجود شراكة أو
        اعتماد.
      </p>
    </div>
  );
}
