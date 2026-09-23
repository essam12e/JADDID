import Link from "next/link";
import AuthCard from "@/components/auth/AuthCard";
import SignupForm from "./SignupForm";

export default function SignupPage() {
  return (
    <AuthCard
      title="أنشئ حسابك في جَدِّد"
      subtitle="ابدأ بمتابعة اشتراكات عملائك في دقائق"
      footer={
        <>
          لديك حساب بالفعل؟{" "}
          <Link href="/login" className="font-semibold text-[var(--jaddid-blue)]">
            سجّل الدخول
          </Link>
        </>
      }
    >
      <SignupForm />
    </AuthCard>
  );
}
