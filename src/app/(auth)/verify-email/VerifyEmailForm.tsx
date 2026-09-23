"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OtpInput from "@/components/auth/OtpInput";
import SubmitButton from "@/components/auth/SubmitButton";
import { createClient } from "@/lib/supabase/client";
import { otpSchema } from "@/lib/validations/auth";

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = otpSchema.safeParse({ email, token: code });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "رمز غير صحيح");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "signup",
    });
    setLoading(false);

    if (verifyError) {
      setError(
        "الرمز غير صحيح أو منتهي الصلاحية. تحقق منه أو اطلب رمزًا جديدًا.",
      );
      return;
    }

    router.push("/onboarding");
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError(null);
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    if (resendError) {
      setError("تعذّر إعادة إرسال الرمز الآن. حاول لاحقًا.");
      return;
    }
    setResent(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleVerify} className="space-y-4">
        <OtpInput onChange={setCode} disabled={loading} />

        {error ? (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <SubmitButton loading={loading}>تأكيد الرمز</SubmitButton>
      </form>

      <div className="text-center text-sm text-slate-500">
        {resent ? (
          <p className="mb-1 text-emerald-600">تم إرسال رمز جديد.</p>
        ) : null}
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0}
          className="font-semibold text-[var(--jaddid-blue)] disabled:text-slate-400"
        >
          {cooldown > 0 ? `إعادة الإرسال بعد ${cooldown} ثانية` : "إعادة إرسال الرمز"}
        </button>
      </div>

      <p className="rounded-lg bg-slate-50 px-3 py-2 text-center text-xs text-slate-500">
        وصلك رابط بدل الرمز؟ يمكنك الضغط عليه مباشرة من رسالة البريد لتأكيد
        حسابك.
      </p>
    </div>
  );
}
