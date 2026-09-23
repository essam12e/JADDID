import Reveal from "./Reveal";

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
    problem: "بيانات عملائك متناثرة بين جداول وملاحظات",
    benefit: "قاعدة بيانات واحدة لكل عميل ومنتج واشتراك",
  },
];

export default function ProblemSection() {
  return (
    <section
      className="section-edge-top relative overflow-hidden bg-white px-6 pb-20 pt-16 sm:pt-20"
    >
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-2 text-sm font-bold text-accent">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--jaddid-blue)]" />
              لماذا جَدِّد
            </span>
            <h2 className="text-h2 mt-2 text-[var(--jaddid-navy)]">
              مشاكل حقيقية، لا كلام تسويقي
            </h2>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {PAIRS.map((p, i) => (
            <Reveal key={p.problem} delay={(i % 2) * 0.08}>
              <div className="flex h-full flex-col gap-3 rounded-2xl border border-[var(--jaddid-border)] bg-[var(--jaddid-surface)] p-5">
                <p className="text-sm text-slate-500">
                  <span className="font-bold text-slate-400">قبل: </span>
                  {p.problem}
                </p>
                <div className="h-px w-full bg-[var(--jaddid-border)]" />
                <p className="text-sm font-semibold text-[var(--jaddid-navy)]">
                  <span className="font-bold text-accent">مع جَدِّد: </span>
                  {p.benefit}
                </p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.15}>
          <p className="mx-auto mt-14 max-w-3xl text-center text-[clamp(1.5rem,1.2rem+1.4vw,2.25rem)] font-extrabold leading-snug text-[var(--jaddid-navy)]">
            كل هذا يتحول من فوضى يومية إلى{" "}
            <span className="text-accent">نظام واحد تثق فيه.</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
