import Link from "next/link";

/**
 * Friendly "you've hit a plan limit" UX.
 *
 * The limits this talks about are now real and enforced in the database
 * (Phase 15): `private.enforce_store_limit` / `enforce_user_limit`
 * triggers, and an active-customer check inside `register_sale`. They
 * raise `JADDID_LIMIT_*` codes, which `translateDbError` turns into the
 * Arabic sentence a form shows inline.
 *
 * Use this component where a whole screen can offer the upgrade path
 * (rather than a single field's error line), e.g. an empty state or a
 * blocked action page.
 *
 * Usage:
 *   <UpgradePrompt
 *     limitLabel="عدد العملاء النشطين"
 *     currentPlanName="جَدِّد — البداية"
 *     suggestion="باقة Pro تدعم حتى 500 عميل نشط و3 متاجر."
 *   />
 */
export default function UpgradePrompt({
  limitLabel,
  currentPlanName,
  suggestion,
}: {
  limitLabel: string;
  currentPlanName?: string;
  suggestion?: string;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600"
          aria-hidden="true"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.6">
            <path d="M10 6.5v4M10 13.2h.01" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="10" cy="10" r="7.5" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-bold">
            وصلت للحد الأقصى من {limitLabel}
            {currentPlanName ? ` في باقة ${currentPlanName}` : ""}.
          </p>
          {suggestion ? (
            <p className="mt-1 text-sm leading-6 text-amber-800">{suggestion}</p>
          ) : null}
        </div>
      </div>
      {/* No billing/upgrade page exists yet, so this points at the real,
          working pricing page rather than a route that doesn't exist.
          Repoint to a dedicated billing flow once one is built. */}
      <Link
        href="/pricing"
        className="shrink-0 rounded-xl bg-amber-600 px-5 py-2.5 text-center text-sm font-bold text-white transition-colors hover:bg-amber-700 sm:self-center"
      >
        ترقية الباقة
      </Link>
    </div>
  );
}
