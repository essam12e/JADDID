"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NotificationBell from "@/components/dashboard/NotificationBell";
import StoreSwitcher from "./StoreSwitcher";

const LINKS = [
  { href: "/dashboard", label: "الرئيسية", icon: "🏠" },
  { href: "/dashboard/products", label: "المنتجات", icon: "📦" },
  { href: "/dashboard/customers", label: "العملاء", icon: "👥" },
  { href: "/dashboard/renewals", label: "التجديدات", icon: "🔔" },
  { href: "/dashboard/templates", label: "القوالب", icon: "💬" },
];

export default function DashboardNav({
  userEmail,
  isAdmin,
  stores,
  storesLimit,
}: {
  userEmail: string;
  isAdmin?: boolean;
  stores: { id: string; name: string }[];
  storesLimit: number | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-[var(--jaddid-border)] bg-white px-4 py-3 sm:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/brand/jaddid-logo-256.png"
            alt="جَدِّد"
            width={28}
            height={28}
            className="h-7 w-7 rounded-lg"
          />
          <span className="font-bold text-[var(--jaddid-navy)]">جَدِّد</span>
        </Link>
        <div className="flex items-center gap-1">
        <NotificationBell />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="فتح القائمة"
          aria-expanded={open}
          className="rounded-lg border border-[var(--jaddid-border)] p-2"
        >
          <span className="block h-0.5 w-5 bg-slate-600" />
          <span className="mt-1 block h-0.5 w-5 bg-slate-600" />
          <span className="mt-1 block h-0.5 w-5 bg-slate-600" />
        </button>
        </div>
      </div>

      {open ? (
        <nav className="border-b border-[var(--jaddid-border)] bg-white px-4 py-3 sm:hidden">
          {stores.length > 0 ? (
            <div className="mb-2 border-b border-[var(--jaddid-border)] pb-2">
              <StoreSwitcher stores={stores} storesLimit={storesLimit} />
            </div>
          ) : null}
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-2.5 text-sm font-semibold ${
                pathname === link.href
                  ? "bg-[var(--jaddid-surface)] text-[var(--jaddid-blue)]"
                  : "text-slate-600"
              }`}
            >
              {link.icon} {link.label}
            </Link>
          ))}
          {isAdmin ? (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-purple-700"
            >
              🛡️ لوحة الإدارة
            </Link>
          ) : null}
          <Link
            href="/dashboard/settings"
            onClick={() => setOpen(false)}
            className={`block rounded-lg px-3 py-2.5 text-sm font-semibold ${
              pathname.startsWith("/dashboard/settings")
                ? "bg-[var(--jaddid-surface)] text-[var(--jaddid-blue)]"
                : "text-slate-600"
            }`}
          >
            ⚙️ الإعدادات
          </Link>
          <form action="/auth/signout" method="post" className="mt-2">
            <button className="w-full rounded-lg px-3 py-2.5 text-right text-sm font-semibold text-slate-500">
              تسجيل الخروج
            </button>
          </form>
        </nav>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-l border-[var(--jaddid-border)] bg-white sm:flex sm:flex-col">
        <div className="flex items-center justify-between border-b border-[var(--jaddid-border)] px-5 py-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image
              src="/brand/jaddid-logo-256.png"
              alt="جَدِّد"
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg"
            />
            <span className="font-extrabold text-[var(--jaddid-navy)]">جَدِّد</span>
          </Link>
          <NotificationBell />
        </div>

        {stores.length > 0 ? (
          <div className="border-b border-[var(--jaddid-border)] px-3 py-2.5">
            <StoreSwitcher stores={stores} storesLimit={storesLimit} />
          </div>
        ) : null}

        <nav className="flex-1 space-y-1 p-3">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`block rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                pathname === link.href
                  ? "bg-[var(--jaddid-surface)] text-[var(--jaddid-blue)]"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {link.icon} {link.label}
            </Link>
          ))}
          {isAdmin ? (
            <Link
              href="/admin"
              className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-50"
            >
              🛡️ لوحة الإدارة
            </Link>
          ) : null}
          <Link
            href="/dashboard/settings"
            className={`block rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
              pathname.startsWith("/dashboard/settings")
                ? "bg-[var(--jaddid-surface)] text-[var(--jaddid-blue)]"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            ⚙️ الإعدادات
          </Link>
        </nav>

        <div className="border-t border-[var(--jaddid-border)] p-3">
          <p className="truncate px-2 text-xs text-slate-400">{userEmail}</p>
          <form action="/auth/signout" method="post">
            <button className="mt-1 w-full rounded-lg px-3 py-2 text-right text-sm font-semibold text-slate-500 hover:bg-slate-50">
              تسجيل الخروج
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
