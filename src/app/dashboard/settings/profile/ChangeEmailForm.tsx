"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { changeEmailSchema, type ChangeEmailInput } from "@/lib/validations/settings";
import FormField from "@/components/auth/FormField";
import SubmitButton from "@/components/auth/SubmitButton";

/**
 * Changing the sign-in address.
 *
 * Goes through our own API rather than `supabase.auth.updateUser`, so
 * the confirmation arrives as JADDID's Arabic message with the logo
 * instead of Supabase's English template.
 */
export default function ChangeEmailForm({ currentEmail }: { currentEmail: string }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangeEmailInput>({ resolver: zodResolver(changeEmailSchema) });

  async function onSubmit(values: ChangeEmailInput) {
    setServerError(null);
    setSentTo(null);

    try {
      const response = await fetch("/api/auth/change-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setServerError(data.error ?? "تعذّر بدء تغيير البريد.");
        return;
      }

      setSentTo(values.newEmail.trim().toLowerCase());
      reset({ newEmail: "" });
    } catch {
      setServerError("تعذّر الاتصال. تأكد من الإنترنت وحاول مرة ثانية.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-md space-y-4 rounded-2xl border border-[var(--jaddid-border)] bg-white p-5"
      noValidate
    >
      <div>
        <h2 className="text-sm font-bold text-[var(--jaddid-navy)]">تغيير البريد الإلكتروني</h2>
        <p className="mt-1 text-xs text-slate-500">
          بريدك الحالي <span dir="ltr">{currentEmail}</span>. ما يتغيّر شي إلا بعد ما تأكد من
          العنوان الجديد.
        </p>
      </div>

      <FormField
        label="البريد الإلكتروني الجديد"
        inputMode="email"
        dir="ltr"
        autoComplete="email"
        placeholder="new@example.com"
        error={errors.newEmail?.message}
        {...register("newEmail")}
      />

      {serverError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
      ) : null}

      {sentTo ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm leading-6 text-emerald-700">
          أرسلنا رابط التأكيد إلى <span dir="ltr">{sentTo}</span>. افتحه من نفس المتصفح هذا.
          وأرسلنا إشعارًا لبريدك الحالي كذلك — إذا طلب منك الموافقة، أكّد من الرسالتين.
        </p>
      ) : null}

      <SubmitButton loading={isSubmitting}>إرسال رابط التأكيد</SubmitButton>
    </form>
  );
}
