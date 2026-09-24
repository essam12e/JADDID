import { Suspense } from "react";
import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;

  return (
    <AuthCard
      title="تسجيل الدخول"
      subtitle="مرحبًا بعودتك إلى جَدِّد"
      footer={
        <>
          ليس لديك حساب؟{" "}
          <Link href="/signup" className="font-semibold text-[var(--jaddid-blue)]">
            أنشئ حسابًا
          </Link>
        </>
      }
    >
      {/* Sent here by /auth/callback when a confirmation link could not be
          exchanged — almost always because it was already opened once, or
          opened on a different device from the one that signed up. The
          account itself is fine, so the message says so. */}
      {notice === "link_unusable" ? (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2.5 text-center text-xs leading-6 text-amber-900">
          رابط التأكيد ما عاد صالحًا — غالبًا لأنه انفتح مرة قبل، أو فُتح من
          متصفح غير اللي سجّلت منه. حسابك على الأغلب مفعّل، سجّل دخولك عادي.
        </p>
      ) : null}

      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
