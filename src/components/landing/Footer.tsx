import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--jaddid-border)] bg-white">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-10 text-center sm:flex-row sm:justify-between sm:text-right">
        <div className="flex items-center gap-2">
          <Image
            src="/brand/jaddid-logo.png"
            alt="جَدِّد | JADDID"
            width={28}
            height={28}
            className="h-7 w-7 rounded-lg"
          />
          <span className="font-bold text-[var(--jaddid-navy)]">جَدِّد</span>
        </div>

        <nav className="flex flex-wrap justify-center gap-5 text-sm text-slate-500">
          <Link href="#pricing" className="hover:text-[var(--jaddid-blue)]">
            الأسعار
          </Link>
          <Link href="/login" className="hover:text-[var(--jaddid-blue)]">
            تسجيل الدخول
          </Link>
          <Link href="/signup" className="hover:text-[var(--jaddid-blue)]">
            إنشاء حساب
          </Link>
        </nav>

        <p className="text-xs text-slate-400">
          © {new Date().getFullYear()} جَدِّد | JADDID. جميع الحقوق محفوظة.
        </p>
      </div>
    </footer>
  );
}
