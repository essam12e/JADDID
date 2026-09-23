"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { saleSchema, type SaleInput } from "@/lib/validations/sale";
import { createClient } from "@/lib/supabase/client";
import FormField from "@/components/auth/FormField";
import SubmitButton from "@/components/auth/SubmitButton";

export default function SaleForm({
  storeId,
  productId,
  productName,
}: {
  storeId: string;
  productId: string;
  productName: string;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SaleInput>({
    resolver: zodResolver(saleSchema),
    defaultValues: {
      startDate: new Date().toISOString().slice(0, 10),
      durationUnit: "months",
      durationValue: "1",
    },
  });

  async function onSubmit(values: SaleInput) {
    setServerError(null);
    const supabase = createClient();

    const { data, error } = await supabase.rpc("register_sale", {
      p_store_id: storeId,
      p_product_id: productId,
      p_customer_name: values.customerName.trim(),
      p_customer_phone: values.customerPhone.trim(),
      p_customer_email: values.customerEmail?.trim() || null,
      p_price_paid: Number(values.pricePaid),
      p_start_date: values.startDate,
      p_duration_value: Number(values.durationValue),
      p_duration_unit: values.durationUnit,
      p_notes: values.notes?.trim() || null,
    });

    if (error) {
      setServerError(error.message || "تعذّر تسجيل عملية البيع.");
      return;
    }

    setSuccessId(data as string);
  }

  if (successId) {
    return (
      <div className="rounded-xl bg-emerald-50 px-4 py-4 text-sm leading-6 text-emerald-700">
        <p className="font-semibold">تم تسجيل عملية البيع بنجاح.</p>
        <p className="mt-1">تمت إضافة الاشتراك وربطه بالعميل.</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => router.push(`/dashboard/products/${productId}/customers`)}
            className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-emerald-700 shadow-sm"
          >
            عرض عملاء {productName}
          </button>
          <button
            type="button"
            onClick={() => {
              setSuccessId(null);
              router.refresh();
            }}
            className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm"
          >
            تسجيل عملية أخرى
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" dir="rtl">
      {serverError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{serverError}</p>
      ) : null}

      <FormField label="اسم العميل" {...register("customerName")} error={errors.customerName?.message} />
      <FormField
        label="رقم الجوال"
        dir="ltr"
        placeholder="+9665xxxxxxxx"
        {...register("customerPhone")}
        error={errors.customerPhone?.message}
      />
      <FormField
        label="البريد الإلكتروني (اختياري)"
        dir="ltr"
        {...register("customerEmail")}
        error={errors.customerEmail?.message}
      />

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="المبلغ المدفوع (ر.س)"
          inputMode="decimal"
          {...register("pricePaid")}
          error={errors.pricePaid?.message}
        />
        <FormField
          label="تاريخ البدء"
          type="date"
          {...register("startDate")}
          error={errors.startDate?.message}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="مدة الاشتراك"
          inputMode="numeric"
          {...register("durationValue")}
          error={errors.durationValue?.message}
        />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">الوحدة</span>
          <select
            {...register("durationUnit")}
            className="w-full rounded-xl border border-[var(--jaddid-border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--jaddid-blue)] focus:ring-2 focus:ring-[var(--jaddid-blue)]/20"
          >
            <option value="days">أيام</option>
            <option value="months">أشهر</option>
            <option value="years">سنوات</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">ملاحظات (اختياري)</span>
        <textarea
          {...register("notes")}
          rows={3}
          className="w-full rounded-xl border border-[var(--jaddid-border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--jaddid-blue)] focus:ring-2 focus:ring-[var(--jaddid-blue)]/20"
        />
        {errors.notes ? <p className="mt-1 text-xs text-red-600">{errors.notes.message}</p> : null}
      </label>

      <SubmitButton loading={isSubmitting}>تسجيل عملية البيع</SubmitButton>
    </form>
  );
}
