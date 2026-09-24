import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      className="flex min-h-full flex-1 items-center justify-center px-4 py-10"
      style={{ background: "linear-gradient(180deg, #ffffff 0%, #f6f8ff 100%)" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center">
          <Link href="/" className="mb-3">
            <Image
              src="/brand/jaddid-logo-256.png"
              alt="جَدِّد | JADDID"
              width={48}
              height={48}
              className="h-12 w-12 rounded-xl"
            />
          </Link>
          <h1 className="text-xl font-bold text-[var(--jaddid-navy)]">{title}</h1>
          {subtitle ? (
            <p className="mt-1 text-center text-sm text-slate-500">{subtitle}</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-6 shadow-sm">
          {children}
        </div>

        {footer ? (
          <p className="mt-4 text-center text-sm text-slate-500">{footer}</p>
        ) : null}
      </div>
    </div>
  );
}
