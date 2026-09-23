export default function CTA() {
  return (
    <section className="px-6 py-16">
      <div
        className="relative mx-auto flex max-w-4xl flex-col items-center gap-4 overflow-hidden rounded-3xl px-6 py-16 text-center shadow-[0_30px_60px_-20px_rgba(47,107,255,0.45)] sm:py-20"
        style={{ background: "var(--gradient-brand)" }}
      >
        <div
          className="pointer-events-none absolute -top-20 -right-10 h-64 w-64 rounded-full bg-white opacity-[0.12] blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-white opacity-[0.1] blur-3xl"
          aria-hidden="true"
        />
        <h2 className="relative text-[clamp(1.75rem,1.4rem+1.6vw,2.5rem)] font-extrabold leading-tight text-white">
          جاهز تبدأ متابعة اشتراكات عملائك؟
        </h2>
        <p className="relative max-w-xl text-sm text-white/85 sm:text-base">
          أنشئ حسابك الآن مجانًا واستورد منتجات متجرك في دقائق.
        </p>
        <a
          href="/signup"
          className="relative mt-2 rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-[var(--jaddid-navy)] shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.99]"
        >
          إنشاء حساب مجاني
        </a>
      </div>
    </section>
  );
}
