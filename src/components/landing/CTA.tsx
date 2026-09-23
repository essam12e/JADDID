export default function CTA() {
  return (
    <section className="px-6 py-16">
      <div
        className="mx-auto flex max-w-4xl flex-col items-center gap-4 rounded-3xl px-6 py-14 text-center"
        style={{ background: "var(--gradient-brand)" }}
      >
        <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
          جاهز تبدأ متابعة اشتراكات عملائك؟
        </h2>
        <p className="max-w-xl text-sm text-white/85 sm:text-base">
          أنشئ حسابك الآن مجانًا واستورد منتجات متجرك في دقائق.
        </p>
        <a
          href="/signup"
          className="mt-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-[var(--jaddid-navy)]"
        >
          إنشاء حساب مجاني
        </a>
      </div>
    </section>
  );
}
