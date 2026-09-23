import { z } from "zod";

export const durationUnitSchema = z.enum(["days", "months", "years"]);
export type DurationUnit = z.infer<typeof durationUnitSchema>;

export const saleSchema = z.object({
  customerName: z.string().trim().min(2, "اسم العميل يجب أن يكون حرفين على الأقل").max(150),
  customerPhone: z
    .string()
    .trim()
    .min(6, "أدخل رقم جوال صحيح")
    .max(20)
    .regex(/^[0-9+\-\s]+$/, "رقم الجوال يجب أن يحتوي أرقامًا فقط"),
  customerEmail: z
    .string()
    .trim()
    .max(255)
    .optional()
    .refine((val) => !val || /^\S+@\S+\.\S+$/.test(val), {
      message: "أدخل بريدًا إلكترونيًا صحيحًا",
    }),
  pricePaid: z
    .string()
    .trim()
    .min(1, "أدخل المبلغ المدفوع")
    .refine((val) => !Number.isNaN(Number(val)) && Number(val) >= 0, {
      message: "المبلغ يجب أن يكون رقمًا موجبًا",
    }),
  startDate: z.string().trim().min(1, "أدخل تاريخ البدء"),
  durationValue: z
    .string()
    .trim()
    .min(1, "أدخل مدة الاشتراك")
    .refine((val) => Number.isInteger(Number(val)) && Number(val) > 0, {
      message: "المدة يجب أن تكون رقمًا صحيحًا موجبًا",
    }),
  durationUnit: durationUnitSchema,
  notes: z.string().trim().max(2000).optional(),
});

export type SaleInput = z.infer<typeof saleSchema>;
