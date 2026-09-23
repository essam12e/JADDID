"use client";

import { useEffect, useRef } from "react";

/**
 * The recurring brand signature: a thin circular orbit with a moving dot,
 * used sparingly next to a handful of key headlines. Pure SVG + GSAP,
 * transform/opacity only, and fully inert under prefers-reduced-motion.
 */
export default function OrbitMotif({
  size = 120,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const dotRef = useRef<SVGCircleElement>(null);
  const arcRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion || !dotRef.current) return;

    let ctx: { revert: () => void } | undefined;
    (async () => {
      const { gsap } = await import("gsap");
      ctx = gsap.context(() => {
        gsap.to(dotRef.current, {
          rotation: 360,
          transformOrigin: "50% 50%",
          duration: 14,
          repeat: -1,
          ease: "none",
        });
        gsap.to(arcRef.current, {
          rotation: -360,
          transformOrigin: "50% 50%",
          duration: 22,
          repeat: -1,
          ease: "none",
        });
      });
    })();

    return () => ctx?.revert();
  }, []);

  const r = size / 2 - 6;
  const c = size / 2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      aria-hidden="true"
    >
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="var(--jaddid-border)"
        strokeWidth={1.5}
      />
      <circle
        ref={arcRef}
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="var(--jaddid-blue)"
        strokeWidth={1.5}
        strokeDasharray={`${r * 0.9} ${2 * Math.PI * r}`}
        strokeLinecap="round"
        opacity={0.55}
      />
      <circle ref={dotRef} cx={c} cy={c - r} r={4} fill="var(--jaddid-cyan)" />
    </svg>
  );
}
