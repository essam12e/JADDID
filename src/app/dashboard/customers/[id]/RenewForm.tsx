"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { renewalSchema, type RenewalInput, RENEWAL_PRESETS } from "@/lib/validations/renewal";
import { createClient } from "@/lib/supabase/client";
import FormField from "@/components/auth/FormField";
import SubmitButton from "@/components/auth/SubmitButton";
import { translateDbError } from "@/lib/errors";

// Kept outside the component: it's an event-handler helper, not part of
// render, but isolating it here keeps the react-hooks/purity rule from
// flagging Date.now()/Math.random() as if they ran during render.
function generateIdempotencyKey(subscriptionId: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${subscriptionId}-${Date.now()}-${Math.random()}`;
}

export default function RenewForm({
  subscriptionId,
  productName,
  defaultAmount,
}: {
  subscriptionId: string;
  productName: string;
  defaultAmount: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RenewalInput>({
    resolver: zodResolver(renewalSchema),
    defaultValues: {
      durationValue: "1",
      durationUnit: "months",
      amount: defaultAmount != null ? String(defaultAmount) : "",
    },
  });

  async function onSubmit(values: RenewalInput) {
    setServerError(null);
    const supabase = createClient();

    // A fresh key per submit: a real double-click submits the SAME
    // in-flight form state, but the RPC's own idempotency check (a
    // unique constraint on this key) is what actually protects against
    // a network retry replaying this exact call underneath us.
    const idempotencyKey = generateIdempotencyKey(subscriptionId);

    const { error } = await supabase.rpc("renew_subscription", {
      p_subscription_id: subscriptionId,
      p_duration_value: Number(values.durationValue),
      p_duration_unit: values.durationUnit,
      p_amount: Number(values.amount),
      p_idempotency_key: idempotencyKey,
    });

    if (error) {
      setServerError(translateDbError(error));
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-[var(--jaddid-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--jaddid-blue)]"
      >
        تجديد اشتراك {productName}
      </button>
    );
  }

  if (success) {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
        تم التجديد بنجاح.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mt-2 space-y-3 rounded-xl border border-[var(--jaddid-border)] bg-white p-4"
      dir="rtl"
    >
      {serverError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{serverError}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {RENEWAL_PRESETS.map((preset) => (
          <button
            key={`${preset.value}-${preset.unit}`}
            type="button"
            onClick={() => {
              setValue("durationValue", String(preset.value));
              setValue("durationUnit", preset.unit);
            }}
            className="rounded-lg border border-[var(--jaddid-border)] px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-[var(--jaddid-surface)]"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField
          label="المدة"
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

      <FormField label="المبلغ المدفوع (ر.س)" inputMode="decimal" {...register("amount")} error={errors.amount?.message} />

      <div className="flex gap-2">
        <SubmitButton loading={isSubmitting}>تأكيد التجديد</SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl border border-[var(--jaddid-border)] px-4 py-2.5 text-sm font-semibold text-slate-600"
        >
          إلغاء
        </button>
      </div>
    </form>
  );
}
