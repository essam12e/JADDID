"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { customerSchema, type CustomerInput } from "@/lib/validations/customer";
import { createClient } from "@/lib/supabase/client";
import { translateDbError } from "@/lib/errors";
import FormField from "@/components/auth/FormField";
import SubmitButton from "@/components/auth/SubmitButton";

export default function CustomerForm({
  organizationId,
  stores,
}: {
  organizationId: string;
  stores: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: { storeId: stores[0]?.id ?? "" },
  });

  async function onSubmit(values: CustomerInput) {
    setServerError(null);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("customers")
      .insert({
        organization_id: organizationId,
        store_id: values.storeId,
        name: values.name.trim(),
        phone: values.phone.trim(),
        email: values.email?.trim() || null,
        notes: values.notes?.trim() || null,
      })
      .select("id")
      .single();

    if (error) {
      // Plan limits come back as JADDID_* codes; anything else must not
      // put a Postgres message on screen.
      setServerError(translateDbError(error));
      return;
    }

    router.push(`/dashboard/customers/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{serverError}</p>
      ) : null}

      <FormField
        label="اسم العميل"
        placeholder="مثال: محمد العتيبي"
        error={errors.name?.message}
        {...register("name")}
      />

      <FormField
        label="رقم الجوال"
        inputMode="tel"
        dir="ltr"
        placeholder="05xxxxxxxx"
        error={errors.phone?.message}
        {...register("phone")}
      />

      <FormField
        label="البريد الإلكتروني (اختياري)"
        inputMode="email"
        dir="ltr"
        error={errors.email?.message}
        {...register("email")}
      />

      {stores.length > 1 ? (
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">المتجر</span>
          <select
            {...register("storeId")}
            className="w-full rounded-xl border border-[var(--jaddid-border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--jaddid-blue)] focus:ring-2 focus:ring-[var(--jaddid-blue)]/20"
          >
            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
          {errors.storeId ? (
            <p className="mt-1 text-xs text-red-600">{errors.storeId.message}</p>
          ) : null}
        </label>
      ) : (
        <input type="hidden" {...register("storeId")} />
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">ملاحظات (اختياري)</span>
        <textarea
          {...register("notes")}
          rows={3}
          dir="rtl"
          className="w-full rounded-xl border border-[var(--jaddid-border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--jaddid-blue)] focus:ring-2 focus:ring-[var(--jaddid-blue)]/20"
        />
        {errors.notes ? <p className="mt-1 text-xs text-red-600">{errors.notes.message}</p> : null}
      </label>

      <SubmitButton loading={isSubmitting}>إضافة العميل</SubmitButton>
    </form>
  );
}
