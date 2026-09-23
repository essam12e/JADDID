import FeatureShowcase from "./FeatureShowcase";

function ProductCardMock() {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className="h-12 w-12 shrink-0 rounded-lg"
          style={{ background: "var(--gradient-brand)" }}
        />
        <div>
          <p className="font-bold text-[var(--jaddid-navy)]">Netflix Premium</p>
          <p className="text-sm text-slate-500">39 ر.س / شهريًا</p>
        </div>
      </div>
      <div className="mt-3 flex gap-4 text-xs text-slate-500">
        <span>12 عميلًا</span>
        <span className="text-amber-600">3 تنتهي قريبًا</span>
      </div>
      <div className="mt-3 flex gap-2">
        <span className="rounded-lg bg-[var(--jaddid-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--jaddid-blue)]">
          تسجيل عملية بيع
        </span>
        <span className="rounded-lg bg-[var(--jaddid-surface)] px-3 py-1.5 text-xs font-semibold text-slate-500">
          العملاء
        </span>
      </div>
    </div>
  );
}

function CustomerRowMock() {
  const rows = [
    { name: "محمد العتيبي", days: "ينتهي اليوم", tone: "text-red-600" },
    { name: "سارة القحطاني", days: "متبقي يومان", tone: "text-amber-600" },
    { name: "خالد الدوسري", days: "نشط", tone: "text-emerald-600" },
  ];
  return (
    <div className="space-y-2 rounded-xl bg-white p-4 shadow-sm">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">{r.name}</span>
          <span className={`text-xs font-semibold ${r.tone}`}>{r.days}</span>
        </div>
      ))}
    </div>
  );
}

function TemplateMock() {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-slate-400">معاينة القالب</p>
      <p className="mt-2 rounded-lg bg-emerald-50 p-3 text-sm leading-6 text-slate-700">
        مرحبًا {"{{customer_name}}"} 👋
        <br />
        اشتراكك في {"{{product_name}}"} ينتهي خلال {"{{remaining_days}}"} أيام.
        جدّد الآن: {"{{renewal_url}}"}
      </p>
    </div>
  );
}

function StatusMock() {
  const chips = [
    { label: "نشط", color: "bg-emerald-100 text-emerald-700" },
    { label: "قريب الانتهاء", color: "bg-amber-100 text-amber-700" },
    { label: "منتهٍ", color: "bg-red-100 text-red-700" },
    { label: "VIP", color: "bg-purple-100 text-purple-700" },
  ];
  return (
    <div className="flex flex-wrap gap-2 rounded-xl bg-white p-5 shadow-sm">
      {chips.map((c) => (
        <span
          key={c.label}
          className={`rounded-full px-3 py-1.5 text-xs font-bold ${c.color}`}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}

function RenewalOpportunityMock() {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold text-slate-400">فرص تجديد خلال 7 أيام</p>
      <p className="mt-1 text-3xl font-extrabold text-[var(--jaddid-navy)]">
        2,430 <span className="text-base font-medium text-slate-400">ر.س</span>
      </p>
      <p className="mt-1 text-xs text-slate-400">قيمة محتملة، وليست إيرادًا محققًا</p>
    </div>
  );
}

export function ImportSection() {
  return (
    <FeatureShowcase
      eyebrow="استيراد المنتجات"
      title="متجرك موجود؟ استورده بضغطة واحدة"
      description="جَدِّد لا يبني متجرًا بديلًا — يقرأ منتجاتك العامة من رابط متجرك الحالي ويحوّلها لبطاقات جاهزة للمتابعة."
      bullets={[
        "اسم المنتج، السعر، والصورة يُستخرجون تلقائيًا حين يكون ذلك ممكنًا",
        "إذا تعذّر الاستيراد، تقدر تضيف منتجاتك يدويًا في ثوانٍ",
        "إعادة الاستيراد لا تكرر نفس المنتج مرتين",
      ]}
      visual={<ProductCardMock />}
    />
  );
}

export function CustomersSection() {
  return (
    <FeatureShowcase
      eyebrow="تسجيل العملاء"
      title="كل عملية بيع، بعميل ومدة واضحة"
      description="سجّل من اشترى، أي منتج، وأي مدة — ويحسب جَدِّد تاريخ الانتهاء والمتبقي تلقائيًا."
      bullets={[
        "بحث وفلترة سريعة بين كل عملائك",
        "صفحة خاصة لكل عميل بكامل سجل اشتراكاته وتجديداته",
        "تمييز عملاء VIP تلقائيًا حسب عدد مرات التجديد",
      ]}
      visual={<CustomerRowMock />}
      reverse
    />
  );
}

export function SubscriptionsSection() {
  return (
    <FeatureShowcase
      eyebrow="متابعة الاشتراكات"
      title="لا تفوّت موعد تجديد بعد اليوم"
      description="قسم «يحتاج إجراء اليوم» يجمع كل من ينتهي اشتراكه أو انتهى فعلًا، في مكان واحد."
      bullets={[
        "تنبيهات عند 7 أيام، 3 أيام، 24 ساعة، ويوم الانتهاء",
        "تمييز العملاء «At Risk» ممن انتهى اشتراكهم دون تجديد",
        "تجديد بضغطة واحدة دون إعادة إدخال بيانات العميل",
      ]}
      visual={<StatusMock />}
    />
  );
}

export function TemplatesSection() {
  return (
    <FeatureShowcase
      eyebrow="قوالب واتساب ذكية"
      title="رسالة جاهزة، أنت من يضغط إرسال"
      description="جَدِّد يجهّز رسالة التذكير بمتغيرات العميل والمنتج والمدة، ويفتحها في واتساب مباشرة — بدون أتمتة كاملة تخالف سياسات واتساب."
      bullets={[
        "قوالب افتراضية جاهزة (7 أيام، 3 أيام، يوم الانتهاء، بعد الانتهاء)",
        "تعديل كامل على نص القالب ومتغيراته",
        "رابط التجديد يُستبدل تلقائيًا من بيانات المنتج",
      ]}
      visual={<TemplateMock />}
      reverse
    />
  );
}

export function RenewalOpportunitiesSection() {
  return (
    <FeatureShowcase
      eyebrow="فرص التجديد"
      title="اعرف قيمة ما هو قابل للتجديد"
      description="لوحة التحكم تحسب القيمة المحتملة للاشتراكات المقبلة على الانتهاء — بوضوح أنها فرصة، لا إيرادًا محققًا."
      bullets={[
        "تمييز واضح بين الإيراد الفعلي والقيمة المحتملة",
        "ترتيب حسب الأقرب انتهاءً",
        "تقارير شهرية للتجديدات والإيرادات",
      ]}
      visual={<RenewalOpportunityMock />}
    />
  );
}
