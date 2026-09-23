"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { templateSchema, type TemplateInput } from "@/lib/validations/template";
import { TEMPLATE_VARIABLES } from "@/lib/domain/whatsapp";
import { createClient } from "@/lib/supabase/client";
import FormField from "@/components/auth/FormField";
import SubmitButton from "@/components/auth/SubmitButton";

type ExistingTemplate = {
  id: string;
  name: string;
  body: string;
  trigger_days: number | null;
  is_active: boolean;
};

export default function TemplateForm({
  organizationId,
  existing,
}: {
  organizationId: string;
  existing?: ExistingTemplate;
}) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TemplateInput>({
    resolver: zodResolver(templateSchema),
    defaultValues: existing
      ? {
          name: existing.name,
          body: existing.body,
          triggerDays: existing.trigger_days != null ? String(existing.trigger_days) : "",
          isActive: existing.is_active,
        }
      : { isActive: true },
  });

  async function onSubmit(values: TemplateInput) {
    setServerError(null);
    const supabase = createClient();

    const payload = {
      name: values.name.trim(),
      body: values.body.trim(),
      trigger_days: values.triggerDays ? Number(values.triggerDays) : null,
      is_active: values.isActive,
    };

    if (existing) {
      const { error } = await supabase
        .from("message_templates")
        .update(payload)
        .eq("id", existing.id);
      if (error) {
        setServerError("تعذّر حفظ التعديلات.");
        return;
      }
    } else {
      const { error } = await supabase.from("message_templates").insert({
        organization_id: organizationId,
        ...payload,
      });
      if (error) {
        setServerError("تعذّر إضافة القالب.");
        return;
      }
    }

    router.push("/dashboard/templates");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{serverError}</p>
      ) : null}

      <FormField label="اسم القالب" error={errors.name?.message} {...register("name")} />

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">نص الرسالة</span>
        <textarea
          {...register("body")}
          rows={5}
          dir="rtl"
          className="w-full rounded-xl border border-[var(--jaddid-border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--jaddid-blue)] focus:ring-2 focus:ring-[var(--jaddid-blue)]/20"
        />
        {errors.body ? <p className="mt-1 text-xs text-red-600">{errors.body.message}</p> : null}
      </label>

      <div className="rounded-xl bg-[var(--jaddid-surface)] p-3">
        <p className="mb-2 text-xs font-semibold text-slate-500">المتغيرات المتاحة:</p>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_VARIABLES.map((v) => (
            <span
              key={v.token}
              title={v.description}
              className="rounded-md bg-white px-2 py-1 text-[11px] font-mono text-[var(--jaddid-blue)]"
              dir="ltr"
            >
              {v.token}
            </span>
          ))}
        </div>
      </div>

      <FormField
        label="عدد الأيام قبل الانتهاء (اختياري — لاختيار القالب المناسب تلقائيًا)"
        inputMode="numeric"
        error={errors.triggerDays?.message}
        {...register("triggerDays")}
      />

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" {...register("isActive")} className="h-4 w-4 rounded border-[var(--jaddid-border)]" />
        القالب مفعّل
      </label>

      <SubmitButton loading={isSubmitting}>{existing ? "حفظ التعديلات" : "إضافة القالب"}</SubmitButton>
    </form>
  );
}
