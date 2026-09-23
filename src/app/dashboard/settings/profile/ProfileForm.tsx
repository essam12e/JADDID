"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { profileSchema, type ProfileInput } from "@/lib/validations/settings";
import { createClient } from "@/lib/supabase/client";
import FormField from "@/components/auth/FormField";
import SubmitButton from "@/components/auth/SubmitButton";

export default function ProfileForm({
  email,
  initialFullName,
}: {
  email: string;
  initialFullName: string;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: initialFullName },
  });

  async function onSubmit(values: ProfileInput) {
    setServerError(null);
    setSuccess(false);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setServerError("انتهت الجلسة، يرجى تسجيل الدخول مجددًا.");
      return;
    }
    // Table grant is deliberately narrowed to (full_name, updated_at) —
    // see phase2 migration — so this is the only column this can touch.
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: values.fullName })
      .eq("id", user.id);

    if (error) {
      setServerError("تعذّر حفظ التغييرات.");
      return;
    }
    setSuccess(true);
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-md space-y-4 rounded-2xl border border-[var(--jaddid-border)] bg-white p-5"
      noValidate
    >
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          البريد الإلكتروني
        </span>
        <input
          value={email}
          disabled
          dir="ltr"
          className="w-full cursor-not-allowed rounded-xl border border-[var(--jaddid-border)] bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500"
        />
      </label>

      <FormField
        label="الاسم الكامل"
        autoComplete="name"
        error={errors.fullName?.message}
        {...register("fullName")}
      />

      {serverError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
      ) : null}
      {success ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          تم حفظ التغييرات.
        </p>
      ) : null}

      <SubmitButton loading={isSubmitting}>حفظ التغييرات</SubmitButton>
    </form>
  );
}
