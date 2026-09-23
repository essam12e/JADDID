import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

const stats = [
  { label: "عملاء نشطون", value: "184" },
  { label: "اشتراكات نشطة", value: "231" },
  { label: "تنتهي خلال 7 أيام", value: "12" },
  { label: "فرص تجديد", value: "2,430 ر.س" },
];

export default function DashboardPreview() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <Reveal>
        <SectionHeading
          eyebrow="لوحة التحكم"
          title="كل شيء يهمك، في شاشة واحدة"
          subtitle="أرقام توضيحية لغرض العرض فقط — لوحتك الحقيقية تُبنى من بيانات متجرك."
        />
      </Reveal>
      <Reveal delay={0.1}>
        <div className="mt-10 rounded-2xl border border-[var(--jaddid-border)] bg-white p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl bg-[var(--jaddid-surface)] p-4 text-center"
              >
                <p className="text-2xl font-extrabold text-[var(--jaddid-navy)]">
                  {s.value}
                </p>
                <p className="mt-1 text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-dashed border-[var(--jaddid-border)] p-4">
            <p className="mb-2 text-xs font-bold text-slate-500">
              يحتاج إجراء اليوم
            </p>
            <ul className="space-y-1.5 text-sm text-slate-700">
              <li>محمد — Netflix — ينتهي اليوم</li>
              <li>خالد — Canva — متبقي يومان</li>
              <li>سالم — Shahid — انتهى منذ 7 أيام (At Risk)</li>
            </ul>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
