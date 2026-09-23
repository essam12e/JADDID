import AuthCard from "@/components/auth/AuthCard";
import ResetPasswordForm from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="تعيين كلمة مرور جديدة"
      subtitle="اختر كلمة مرور قوية لحسابك"
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
