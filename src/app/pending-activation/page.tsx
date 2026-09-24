import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAccountUsable } from "@/lib/account";
import { getAccountOverviewCached } from "@/lib/account.server";
import { whatsappActivationUrl, SUPPORT_WHATSAPP_DISPLAY } from "@/lib/contact";

export const metadata = { title: "حسابك تحت المراجعة — جَدِّد" };

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/**
 * The waiting room. Spec point 5: an account does nothing until a
 * platform admin approves it — so rather than letting a pending merchant
 * roam an empty dashboard and hit a raw error on their first action, the
 * layout sends them here and tells them exactly where they stand.
 */
export default async function PendingActivationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const account = await getAccountOverviewCached();
  if (!account.hasOrganization) redirect("/onboarding");
  // Nothing to wait for — don't strand an active account on this screen.
  if (isAccountUsable(account)) redirect("/dashboard");

  const expired = account.isExpired === true;
  const rejected = account.status === "rejected";
  const suspended = account.status === "suspended";

  const title = expired
    ? "انتهى اشتراكك"
    : rejected
      ? "ما قدرنا نفعّل حسابك"
      : suspended
        ? "حسابك موقوف مؤقتًا"
        : "حسابك تحت المراجعة";

  const body = expired
    ? "باقتك انتهت، وعشان كذا العمليات متوقفة مؤقتًا. تواصل معنا وبنجدّد لك الاشتراك على طول."
    : rejected
      ? "راجعنا طلبك وما قدرنا نفعّله في الوقت الحالي. تواصل معنا وبنوضّح لك السبب ونساعدك تعيد التقديم."
      : suspended
        ? "حسابك موقوف حاليًا. تواصل معنا عشان نوضّح لك التفاصيل."
        : "استلمنا طلبك وهو تحت المراجعة من فريقنا. أول ما تتم الموافقة بيوصلك بريد وتقدر تبدأ على طول.";

  const rows: { label: string; value: string }[] = [];
  if (account.organizationName) rows.push({ label: "اسم الحساب", value: account.organizationName });
  if (account.accountNumber != null) rows.push({ label: "رقم الحساب", value: String(account.accountNumber) });
  if (account.planName) rows.push({ label: "الباقة", value: account.planName });
  const started = formatDate(account.startedAt);
  if (started) rows.push({ label: "بدأ الاشتراك", value: started });
  const expires = formatDate(account.expiresAt);
  if (expires) rows.push({ label: expired ? "انتهى في" : "ينتهي في", value: expires });

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <Image
        src="/brand/jaddid-logo-256.png"
        alt="جَدِّد"
        width={64}
        height={64}
        className="mb-5 h-16 w-16 rounded-2xl"
        priority
      />

      <div
        className="mb-5 rounded-full px-4 py-1.5 text-xs font-bold"
        style={{
          background: expired || rejected ? "#fef2f2" : "#fffbeb",
          color: expired || rejected ? "#b91c1c" : "#b45309",
        }}
      >
        {expired ? "اشتراك منتهي" : rejected ? "طلب مرفوض" : suspended ? "موقوف" : "قيد المراجعة"}
      </div>

      <h1 className="text-2xl font-extrabold text-[var(--jaddid-navy)]">{title}</h1>
      <p className="mt-3 text-sm leading-8 text-slate-600">{body}</p>

      {rows.length > 0 ? (
        <dl className="mt-7 w-full rounded-2xl border border-[var(--jaddid-border)] bg-white p-5 text-right">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-4 border-b border-[var(--jaddid-border)] py-2.5 last:border-0 last:pb-0 first:pt-0"
            >
              <dt className="text-sm text-slate-500">{row.label}</dt>
              <dd className="text-sm font-bold text-[var(--jaddid-navy)]">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {/* Activation is a manual, human step, so the only button that
          helps someone stuck here is one that reaches a human. Links
          straight into WhatsApp with the account name and number already
          in the message. */}
      <a
        href={whatsappActivationUrl({
          organizationName: account.organizationName,
          accountNumber: account.accountNumber,
        })}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-7 inline-flex w-full items-center justify-center gap-2.5 rounded-xl px-6 py-3.5 text-sm font-bold text-white sm:w-auto"
        style={{ background: "#25D366" }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 0 1 6.988 2.896 9.82 9.82 0 0 1 2.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885m8.413-18.297A11.82 11.82 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.88 11.88 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.82 11.82 0 0 0 20.464 3.488" />
        </svg>
        التواصل مع المطوّر لتفعيل الحساب
      </a>

      <p className="mt-3 text-xs text-slate-500" dir="ltr">
        {SUPPORT_WHATSAPP_DISPLAY}
      </p>

      <p className="mt-6 text-xs text-slate-400">
        حدّث الصفحة بعد ما يوصلك بريد التفعيل.
      </p>

      {/* Kept as fine print, not a button: the contact action owns the
          screen now, but a signed-in user with no way out cannot switch
          accounts or recover from signing in as the wrong one. */}
      <form action="/auth/signout" method="post" className="mt-2">
        <button type="submit" className="text-xs text-slate-400 underline underline-offset-2">
          تسجيل الخروج
        </button>
      </form>
    </main>
  );
}
