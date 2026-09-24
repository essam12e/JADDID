import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAccountUsable } from "@/lib/account";
import { getAccountOverviewCached } from "@/lib/account.server";

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

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/pricing"
          className="rounded-xl px-5 py-2.5 text-sm font-bold text-white"
          style={{ background: "var(--gradient-brand)" }}
        >
          {expired ? "شوف الباقات" : "تعرّف على الباقات"}
        </Link>
        {/* Sign-out, not "account settings": /dashboard/settings sits
            behind the same gate that sent the user here, so linking to it
            would bounce them straight back and look like a broken loop. */}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-xl border border-[var(--jaddid-border)] bg-white px-5 py-2.5 text-sm font-bold text-[var(--jaddid-navy)]"
          >
            تسجيل الخروج
          </button>
        </form>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        حدّث الصفحة بعد ما يوصلك بريد التفعيل.
      </p>
    </main>
  );
}
