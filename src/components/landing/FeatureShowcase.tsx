import type { ReactNode } from "react";
import Reveal from "./Reveal";

export default function FeatureShowcase({
  eyebrow,
  title,
  description,
  bullets,
  visual,
  reverse,
}: {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  visual: ReactNode;
  reverse?: boolean;
}) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-14">
      <div
        className={`grid items-center gap-10 sm:grid-cols-2 ${
          reverse ? "sm:[&>*:first-child]:order-2" : ""
        }`}
      >
        <Reveal>
          <span className="text-sm font-bold text-accent">{eyebrow}</span>
          <h3 className="text-h3 mt-2 text-[var(--jaddid-navy)]">{title}</h3>
          <p className="text-body mt-3 text-base text-slate-600">{description}</p>
          <ul className="mt-5 space-y-2.5">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-slate-700">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white"
                  style={{ background: "var(--gradient-brand)" }}
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                    <path
                      fillRule="evenodd"
                      d="M16.7 5.3a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0l-3-3a1 1 0 111.4-1.4L8.3 11.6l6.3-6.3a1 1 0 011.4 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                {b}
              </li>
            ))}
          </ul>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="rounded-2xl border border-[var(--jaddid-border)] bg-[var(--jaddid-surface)] p-6">
            {visual}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
