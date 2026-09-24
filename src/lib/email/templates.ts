import { renderLayout, renderText, siteUrl, type LayoutInput } from "./layout";

export type RenderedEmail = { subject: string; html: string; text: string };

function build(subject: string, input: LayoutInput): RenderedEmail {
  return { subject, html: renderLayout(input), text: renderText(input) };
}

/**
 * Arabic month name + Latin digits ("15 أكتوبر 2026").
 *
 * Deliberately not the app's `toLocaleDateString("ar-SA")` (which renders
 * Arabic-Indic digits): several mail clients — Outlook desktop above all —
 * fall back to a font that renders Arabic-Indic digits inconsistently
 * inside an RTL table cell. Latin digits stay unambiguous everywhere, and
 * an expiry date is the one thing in these emails that must not be
 * misread. The calendar is pinned to `gregory` so a future ICU/locale
 * default can never silently flip an expiry date to Hijri.
 */
export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Riyadh",
  }).format(date);
}

export function formatMoney(amount: number, currency = "SAR"): string {
  const n = Number(amount);
  const pretty = Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0";
  return currency === "SAR" ? `${pretty} ر.س` : `${pretty} ${currency}`;
}

/** Arabic counts read badly with a bare number ("1 اشتراكات"). */
function pluralAr(count: number, one: string, two: string, few: string, many: string): string {
  if (count === 1) return one;
  if (count === 2) return two;
  if (count >= 3 && count <= 10) return `${count} ${few}`;
  return `${count} ${many}`;
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Welcome — right after the merchant finishes onboarding.
// ─────────────────────────────────────────────────────────────────────────
export function welcomeEmail(params: { name?: string; storeName: string }): RenderedEmail {
  const who = params.name?.trim() ? ` يا ${params.name.trim()}` : "";
  return build("حيّاك الله في جَدِّد 👋", {
    preheader: `متجر ${params.storeName} جاهز — يلا نبدأ.`,
    heading: `هلا وغلا فيك${who}`,
    paragraphs: [
      `تم إنشاء متجر «${params.storeName}» بنجاح، ومن الحين وطالع ما عاد عليك هم متابعة تواريخ الاشتراكات.`,
      "جَدِّد بيراقب لك كل اشتراك لعملائك، ويبلّغك قبل لا ينتهي بوقت كافي عشان تجدّده وما يروح عليك العميل.",
      "أول خطوة: ضيف منتجاتك، وبعدها سجّل عملاءك — وخلّ الباقي علينا.",
    ],
    button: { label: "ادخل على لوحة التحكم", url: `${siteUrl()}/dashboard` },
    outro: ["لو واجهتك أي مشكلة أو عندك استفسار، رد علينا وبنساعدك على طول."],
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 2. Activation request received.
// ─────────────────────────────────────────────────────────────────────────
export function activationSubmittedEmail(params: {
  orgName: string;
  accountNumber?: number | string | null;
}): RenderedEmail {
  const info = [{ label: "اسم الحساب", value: params.orgName }];
  if (params.accountNumber != null) {
    info.push({ label: "رقم الحساب", value: String(params.accountNumber) });
  }
  return build("طلب تفعيل حسابك وصلنا ✅", {
    preheader: "طلبك تحت المراجعة، وبنبلّغك أول ما يخلص.",
    heading: "أبشر، طلبك وصلنا",
    paragraphs: [
      "استلمنا طلب تفعيل حسابك وهو الحين تحت المراجعة من فريقنا.",
      "ما يحتاج تسوي شي من طرفك — بس انتظر، وأول ما نخلّص المراجعة بيوصلك إشعار على طول.",
    ],
    info,
    outro: ["تقدر تتابع حالة الطلب من لوحة التحكم في أي وقت."],
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 3. Activation approved.
// ─────────────────────────────────────────────────────────────────────────
export function activationApprovedEmail(params: {
  orgName: string;
  planName?: string | null;
}): RenderedEmail {
  const info = [{ label: "الحساب", value: params.orgName }];
  if (params.planName) info.push({ label: "الباقة", value: params.planName });

  return build("مبروك! حسابك صار فعّال 🎉", {
    preheader: `حساب ${params.orgName} تم تفعيله — كل المزايا متاحة لك الحين.`,
    heading: "مبروك، حسابك اشتغل",
    paragraphs: [
      `تم تفعيل حساب «${params.orgName}» بنجاح، وكل مزايا باقتك صارت متاحة لك من هاللحظة.`,
      "تقدر تبدأ على طول: ضيف منتجاتك، سجّل عملاءك، وجَدِّد بيذكّرك بكل تجديد قبل موعده.",
    ],
    info,
    button: { label: "ابدأ الحين", url: `${siteUrl()}/dashboard` },
    outro: ["شكرًا لثقتك فينا — وإذا احتجت أي شي إحنا موجودين."],
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 4. Activation rejected.
// ─────────────────────────────────────────────────────────────────────────
export function activationRejectedEmail(params: {
  orgName: string;
  note?: string | null;
}): RenderedEmail {
  const paragraphs = [
    `للأسف ما قدرنا نفعّل حساب «${params.orgName}» في الوقت الحالي.`,
  ];
  if (params.note?.trim()) {
    paragraphs.push("سبب الرفض موضّح لك بالأسفل عشان تقدر تعالجه وتعيد التقديم.");
  } else {
    paragraphs.push("تواصل معنا وبنوضّح لك السبب بالتفصيل، ونساعدك تعدّل الطلب وتعيد تقديمه.");
  }

  return build("بخصوص طلب تفعيل حسابك", {
    preheader: `ما قدرنا نفعّل حساب ${params.orgName} الحين.`,
    heading: "ما قدرنا نكمّل التفعيل",
    paragraphs,
    info: params.note?.trim() ? [{ label: "الملاحظة", value: params.note.trim() }] : undefined,
    outro: ["ردّك على هذي الرسالة يوصلنا، ويسعدنا نساعدك."],
  });
}

// ─────────────────────────────────────────────────────────────────────────
// 5. Renewal digest — the core product email.
//
// Goes to the MERCHANT, never to their end customers: those customers
// never consented to email from JADDID, and the product's own customer-
// facing channel is the WhatsApp templates the merchant sends by hand.
// ─────────────────────────────────────────────────────────────────────────
export type ExpiringItem = {
  customerName: string;
  productName: string;
  endDate: string;
  daysLeft: number;
};

export function renewalDigestEmail(params: {
  storeName: string;
  items: ExpiringItem[];
}): RenderedEmail {
  const count = params.items.length;
  const countPhrase = pluralAr(count, "اشتراك واحد", "اشتراكين", "اشتراكات", "اشتراك");
  const expired = params.items.filter((i) => i.daysLeft < 0).length;

  const info = params.items.slice(0, 12).map((item) => ({
    label: `${item.customerName} — ${item.productName}`,
    value:
      item.daysLeft < 0
        ? `منتهي من ${Math.abs(item.daysLeft)} يوم`
        : item.daysLeft === 0
          ? `ينتهي اليوم — ${formatDate(item.endDate)}`
          : `باقي ${item.daysLeft} يوم — ${formatDate(item.endDate)}`,
  }));

  const paragraphs = [
    `عندك ${countPhrase} في متجر «${params.storeName}» محتاج تتابعه.`,
  ];
  if (expired > 0) {
    paragraphs.push(
      `منها ${pluralAr(expired, "واحد منتهي", "اثنين منتهية", "منتهية", "منتهي")} — يا ليت تتواصل مع أصحابها قبل لا يروحون لغيرك.`,
    );
  }
  paragraphs.push("كل اللي عليك تفتح اللوحة وترسل لهم رسالة التجديد بضغطة وحدة.");

  const outro: string[] = [];
  if (count > 12) outro.push(`وفيه ${count - 12} غيرهم في اللوحة.`);
  outro.push("هذي الرسالة تجيك يوميًا بس لما يكون فيه اشتراكات قربت تنتهي.");

  return build(
    expired > 0 ? `⚠️ عندك اشتراكات منتهية في ${params.storeName}` : `تذكير: ${countPhrase} قرب ينتهي`,
    {
      preheader: `${countPhrase} في متجر ${params.storeName} يبي له متابعة.`,
      heading: "اشتراكات تبي متابعة",
      paragraphs,
      info,
      button: { label: "افتح قائمة التجديدات", url: `${siteUrl()}/dashboard/renewals` },
      outro,
    },
  );
}

// ─────────────────────────────────────────────────────────────────────────
// 6. Security notice — password changed.
// ─────────────────────────────────────────────────────────────────────────
export function passwordChangedEmail(params: { name?: string | null }): RenderedEmail {
  const who = params.name?.trim() ? ` يا ${params.name.trim()}` : "";
  return build("تم تغيير كلمة مرور حسابك", {
    preheader: "لو ما كنت أنت، تواصل معنا فورًا.",
    heading: `تنبيه أمني${who}`,
    paragraphs: [
      "تم تغيير كلمة مرور حسابك في جَدِّد قبل شوي.",
      "إذا أنت اللي غيّرتها، ما عليك شي وتجاهل هذي الرسالة.",
      "أما إذا ما كنت أنت، تواصل معنا على طول عشان نأمّن حسابك.",
    ],
    info: [{ label: "وقت التغيير", value: formatDate(new Date()) }],
    outro: ["ما نطلب منك كلمة المرور أبدًا في أي رسالة — لا ترسلها لأحد."],
  });
}

export const TEMPLATES = {
  welcome: welcomeEmail,
  activation_submitted: activationSubmittedEmail,
  activation_approved: activationApprovedEmail,
  activation_rejected: activationRejectedEmail,
  renewal_digest: renewalDigestEmail,
  password_changed: passwordChangedEmail,
} as const;

export type TemplateName = keyof typeof TEMPLATES;
