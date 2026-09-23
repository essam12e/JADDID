import { Suspense } from "react";
import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";
import LoginForm from "./LoginForm";

export default function LoginPage() {
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
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthCard>
  );
}
