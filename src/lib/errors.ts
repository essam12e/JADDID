/**
 * Maps the machine-readable codes the database raises onto Arabic the
 * user can act on.
 *
 * The RPCs deliberately raise `JADDID_*` instead of a human sentence:
 * a raw Postgres message is the wrong thing to put on screen (it leaks
 * schema detail, and the spec forbids it), but "something went wrong" is
 * useless when the real cause is a plan limit the merchant can fix by
 * archiving a customer or upgrading.
 */
const MESSAGES: Record<string, string> = {
  JADDID_AUTH_REQUIRED: "انتهت جلستك. سجّل الدخول من جديد.",
  JADDID_ORG_NOT_FOUND: "ما لقينا حسابك. حدّث الصفحة أو تواصل معنا.",
  JADDID_NOT_ACTIVATED:
    "حسابك لسه تحت المراجعة. ما تقدر تسجّل عمليات قبل ما تتم الموافقة عليه.",
  JADDID_SUBSCRIPTION_EXPIRED:
    "انتهى اشتراكك. جدّد باقتك عشان تكمل استخدام جَدِّد.",
  JADDID_LIMIT_STORES: "وصلت للحد الأقصى من المتاجر في باقتك ({limit}). ترقّى لباقة أعلى عشان تضيف متجر جديد.",
  JADDID_LIMIT_USERS: "وصلت للحد الأقصى من المستخدمين في باقتك ({limit}). ترقّى لباقة أعلى عشان تضيف عضو جديد.",
  JADDID_ADMIN_REQUIRED: "هذا الإجراء متاح لإدارة المنصّة فقط.",
  JADDID_REQUEST_NOT_FOUND: "ما لقينا هذا الطلب. حدّث الصفحة.",
  // Almost always a double-click on the approve button: the first click
  // already succeeded, so this must not read like a failure.
  JADDID_ALREADY_REVIEWED: "هذا الطلب تمت مراجعته من قبل — حدّث الصفحة عشان تشوف حالته.",
  JADDID_LIMIT_CUSTOMERS:
    "وصلت للحد الأقصى من العملاء النشطين في باقتك ({limit}). أرشف عميلًا منتهيًا أو ترقّى لباقة أعلى.",
};

export const FALLBACK_ERROR = "صار خطأ غير متوقع. حاول مرة ثانية.";

/**
 * Codes may arrive bare (`JADDID_NOT_ACTIVATED`) or with a value the
 * message interpolates (`JADDID_LIMIT_STORES:3`). Postgres also wraps the
 * text in its own prose depending on the driver, so match on inclusion
 * rather than equality.
 */
export function translateDbError(raw: unknown): string {
  const text = typeof raw === "string" ? raw : (raw as { message?: string } | null)?.message ?? "";
  if (!text) return FALLBACK_ERROR;

  for (const [code, message] of Object.entries(MESSAGES)) {
    if (!text.includes(code)) continue;
    const limit = text.match(new RegExp(`${code}:(\\d+)`))?.[1];
    return message.replace("{limit}", limit ?? "—");
  }

  return FALLBACK_ERROR;
}

/** True when the error means the account itself is blocked, not the action. */
export function isAccountBlockedError(raw: unknown): boolean {
  const text = typeof raw === "string" ? raw : (raw as { message?: string } | null)?.message ?? "";
  return text.includes("JADDID_NOT_ACTIVATED") || text.includes("JADDID_SUBSCRIPTION_EXPIRED");
}
