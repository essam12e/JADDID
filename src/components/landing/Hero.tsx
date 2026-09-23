import Image from "next/image";

export default function Hero() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #ffffff 0%, #f6f8ff 60%, #ffffff 100%)" }}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center px-6 pb-10 pt-14 text-center sm:pt-20">
        {/* Logo mark */}
        <div className="mb-6 flex items-center gap-3">
          <Image
            src="/brand/jaddid-logo.png"
            alt="جَدِّد | JADDID"
            width={56}
            height={56}
            priority
            className="h-14 w-14 rounded-2xl"
          />
        </div>

        <h1 className="max-w-3xl text-3xl font-extrabold leading-tight text-[var(--jaddid-navy)] sm:text-5xl">
          متجرك موجود؟ لا تبدأ من الصفر.
        </h1>
        <p className="mt-4 max-w-2xl text-balance text-base leading-8 text-slate-600 sm:text-lg">
          استورد منتجاتك، اربط عملاءك، ودع{" "}
          <span className="brand-gradient-text font-bold">جَدِّد</span> يتابع
          الاشتراكات والتجديدات نيابةً عنك.
        </p>

        {/* Store URL import prompt */}
        <form className="mt-8 flex w-full max-w-xl flex-col gap-3 sm:flex-row" action="/onboarding">
          <label htmlFor="store-url" className="sr-only">
            أدخل رابط متجرك
          </label>
          <input
            id="store-url"
            name="store_url"
            type="url"
            required
            placeholder="أدخل رابط متجرك"
            dir="ltr"
            className="w-full rounded-xl border border-[var(--jaddid-border)] bg-white px-4 py-3 text-right text-sm shadow-sm outline-none ring-0 placeholder:text-slate-400 focus:border-[var(--jaddid-blue)] focus:ring-2 focus:ring-[var(--jaddid-blue)]/20"
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-md transition-transform hover:scale-[1.02] active:scale-[0.99]"
            style={{ background: "var(--gradient-brand)" }}
          >
            استورد منتجات متجرك
          </button>
        </form>
        <p className="mt-3 text-xs text-slate-400">
          مجاني للتجربة — لا حاجة لبطاقة ائتمان الآن.
        </p>

        {/* Logo reveal video — no card / no background box, blended into the page */}
        <div className="relative mt-14 w-full max-w-3xl">
          <video
            className="mx-auto w-full max-w-md"
            autoPlay
            muted
            loop
            playsInline
            aria-label="عرض شعار جَدِّد المتحرك"
          >
            <source src="/brand/jaddid-logo-reveal.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </section>
  );
}
