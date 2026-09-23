import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

const PAIRS = [
  {
    problem: "تنسى مواعيد تجديد عملائك",
    benefit: "جَدِّد يحسب موعد الانتهاء لكل اشتراك ويبقيه أمامك دائمًا",
  },
  {
    problem: "تبحث في محادثات واتساب القديمة عمّن يحتاج تذكيرًا",
    benefit: "قسم «يحتاج إجراء اليوم» يجمعهم في مكان واحد",
  },
  {
    problem: "تعيد إدخال بيانات نفس العميل كل مرة يجدّد",
    benefit: "تجديد بضغطة واحدة من سجل العميل الحالي",
  },
  {
    problem: "لا تعرف من يستحق اهتمامًا اليوم تحديدًا",
    benefit: "ترتيب تلقائي حسب الأقرب انتهاءً والأكثر عرضة للفقدان",
  },
  {
    problem: "تفقد عملاء دون أن تلاحظ",
    benefit: "تمييز واضح للعملاء «المعرّضين للفقدان» بعد انتهاء اشتراكهم",
  },
  {
    problem: "التجديد بطيء لأن كل خطوة يدوية",
    benefit: "رسالة تذكير جاهزة برابط الدفع مُدرج تلقائيًا",
  },
  {
    problem: "بيانات عملائك متناثرة بين جداول وملاحظات",
    benefit: "قاعدة بيانات واحدة لكل عميل ومنتج واشتراك",
  },
  {
    problem: "لا تعرف قيمة ما هو قابل للتجديد قريبًا",
    benefit: "لوحة تحكم تحسب فرص التجديد القادمة بوضوح",
  },
];

export default function WhyJaddid() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <Reveal>
        <SectionHeading eyebrow="لماذا جَدِّد" title="مشاكل حقيقية، لا كلام تسويقي" />
      </Reveal>

      <div className="mt-12 space-y-3">
        {PAIRS.map((p, i) => (
          <Reveal key={p.problem} delay={(i % 4) * 0.05}>
            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--jaddid-border)] bg-white p-5 sm:flex-row sm:items-center sm:gap-6">
              <p className="flex-1 text-sm text-slate-500 sm:text-base">
                <span className="ml-1 font-bold text-slate-400">قبل:</span>
                {p.problem}
              </p>
              <div className="hidden h-px w-8 shrink-0 bg-[var(--jaddid-border)] sm:block" />
              <p className="flex-1 text-sm font-semibold text-[var(--jaddid-navy)] sm:text-base">
                <span className="ml-1 font-bold text-accent">مع جَدِّد:</span>
                {p.benefit}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
