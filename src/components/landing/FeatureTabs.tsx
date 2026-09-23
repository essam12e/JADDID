"use client";

import { useState } from "react";
import Reveal from "./Reveal";
import { FEATURES } from "./FeatureSections";

export default function FeatureTabs() {
  const [activeId, setActiveId] = useState(FEATURES[0].id);
  const active = FEATURES.find((f) => f.id === activeId) ?? FEATURES[0];

  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-20">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-accent">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--jaddid-blue)]" />
            كيف يعمل جَدِّد
          </span>
          <h2 className="text-h2 mt-2 text-[var(--jaddid-navy)]">
            خمس خطوات، أداة واحدة
          </h2>
        </div>
      </Reveal>

      {/* Tab pills — scrollable strip on mobile, centered row on desktop */}
      <Reveal delay={0.05}>
        <div className="mt-10 -mx-6 overflow-x-auto px-6 pb-1 sm:mx-0 sm:overflow-visible sm:px-0">
          <div className="flex w-max gap-2 sm:w-full sm:flex-wrap sm:justify-center">
            {FEATURES.map((f) => {
              const isActive = f.id === activeId;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setActiveId(f.id)}
                  className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-bold transition-colors ${
                    isActive
                      ? "text-white shadow-md"
                      : "border border-[var(--jaddid-border)] bg-white text-slate-500 hover:text-[var(--jaddid-navy)]"
                  }`}
                  style={isActive ? { background: "var(--gradient-brand)" } : undefined}
                  aria-pressed={isActive}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </Reveal>

      <div
        key={active.id}
        className="mt-10 grid items-center gap-10 rounded-3xl border border-[var(--jaddid-border)] bg-white p-6 shadow-sm sm:grid-cols-2 sm:p-10"
        style={{ animation: "feature-panel-in 0.4s ease" }}
      >
        <div>
          <span className="text-sm font-bold text-accent">{active.eyebrow}</span>
          <h3 className="text-h3 mt-2 text-[var(--jaddid-navy)]">{active.title}</h3>
          <p className="text-body mt-3 text-base text-slate-600">{active.description}</p>
          <ul className="mt-5 space-y-2.5">
            {active.bullets.map((b) => (
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
        </div>
        <div className="rounded-2xl bg-[var(--jaddid-surface)] p-6">{active.visual}</div>
      </div>
    </section>
  );
}
