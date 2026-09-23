"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { productSchema, type ProductInput } from "@/lib/validations/product";
import { createClient } from "@/lib/supabase/client";
import FormField from "@/components/auth/FormField";
import SubmitButton from "@/components/auth/SubmitButton";

type ExistingProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
  renewal_url: string | null;
  source_url: string | null;
};

export default function ProductForm({
  storeId,
  organizationId,
  existing,
}: {
  storeId: string;
  organizationId: string;
  existing?: ExistingProduct;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: existing
      ? {
          name: existing.name,
          description: existing.description ?? "",
          price: existing.price != null ? String(existing.price) : "",
          imageUrl: existing.image_url ?? "",
          renewalUrl: existing.renewal_url ?? "",
          sourceUrl: existing.source_url ?? "",
        }
      : undefined,
  });

  async function onSubmit(values: ProductInput) {
    setServerError(null);
    const supabase = createClient();

    const payload = {
      name: values.name.trim(),
      description: values.description?.trim() || null,
      price: values.price ? Number(values.price) : null,
      image_url: values.imageUrl || null,
      renewal_url: values.renewalUrl || null,
      source_url: values.sourceUrl || null,
    };

    if (existing) {
      const { error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", existing.id);
      if (error) {
        setServerError("تعذّر حفظ التعديلات.");
        return;
      }
    } else {
      const { error } = await supabase.from("products").insert({
        organization_id: organizationId,
        store_id: storeId,
        currency: "SAR",
        ...payload,
      });
      if (error) {
        setServerError("تعذّر إضافة المنتج.");
        return;
      }
    }

    router.push("/dashboard/products");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormField label="اسم المنتج" type="text" error={errors.name?.message} {...register("name")} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">الوصف (اختياري)</span>
        <textarea
          {...register("description")}
          rows={3}
          className="w-full rounded-xl border border-[var(--jaddid-border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--jaddid-blue)] focus:ring-2 focus:ring-[var(--jaddid-blue)]/20"
        />
      </label>
      <FormField
        label="السعر (اختياري)"
        type="number"
        step="0.01"
        dir="ltr"
        error={errors.price?.message}
        {...register("price")}
      />
      <FormField
        label="رابط الصورة (اختياري)"
        type="url"
        dir="ltr"
        error={errors.imageUrl?.message}
        {...register("imageUrl")}
      />
      <FormField
        label="رابط التجديد / الدفع (اختياري)"
        type="url"
        dir="ltr"
        placeholder="https://..."
        error={errors.renewalUrl?.message}
        {...register("renewalUrl")}
      />
      <FormField
        label="الرابط الأصلي للمنتج (اختياري)"
        type="url"
        dir="ltr"
        error={errors.sourceUrl?.message}
        {...register("sourceUrl")}
      />

      {serverError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
      ) : null}

      <SubmitButton loading={isSubmitting}>{existing ? "حفظ التعديلات" : "إضافة المنتج"}</SubmitButton>
    </form>
  );
}
