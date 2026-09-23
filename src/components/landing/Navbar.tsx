"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/#features", label: "المميزات" },
  { href: "/#pricing", label: "الأسعار" },
  { href: "/#faq", label: "الأسئلة الشائعة" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 border-b transition-colors ${
        scrolled
          ? "border-[var(--jaddid-border)] bg-white/85 backdrop-blur"
          : "border-transparent bg-white/60 backdrop-blur-sm"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/brand/jaddid-icon-transparent.png"
            alt="جَدِّد | JADDID"
            width={32}
            height={32}
            className="h-8 w-8"
          />
          <span className="font-extrabold text-[var(--jaddid-navy)]">جَدِّد</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 sm:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-[var(--jaddid-blue)]">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          <Link
            href="/login"
            className="text-sm font-semibold text-slate-600 hover:text-[var(--jaddid-blue)]"
          >
            تسجيل الدخول
          </Link>
          <Link
            href="/signup"
            className="rounded-xl px-4 py-2 text-sm font-bold text-white"
            style={{ background: "var(--gradient-brand)" }}
          >
            إنشاء حساب
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "إغلاق القائمة" : "فتح القائمة"}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--jaddid-border)] text-[var(--jaddid-navy)] sm:hidden"
        >
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            {open ? (
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            ) : (
              <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      <div
        id="mobile-menu"
        className={`overflow-hidden border-t border-[var(--jaddid-border)] bg-white transition-[max-height] duration-300 sm:hidden ${
          open ? "max-h-96" : "max-h-0 border-t-0"
        }`}
      >
        <nav className="flex flex-col gap-1 px-6 py-4 text-sm font-medium text-slate-600">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-2.5 hover:bg-[var(--jaddid-surface)] hover:text-[var(--jaddid-blue)]"
            >
              {l.label}
            </Link>
          ))}
          <div className="mt-2 flex flex-col gap-2 border-t border-[var(--jaddid-border)] pt-3">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-2.5 text-center font-semibold hover:bg-[var(--jaddid-surface)]"
            >
              تسجيل الدخول
            </Link>
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-2.5 text-center font-bold text-white"
              style={{ background: "var(--gradient-brand)" }}
            >
              إنشاء حساب
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
