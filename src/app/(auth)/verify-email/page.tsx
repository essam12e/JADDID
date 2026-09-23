import AuthCard from "@/components/auth/AuthCard";
import VerifyEmailForm from "./VerifyEmailForm";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email = "" } = await searchParams;

  return (
    <AuthCard
      title="تأكيد البريد الإلكتروني"
      subtitle={
        email
          ? `أرسلنا رسالة إلى ${email} تحتوي على رابط أو رمز تأكيد`
          : "تحقق من بريدك الإلكتروني"
      }
    >
      <VerifyEmailForm email={email} />
    </AuthCard>
  );
}
