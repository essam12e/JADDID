import { z } from "zod";
import { durationUnitSchema } from "./sale";

export const renewalSchema = z.object({
  durationValue: z
    .string()
    .trim()
    .min(1, "أدخل مدة التجديد")
    .refine((val) => Number.isInteger(Number(val)) && Number(val) > 0, {
      message: "المدة يجب أن تكون رقمًا صحيحًا موجبًا",
    }),
  durationUnit: durationUnitSchema,
  amount: z
    .string()
    .trim()
    .min(1, "أدخل المبلغ المدفوع")
    .refine((val) => !Number.isNaN(Number(val)) && Number(val) >= 0, {
      message: "المبلغ يجب أن يكون رقمًا موجبًا",
    }),
});

export type RenewalInput = z.infer<typeof renewalSchema>;

/** Renewal duration presets shown as quick-pick buttons before "custom". */
export const RENEWAL_PRESETS: { label: string; value: number; unit: "days" | "months" | "years" }[] = [
  { label: "30 يوم", value: 30, unit: "days" },
  { label: "شهر", value: 1, unit: "months" },
  { label: "3 أشهر", value: 3, unit: "months" },
  { label: "6 أشهر", value: 6, unit: "months" },
  { label: "سنة", value: 1, unit: "years" },
];
