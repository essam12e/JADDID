"use client";

import { useEffect, useRef, useState } from "react";
import UpgradePrompt from "@/components/dashboard/UpgradePrompt";

/**
 * Multi-store-ready switcher. Every dashboard page today resolves "the"
 * store as the org's first row (`stores` is 1:many with `organizations`
 * at the schema/RLS level, but no page accepts a chosen store yet, and
 * there is no RPC to create a second store — the base plan's
 * `stores_limit` is 1). Rather than fake a working "add store" flow or a
 * dropdown with nothing real to switch between, this always shows the
 * real store name, will list every store the moment an org actually has
 * more than one (already wired, just currently dormant since that never
 * happens yet), and turns "+ إضافة متجر" into the real plan-limit
 * explanation instead of a dead link.
 */
export default function StoreSwitcher({
  stores,
  storesLimit,
}: {
  stores: { id: string; name: string }[];
  storesLimit: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowUpgrade(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (stores.length === 0) return null;

  const atLimit = storesLimit !== null && stores.length >= storesLimit;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-[var(--jaddid-navy)] hover:bg-slate-50"
      >
        <span className="max-w-[9rem] truncate">{stores[0].name}</span>
        <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5 shrink-0 text-slate-400">
          <path
            d="M5.5 7.5 10 12l4.5-4.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          className={`absolute right-0 top-full z-40 mt-2 max-w-[90vw] rounded-2xl border border-[var(--jaddid-border)] bg-white p-1.5 shadow-lg ${
            showUpgrade ? "w-80" : "w-56"
          }`}
        >
          {stores.map((s) => (
            <p
              key={s.id}
              className="rounded-lg bg-[var(--jaddid-surface)] px-3 py-2 text-sm font-semibold text-[var(--jaddid-navy)]"
            >
              {s.name}
            </p>
          ))}
          <button
            type="button"
            onClick={() => setShowUpgrade(true)}
            className="mt-1 w-full rounded-lg px-3 py-2 text-right text-sm font-semibold text-[var(--jaddid-blue)] hover:bg-[var(--jaddid-surface)]"
          >
            + إضافة متجر
          </button>

          {showUpgrade ? (
            <div className="mt-1 border-t border-[var(--jaddid-border)] pt-2">
              <UpgradePrompt
                limitLabel="عدد المتاجر"
                suggestion={
                  atLimit
                    ? "باقة أعلى تدعم أكثر من متجر ضمن نفس الحساب."
                    : "دعم إضافة متجر ثانٍ لا يزال قيد التطوير."
                }
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
