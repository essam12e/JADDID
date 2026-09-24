"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/**
 * The hero's signature visual: the JADDID mark sitting at the true center
 * of an animated orbit ring, with small subscription "nodes" around it and
 * a sequence of floating notification chips that tell the product's story
 * (new subscription -> reminder sent -> renewed). One integrated SVG/DOM
 * composition sharing a single coordinate system, so the logo is always
 * exactly centered — never a separately-floating circle next to a boxed
 * logo.
 *
 * Motion: slow continuous rotation, a soft pulse, and (desktop, pointer:fine
 * only) a light parallax tilt on pointer move. Everything is transform /
 * opacity only, and fully inert under prefers-reduced-motion. Notification
 * chips are shown from sm breakpoint up — on small phones there isn't room
 * to float text near the ring without risking overlap, so mobile keeps
 * just the ambient ring + logo.
 */

const NOTIFICATIONS: { icon: string; text: string }[] = [
  { icon: "sparkle", text: "اشتراك جديد" },
  { icon: "clock", text: "متبقي 7 أيام" },
  { icon: "bell", text: "موعد التجديد قريب" },
  { icon: "send", text: "تم إرسال التذكير" },
  { icon: "check", text: "تم التجديد ✓" },
  { icon: "star", text: "عميل VIP" },
];

const SLOTS = [
  { top: "4%", right: "-6%" },
  { top: "62%", left: "-10%" },
  { top: "30%", right: "-14%" },
] as const;

function NotifIcon({ name }: { name: string }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
      );
    case "bell":
      return (
        <svg {...common}>
          <path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>
      );
    case "send":
      return (
        <svg {...common}>
          <path d="M21 3 3 10.5l7.5 3 3 7.5L21 3Z" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8.5 12.5 2.3 2.3L16 9.5" />
        </svg>
      );
    case "star":
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M12 2.5 14.9 9l6.9.6-5.2 4.6 1.6 6.8L12 17.6 5.8 21l1.6-6.8-5.2-4.6L9.1 9 12 2.5Z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
        </svg>
      );
  }
}

export default function OrbitMotif({
  size = 340,
  className,
  showNotifications = true,
}: {
  size?: number;
  className?: string;
  showNotifications?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const pointerCleanupRef = useRef<(() => void) | null>(null);
  const [notifIndex, setNotifIndex] = useState(0);
  const [notifVisible, setNotifVisible] = useState(true);

  const c = size / 2;
  const r = size / 2 - 20;
  const nodeAngles = [-40, 70, 165, 245];

  // Notification cycle: hold ~2.6s, fade for 0.4s, next.
  useEffect(() => {
    if (!showNotifications) return;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    let holdTimer: ReturnType<typeof setTimeout>;
    let hideTimer: ReturnType<typeof setTimeout>;
    const cycle = () => {
      setNotifVisible(true);
      holdTimer = setTimeout(() => {
        setNotifVisible(false);
        hideTimer = setTimeout(() => {
          setNotifIndex((i) => (i + 1) % NOTIFICATIONS.length);
          cycle();
        }, 400);
      }, 2600);
    };
    cycle();
    return () => {
      clearTimeout(holdTimer);
      clearTimeout(hideTimer);
    };
  }, [showNotifications]);

  // Ring rotation + pulse, GSAP-driven.
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) return;

    let ctx: { revert: () => void } | undefined;
    (async () => {
      const { gsap } = await import("gsap");
      ctx = gsap.context(() => {
        gsap.to(groupRef.current, {
          rotation: 360,
          transformOrigin: "50% 50%",
          duration: 48,
          repeat: -1,
          ease: "none",
        });
        gsap.to(dotRef.current, {
          rotation: -360,
          transformOrigin: `${c}px ${c}px`,
          duration: 16,
          repeat: -1,
          ease: "none",
        });
        gsap.to(ringRef.current, {
          opacity: 0.85,
          duration: 2.4,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });

        // Desktop-only pointer parallax/tilt.
        const canHover = window.matchMedia(
          "(hover: hover) and (pointer: fine)",
        ).matches;
        if (canHover && tiltRef.current && containerRef.current) {
          const el = containerRef.current;
          const quickX = gsap.quickTo(tiltRef.current, "rotationY", {
            duration: 0.6,
            ease: "power2.out",
          });
          const quickY = gsap.quickTo(tiltRef.current, "rotationX", {
            duration: 0.6,
            ease: "power2.out",
          });
          const onMove = (e: PointerEvent) => {
            const rect = el.getBoundingClientRect();
            const px = (e.clientX - rect.left) / rect.width - 0.5;
            const py = (e.clientY - rect.top) / rect.height - 0.5;
            quickX(px * 8);
            quickY(-py * 8);
          };
          const onLeave = () => {
            quickX(0);
            quickY(0);
          };
          el.addEventListener("pointermove", onMove);
          el.addEventListener("pointerleave", onLeave);
          pointerCleanupRef.current = () => {
            el.removeEventListener("pointermove", onMove);
            el.removeEventListener("pointerleave", onLeave);
          };
        }
      });
    })();

    return () => {
      ctx?.revert();
      pointerCleanupRef.current?.();
      pointerCleanupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = NOTIFICATIONS[notifIndex];
  const slot = SLOTS[notifIndex % SLOTS.length];

  return (
    <div
      ref={containerRef}
      className={`relative aspect-square ${className ?? ""}`}
      style={{ width: size, maxWidth: "100%" }}
    >
      <div
        ref={tiltRef}
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d", perspective: 800 }}
      >
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="orbit-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--jaddid-blue)" />
              <stop offset="50%" stopColor="var(--jaddid-cyan)" />
              <stop offset="100%" stopColor="var(--jaddid-purple)" />
            </linearGradient>
          </defs>

          {/* Static faint base ring */}
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--jaddid-border)" strokeWidth={1.5} />

          {/* Rotating group: animated gradient arc + subscription nodes */}
          <g ref={groupRef}>
            <circle
              ref={ringRef}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke="url(#orbit-gradient)"
              strokeWidth={2}
              strokeDasharray={`${r * 1.35} ${2 * Math.PI * r}`}
              strokeLinecap="round"
              opacity={0.6}
            />
            {nodeAngles.map((angle) => {
              const rad = (angle * Math.PI) / 180;
              const nx = c + r * Math.cos(rad);
              const ny = c + r * Math.sin(rad);
              return (
                <circle
                  key={angle}
                  cx={nx}
                  cy={ny}
                  r={4.5}
                  fill="var(--background)"
                  stroke="var(--jaddid-blue)"
                  strokeWidth={1.5}
                />
              );
            })}
          </g>

          {/* Moving pulse dot, independent rotation speed */}
          <circle ref={dotRef} cx={c} cy={c - r} r={5} fill="var(--jaddid-cyan)" />
        </svg>

        {/* Logo — true center of the ring, transparent background, no card */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="relative drop-shadow-[0_18px_40px_rgba(47,107,255,0.18)]"
            style={{ width: "46%", aspectRatio: "1 / 1" }}
          >
            <Image
              src="/brand/jaddid-logo-256.png"
              alt="جَدِّد | JADDID"
              fill
              priority
              sizes="(min-width: 1024px) 220px, (min-width: 640px) 180px, 140px"
            />
          </div>
        </div>
      </div>

      {/* Floating notification chips — sm breakpoint and up only */}
      {showNotifications ? (
        <div
          className="pointer-events-none absolute z-10 hidden transition-all duration-500 ease-out sm:block"
          style={{
            ...slot,
            opacity: notifVisible ? 1 : 0,
            transform: notifVisible ? "translateY(0)" : "translateY(6px)",
          }}
        >
          <span className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--jaddid-border)] bg-white/95 px-3 py-1.5 text-xs font-bold text-[var(--jaddid-navy)] shadow-md backdrop-blur">
            <span className="text-[var(--jaddid-blue)]">
              <NotifIcon name={current.icon} />
            </span>
            {current.text}
          </span>
        </div>
      ) : null}
    </div>
  );
}
