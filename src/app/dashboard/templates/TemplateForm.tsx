"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { templateSchema, type TemplateInput } from "@/lib/validations/template";
import { TEMPLATE_VARIABLES, renderTemplate } from "@/lib/domain/whatsapp";
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
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  // Mirrors the textarea so the preview can re-render without `watch()`,
  // which the React Compiler refuses to memoize around.
  const [body, setBody] = useState(existing?.body ?? "");
  const {
    register,
    handleSubmit,
    setValue,
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

  /**
   * Drops a variable where the cursor is.
   *
   * The chips used to be plain text, so writing `{{customer_name}}` meant
   * copying it by hand — and one typo silently ships a message with a raw
   * token in it. Clicking writes it correctly every time.
   */
  function insertVariable(token: string) {
    const field = bodyRef.current;
    if (!field) {
      const appended = `${body}${token}`;
      setValue("body", appended, { shouldDirty: true });
      setBody(appended);
      return;
    }

    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? start;
    const next = field.value.slice(0, start) + token + field.value.slice(end);

    setValue("body", next, { shouldDirty: true, shouldValidate: true });
    setBody(next);

    // Put the caret after what we just inserted, so several chips in a row
    // read as one sentence instead of stacking at the start.
    requestAnimationFrame(() => {
      field.focus();
      const caret = start + token.length;
      field.setSelectionRange(caret, caret);
    });
  }

  const { ref: registerBodyRef, onChange: onBodyChange, ...bodyField } = register("body");

  const preview = body.trim()
    ? renderTemplate(body, {
        customer_name: "محمد العتيبي",
        product_name: "اشتراك نتفلكس",
        remaining_days: 3,
        end_date: "25 أكتوبر 2026",
        renewal_url: "https://your-store.com/renew",
        store_name: "متجر النور",
      })
    : "";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{serverError}</p>
      ) : null}

      <FormField label="اسم القالب" error={errors.name?.message} {...register("name")} />

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">نص الرسالة</span>
        <textarea
          {...bodyField}
          onChange={(event) => {
            setBody(event.target.value);
            return onBodyChange(event);
          }}
          ref={(node) => {
            registerBodyRef(node);
            bodyRef.current = node;
          }}
          rows={5}
          dir="rtl"
          className="w-full rounded-xl border border-[var(--jaddid-border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--jaddid-blue)] focus:ring-2 focus:ring-[var(--jaddid-blue)]/20"
        />
        {errors.body ? <p className="mt-1 text-xs text-red-600">{errors.body.message}</p> : null}
      </label>

      <div className="rounded-xl bg-[var(--jaddid-surface)] p-3">
        <p className="mb-2 text-xs font-semibold text-slate-500">
          اضغط على المتغيّر لإضافته داخل الرسالة:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_VARIABLES.map((v) => (
            <button
              key={v.token}
              type="button"
              onClick={() => insertVariable(v.token)}
              title={v.description}
              className="rounded-md bg-white px-2.5 py-1.5 text-[11px] font-medium text-[var(--jaddid-navy)] transition hover:bg-[var(--jaddid-blue)] hover:text-white"
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {preview ? (
        <div className="rounded-xl border border-[var(--jaddid-border)] bg-white p-3">
          <p className="mb-2 text-xs font-semibold text-slate-500">
            معاينة الرسالة كما تصل العميل:
          </p>
          <p className="whitespace-pre-wrap text-sm text-[var(--jaddid-navy)]">{preview}</p>
        </div>
      ) : null}

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
