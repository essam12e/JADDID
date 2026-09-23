import type { ReactNode } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function LegalPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <span className="text-sm font-bold text-accent">{eyebrow}</span>
          <h1 className="text-h2 mt-2 text-[var(--jaddid-navy)]">{title}</h1>
          <p className="mt-2 text-xs text-slate-400">آخر تحديث: {updated}</p>
          <div className="prose-legal mt-10 space-y-8 text-sm leading-8 text-slate-600 sm:text-base sm:leading-8">
            {children}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-h3 text-[var(--jaddid-navy)]">{title}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}
