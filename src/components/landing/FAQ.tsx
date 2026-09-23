import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";

const faqs = [
  {
    q: "هل جَدِّد يستبدل متجري الحالي؟",
    a: "لا. جَدِّد يعمل بجانب متجرك، ولا يعيد بناءه أو يستبدله — فقط يستورد منتجاتك ليساعدك على متابعة اشتراكات عملائها.",
  },
  {
    q: "هل الرسائل تُرسل تلقائيًا عبر واتساب؟",
    a: "لا. جَدِّد يجهّز الرسالة كاملة بمتغيرات العميل، ثم يفتحها في واتساب — أنت من يضغط إرسال. هذا يحافظ على سياسات واتساب ولا يخالفها.",
  },
  {
    q: "ماذا لو تعذّر استيراد منتجات متجري تلقائيًا؟",
    a: "بعض المتاجر لا تسمح بالقراءة العامة لمنتجاتها. في هذه الحالة نعرض لك السبب بوضوح، ويمكنك دائمًا إضافة منتجاتك يدويًا.",
  },
  {
    q: "هل بياناتي معزولة عن بقية المستخدمين؟",
    a: "نعم. كل حساب معزول بالكامل على مستوى قاعدة البيانات (وليس فقط في الواجهة) — لا يمكن لأي مستخدم آخر رؤية عملائك أو منتجاتك أو اشتراكاتك.",
  },
];

export default function FAQ() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <Reveal>
        <SectionHeading eyebrow="الأسئلة الشائعة" title="لديك سؤال؟" />
      </Reveal>
      <div className="mt-10 space-y-3">
        {faqs.map((f) => (
          <Reveal key={f.q}>
            <details className="group rounded-xl border border-[var(--jaddid-border)] bg-white p-4 open:shadow-sm">
              <summary className="cursor-pointer list-none text-sm font-bold text-[var(--jaddid-navy)] marker:content-none">
                <span className="flex items-center justify-between gap-3">
                  {f.q}
                  <span className="shrink-0 text-slate-400 transition-transform group-open:rotate-45">
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-6 text-slate-600">{f.a}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
