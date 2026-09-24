"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validations/auth";
import { createClient } from "@/lib/supabase/client";
import FormField from "@/components/auth/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import { checkPasswordPwned, pwnedMessage } from "@/lib/security/pwned";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(
    null,
  );
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setHasRecoverySession(!!data.session);
    });
  }, []);

  async function onSubmit(values: ResetPasswordInput) {
    setServerError(null);
    // Refuse passwords that already appear in public breach corpora.
    // Runs before the network call so a known-leaked password is never
    // even sent to Supabase; fails open if HIBP is unreachable.
    const breach = pwnedMessage(await checkPasswordPwned(values.password));
    if (breach) {
      setServerError(breach);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });

    if (error) {
      setServerError("تعذّر تحديث كلمة المرور. قد يكون الرابط منتهي الصلاحية.");
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/login"), 1500);
  }

  if (hasRecoverySession === false) {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-3 text-center text-sm text-amber-700">
        هذا الرابط منتهي الصلاحية أو غير صحيح. يرجى طلب رابط استعادة جديد.
      </p>
    );
  }

  if (success) {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-3 text-center text-sm text-emerald-700">
        تم تحديث كلمة المرور بنجاح. جاري تحويلك لتسجيل الدخول...
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormField
        label="كلمة المرور الجديدة"
        type="password"
        dir="ltr"
        autoComplete="new-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <FormField
        label="تأكيد كلمة المرور"
        type="password"
        dir="ltr"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />

      {serverError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </p>
      ) : null}

      <SubmitButton loading={isSubmitting || hasRecoverySession === null}>
        تحديث كلمة المرور
      </SubmitButton>
    </form>
  );
}
