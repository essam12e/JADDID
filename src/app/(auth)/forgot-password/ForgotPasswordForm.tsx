"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validations/auth";
import FormField from "@/components/auth/FormField";
import SubmitButton from "@/components/auth/SubmitButton";

export default function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordInput) {
    // Our own route, not supabase.auth.resetPasswordForEmail(): that one
    // sends Supabase's dashboard-only English template. The route mints
    // the same recovery link and sends the Arabic, branded message.
    //
    // The success state shows regardless of the outcome — and the route
    // answers identically for an unknown address — so this screen cannot
    // be used to find out which emails have accounts.
    await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    }).catch(() => null);
    setSent(true);
  }

  if (sent) {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-3 text-center text-sm text-emerald-700">
        إذا كان هذا البريد مسجّلًا لدينا، فستصلك رسالة تحتوي على رابط إعادة
        تعيين كلمة المرور خلال دقائق.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormField
        label="البريد الإلكتروني"
        type="email"
        dir="ltr"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <SubmitButton loading={isSubmitting}>إرسال رابط الاستعادة</SubmitButton>
    </form>
  );
}
