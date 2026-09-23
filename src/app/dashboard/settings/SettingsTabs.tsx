"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/settings/profile", label: "الملف الشخصي" },
  { href: "/dashboard/settings/store", label: "المتجر" },
  { href: "/dashboard/settings/security", label: "الأمان" },
];

export default function SettingsTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b border-[var(--jaddid-border)]">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
              active
                ? "border-[var(--jaddid-blue)] text-[var(--jaddid-blue)]"
                : "border-transparent text-slate-500 hover:text-[var(--jaddid-navy)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
