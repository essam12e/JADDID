import Image from "next/image";
import Link from "next/link";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-10 border-b border-[var(--jaddid-border)] bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/brand/jaddid-logo.png"
            alt="جَدِّد | JADDID"
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg"
          />
          <span className="font-extrabold text-[var(--jaddid-navy)]">جَدِّد</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 sm:flex">
          <Link href="#pricing" className="hover:text-[var(--jaddid-blue)]">
            الأسعار
          </Link>
          <Link href="/login" className="hover:text-[var(--jaddid-blue)]">
            تسجيل الدخول
          </Link>
        </nav>

        <Link
          href="/signup"
          className="rounded-xl px-4 py-2 text-sm font-bold text-white"
          style={{ background: "var(--gradient-brand)" }}
        >
          إنشاء حساب
        </Link>
      </div>
    </header>
  );
}
