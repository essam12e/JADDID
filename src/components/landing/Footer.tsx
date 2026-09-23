import Image from "next/image";
import Link from "next/link";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "المنتج",
    links: [
      { href: "/#features", label: "المميزات" },
      { href: "/pricing", label: "الأسعار" },
      { href: "/#faq", label: "الأسئلة الشائعة" },
    ],
  },
  {
    title: "الشركة",
    links: [
      { href: "/about", label: "من نحن" },
      { href: "/terms", label: "سياسة الاستخدام" },
      { href: "/privacy", label: "سياسة الخصوصية" },
    ],
  },
  {
    title: "الحساب",
    links: [
      { href: "/login", label: "تسجيل الدخول" },
      { href: "/signup", label: "إنشاء حساب" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-[var(--jaddid-border)] bg-white">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-[1.3fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <Image
                src="/brand/jaddid-icon-transparent.png"
                alt="جَدِّد | JADDID"
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <span className="font-extrabold text-[var(--jaddid-navy)]">جَدِّد</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-7 text-slate-500">
              أداة لإدارة اشتراكات عملائك المتكررة — منتجاتك وعملاؤك واشتراكاتهم
              في مكان واحد، مع متابعة تلقائية لمواعيد التجديد.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                {col.title}
              </p>
              <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="hover:text-[var(--jaddid-blue)]">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center gap-2 border-t border-[var(--jaddid-border)] pt-6 text-center sm:flex-row sm:justify-between sm:text-right">
          <p className="text-xs text-slate-400">
            © {new Date().getFullYear()} جَدِّد | JADDID. جميع الحقوق محفوظة.
          </p>
          <p className="text-xs text-slate-400">
            جَدِّد | JADDID — أحد منتجات نطاق | NITAAQ
          </p>
        </div>
      </div>
    </footer>
  );
}
