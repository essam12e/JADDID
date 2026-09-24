"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signupSchema, type SignupInput } from "@/lib/validations/auth";
import { createClient } from "@/lib/supabase/client";
import FormField from "@/components/auth/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import { checkPasswordPwned, pwnedMessage } from "@/lib/security/pwned";

export default function SignupForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(values: SignupInput) {
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

    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { full_name: values.fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      // Generic message at the app layer to reduce user-enumeration signal,
      // even though the underlying Supabase error may be more specific.
      setServerError(
        "تعذّر إنشاء الحساب. تأكد من صحة البيانات أو حاول تسجيل الدخول إذا كان لديك حساب بالفعل.",
      );
      return;
    }

    router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormField
        label="الاسم"
        type="text"
        autoComplete="name"
        error={errors.fullName?.message}
        {...register("fullName")}
      />
      <FormField
        label="البريد الإلكتروني"
        type="email"
        dir="ltr"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <FormField
        label="كلمة المرور"
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

      <SubmitButton loading={isSubmitting}>إنشاء الحساب</SubmitButton>
    </form>
  );
}
