/**
 * WhatsApp reminders (spec: pre-filled links, never the WhatsApp Business
 * API). Everything here is pure string manipulation -- there is no
 * network call, no automation, and no message is ever sent without a
 * human clicking the resulting link and pressing send themselves inside
 * WhatsApp. That's a deliberate constraint, not a shortcut: sending on
 * the merchant's behalf would need the WhatsApp Business API (paid,
 * requires approval) and could look like spam to recipients if
 * automated.
 */

export const TEMPLATE_VARIABLES = [
  {
    token: "{{customer_name}}",
    label: "اسم العميل",
    description: "اسم العميل",
    sample: "محمد العتيبي",
  },
  {
    token: "{{product_name}}",
    label: "اسم المنتج",
    description: "اسم المنتج أو الخدمة المشترك فيها",
    sample: "اشتراك نتفلكس",
  },
  {
    token: "{{remaining_days}}",
    label: "الأيام المتبقية",
    description: "عدد الأيام المتبقية (قد يكون سالبًا إن كان الاشتراك منتهيًا)",
    sample: "3",
  },
  {
    token: "{{end_date}}",
    label: "تاريخ الانتهاء",
    description: "تاريخ انتهاء الاشتراك",
    sample: "25 أكتوبر 2026",
  },
  {
    token: "{{renewal_url}}",
    label: "رابط التجديد",
    description: "رابط التجديد الخاص بالمنتج (إن وُجد)",
    sample: "https://your-store.com/renew",
  },
  {
    token: "{{store_name}}",
    label: "اسم متجرك",
    description: "اسم متجرك كما يظهر للعميل",
    sample: "متجر النور",
  },
] as const;

export interface TemplateVariables {
  customer_name: string;
  product_name: string;
  remaining_days: number;
  end_date: string;
  renewal_url: string;
  store_name: string;
}

/** Replaces every {{token}} in a template body with its value. Unknown tokens are left as-is rather than silently dropped, so a typo in a template is visible instead of hidden. */
export function renderTemplate(body: string, vars: TemplateVariables): string {
  return body.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (key in vars) {
      const value = vars[key as keyof TemplateVariables];
      return String(value);
    }
    return match;
  });
}

/**
 * Normalizes a phone number for wa.me: digits only, no leading zero
 * (assumes a Saudi local number starting with 0 unless it already has a
 * country code), no plus sign (wa.me requires digits only).
 */
export function normalizePhoneForWhatsApp(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `966${digits.slice(1)}`;
  if (!digits.startsWith("966") && digits.length === 9) digits = `966${digits}`;
  return digits;
}

/** Builds a wa.me link that opens WhatsApp with the message pre-filled, ready for a human to review and press send -- never sent automatically. */
export function buildWhatsAppLink(phone: string, message: string): string {
  const normalized = normalizePhoneForWhatsApp(phone);
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}
