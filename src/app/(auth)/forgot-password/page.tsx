import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";
import ForgotPasswordForm from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="استعادة كلمة المرور"
      subtitle="أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين"
      footer={
        <Link href="/login" className="font-semibold text-[var(--jaddid-blue)]">
          العودة لتسجيل الدخول
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
