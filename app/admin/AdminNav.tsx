"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "نظرة عامة", icon: "📊" },
  { href: "/admin/activations", label: "طلبات التفعيل", icon: "✅" },
  { href: "/admin/organizations", label: "المؤسسات", icon: "🏢" },
];

export default function AdminNav({ fullName }: { fullName: string }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-[var(--jaddid-border)] bg-[var(--jaddid-navy)] text-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-bold">لوحة الإدارة</span>
          <span className="text-sm text-white/70">{fullName}</span>
        </div>
        <nav className="flex flex-wrap items-center gap-1">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                pathname === link.href ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10"
              }`}
            >
              {link.icon} {link.label}
            </Link>
          ))}
          <Link
            href="/dashboard"
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white/70 hover:bg-white/10"
          >
            رجوع للوحة التجارية
          </Link>
        </nav>
      </div>
    </header>
  );
}
