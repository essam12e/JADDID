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

/**
 * Pre-filled message for changing plans.
 *
 * Billing is handled by a human, so the "upgrade" button has to hand the
 * merchant a message that already names which plan they picked — asking
 * them to retype it is how a request turns into three messages.
 */
export function whatsappPlanChangeUrl(params: {
  planName: string;
  organizationName?: string | null;
  accountNumber?: number | string | null;
  currentPlanName?: string | null;
}): string {
  const lines = [`السلام عليكم، أبغى أشترك في باقة «${params.planName}» في جَدِّد.`];
  if (params.currentPlanName) lines.push(`باقتي الحالية: ${params.currentPlanName}`);
  if (params.organizationName) lines.push(`اسم الحساب: ${params.organizationName}`);
  if (params.accountNumber != null) lines.push(`رقم الحساب: ${params.accountNumber}`);

  return `https://wa.me/${SUPPORT_WHATSAPP_E164}?text=${encodeURIComponent(lines.join("\n"))}`;
}
