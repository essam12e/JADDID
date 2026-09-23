import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Placeholder — the full multi-step onboarding wizard (store name, URL,
 * import, review) is Phase 4. This confirms the account exists and is
 * authenticated, and does not fabricate a wizard that isn't built yet.
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col items-center px-6 py-16 text-center">
      <h1 className="text-2xl font-bold text-[var(--jaddid-navy)]">
        مرحبًا بك في جَدِّد
      </h1>
      <p className="mt-3 text-sm text-slate-500">
        تم تأكيد حسابك بنجاح. خطوات الإعداد الكاملة (اسم المتجر، الرابط،
        استيراد المنتجات) قادمة في المرحلة التالية من البناء — هذه ليست
        الشاشة النهائية.
      </p>
      <a
        href="/dashboard"
        className="mt-6 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
        style={{ background: "var(--gradient-brand)" }}
      >
        الذهاب إلى لوحة التحكم
      </a>
    </main>
  );
}
