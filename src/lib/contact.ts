/**
 * Where a blocked merchant reaches a human.
 *
 * Activation is manual by design, so the waiting screen has to give the
 * user a way to actually get unblocked rather than just telling them to
 * wait. One constant so the number can't drift between screens.
 */
export const SUPPORT_WHATSAPP_E164 = "966573730430";

/** Display form, LTR-forced so RTL text around it can't reorder the digits. */
export const SUPPORT_WHATSAPP_DISPLAY = "+966 57 373 0430";

/**
 * Builds a wa.me link with the message pre-filled.
 *
 * The account name and number go in the text on purpose: it turns a
 * "please activate me" message into one that can be acted on without a
 * round trip asking who they are.
 */
export function whatsappActivationUrl(params: {
  organizationName?: string | null;
  accountNumber?: number | string | null;
}): string {
  const lines = ["السلام عليكم، أبغى أفعّل حسابي في جَدِّد."];
  if (params.organizationName) lines.push(`اسم الحساب: ${params.organizationName}`);
  if (params.accountNumber != null) lines.push(`رقم الحساب: ${params.accountNumber}`);

  return `https://wa.me/${SUPPORT_WHATSAPP_E164}?text=${encodeURIComponent(lines.join("\n"))}`;
}
