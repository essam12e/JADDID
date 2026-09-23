"use client";

import { useEffect, useRef } from "react";

/**
 * Dual-row infinite service marquee. Real brand logo assets aren't on hand
 * and hotlinking third-party logo images isn't acceptable, so each chip
 * uses a small, deliberately-designed glyph badge (initial + category
 * color) instead of a wordmark — illustrative, not a claim of partnership.
 * Spans design/creative, AI, productivity, dev tools, gaming and
 * entertainment so it doesn't read as a two-brand showcase.
 */
type Service = { name: string; letter: string; color: string };

const ROW_A: Service[] = [
  { name: "Adobe Creative Cloud", letter: "A", color: "#DA1F26" },
  { name: "ChatGPT Plus", letter: "G", color: "#10A37F" },
  { name: "Microsoft 365", letter: "M", color: "#2F6BFF" },
  { name: "Notion", letter: "N", color: "#131735" },
  { name: "PlayStation Plus", letter: "P", color: "#1E2A5E" },
  { name: "Netflix", letter: "N", color: "#E11D2E" },
  { name: "GitHub Copilot", letter: "GH", color: "#131735" },
  { name: "Canva Pro", letter: "C", color: "#8B5CF6" },
];

const ROW_B: Service[] = [
  { name: "Spotify", letter: "S", color: "#1DB954" },
  { name: "Figma", letter: "F", color: "#8B5CF6" },
  { name: "Claude Pro", letter: "CL", color: "#DE7B4C" },
  { name: "Google Workspace", letter: "GW", color: "#2F6BFF" },
  { name: "Zoom Pro", letter: "Z", color: "#22D3EE" },
  { name: "Xbox Game Pass", letter: "X", color: "#107C10" },
  { name: "YouTube Premium", letter: "YT", color: "#E11D2E" },
  { name: "Shahid VIP", letter: "SH", color: "#1E2A5E" },
  { name: "Dropbox", letter: "D", color: "#2F6BFF" },
];

function Chip({ service }: { service: Service }) {
  return (
    <span className="flex h-11 shrink-0 items-center gap-2.5 rounded-full border border-[var(--jaddid-border)] bg-white py-2 pl-4 pr-2 text-sm font-semibold text-slate-700 shadow-sm">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
        style={{ background: service.color }}
        aria-hidden="true"
      >
        {service.letter}
      </span>
      {service.name}
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
    <div className="overflow-hidden">
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
