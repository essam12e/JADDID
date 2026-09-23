"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { storeSettingsSchema, type StoreSettingsInput } from "@/lib/validations/settings";
import { createClient } from "@/lib/supabase/client";
import FormField from "@/components/auth/FormField";
import SubmitButton from "@/components/auth/SubmitButton";

export default function StoreForm({
  storeId,
  initialName,
  initialUrl,
}: {
  storeId: string;
  initialName: string;
  initialUrl: string;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StoreSettingsInput>({
    resolver: zodResolver(storeSettingsSchema),
    defaultValues: { storeName: initialName, storeUrl: initialUrl },
  });

  async function onSubmit(values: StoreSettingsInput) {
    setServerError(null);
    setSuccess(false);
    const supabase = createClient();
    const { error } = await supabase
      .from("stores")
      .update({ name: values.storeName, url: values.storeUrl || null })
      .eq("id", storeId);

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
      <FormField
        label="اسم المتجر"
        error={errors.storeName?.message}
        {...register("storeName")}
      />
      <FormField
        label="رابط المتجر"
        dir="ltr"
        placeholder="https://example.com"
        error={errors.storeUrl?.message}
        {...register("storeUrl")}
      />

      {serverError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
      ) : null}
      {success ? (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          تم حفظ التغييرات.{" "}
          <Link href="/dashboard/products/import" className="font-semibold underline">
            إعادة استيراد المنتجات من الرابط الجديد
          </Link>
        </div>
      ) : null}

      <SubmitButton loading={isSubmitting}>حفظ التغييرات</SubmitButton>
    </form>
  );
}
