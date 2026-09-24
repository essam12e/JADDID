"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/validations/auth";
import { createClient } from "@/lib/supabase/client";
import FormField from "@/components/auth/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import { checkPasswordPwned, pwnedMessage } from "@/lib/security/pwned";

export default function SecurityForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });

  async function onSubmit(values: ResetPasswordInput) {
    setServerError(null);
    setSuccess(false);

    // Same breach check as signup and reset: a password change is the
    // other moment a leaked password can enter the system.
    const breach = pwnedMessage(await checkPasswordPwned(values.password));
    if (breach) {
      setServerError(breach);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: values.password });

    if (error) {
      setServerError("تعذّر تحديث كلمة المرور.");
      return;
    }
    // Security notice, sent from the server using this session's own
    // address. Fire-and-forget: the password change already succeeded.
    void fetch("/api/email/password-changed", { method: "POST", keepalive: true }).catch(() => {});
    setSuccess(true);
    reset();
  }

  return (
    <div className="max-w-md space-y-6">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-4 rounded-2xl border border-[var(--jaddid-border)] bg-white p-5"
        noValidate
      >
        <p className="text-sm font-bold text-[var(--jaddid-navy)]">تغيير كلمة المرور</p>
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
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
        ) : null}
        {success ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            تم تحديث كلمة المرور.
          </p>
        ) : null}

        <SubmitButton loading={isSubmitting}>تحديث كلمة المرور</SubmitButton>
      </form>

      <div className="rounded-2xl border border-[var(--jaddid-border)] bg-white p-5">
        <p className="mb-3 text-sm font-bold text-[var(--jaddid-navy)]">الجلسة</p>
        <form action="/auth/signout" method="post">
          <button className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100">
            تسجيل الخروج
          </button>
        </form>
      </div>
    </div>
  );
}
