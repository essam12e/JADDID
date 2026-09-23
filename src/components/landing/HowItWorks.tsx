import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

const steps = [
  {
    n: "١",
    title: "استورد منتجاتك",
    desc: "أدخل رابط متجرك ودع جَدِّد يكتشف منتجاتك تلقائيًا — أو أضفها يدويًا في أي وقت.",
  },
  {
    n: "٢",
    title: "سجّل عملاءك",
    desc: "عند كل عملية بيع، سجّل العميل والمدة — يحسب جَدِّد تاريخ الانتهاء تلقائيًا.",
  },
  {
    n: "٣",
    title: "تابع وذكّر وجدّد",
    desc: "لوحة تحكم واحدة تعرض من يحتاج تذكيرًا اليوم، وتجهّز رسالة واتساب جاهزة للإرسال.",
  },
];

export default function HowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <Reveal>
        <SectionHeading eyebrow="كيف يعمل؟" title="ثلاث خطوات، لا أكثر" />
      </Reveal>
      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.1}>
            <div className="h-full rounded-2xl border border-[var(--jaddid-border)] bg-white p-6">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl text-lg font-extrabold text-white"
                style={{ background: "var(--gradient-brand)" }}
              >
                {s.n}
              </span>
              <h3 className="mt-4 text-lg font-bold text-[var(--jaddid-navy)]">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{s.desc}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
