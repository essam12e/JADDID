import { z } from "zod";

/**
 * A customer added by hand.
 *
 * Deliberately smaller than the sale form: a merchant adding someone they
 * just met on WhatsApp has a name and a number, and nothing else yet. The
 * subscription is recorded later from the product page.
 */
export const customerSchema = z.object({
  name: z.string().trim().min(2, "اسم العميل يجب أن يكون حرفين على الأقل").max(150),
  phone: z
    .string()
    .trim()
    .min(6, "أدخل رقم جوال صحيح")
    .max(20)
    .regex(/^[0-9+\-\s()]+$/, "رقم الجوال يجب أن يحتوي أرقامًا فقط"),
  email: z
    .string()
    .trim()
    .max(255)
    .optional()
    .refine((val) => !val || /^\S+@\S+\.\S+$/.test(val), {
      message: "أدخل بريدًا إلكترونيًا صحيحًا",
    }),
  storeId: z.string().trim().min(1, "اختر المتجر"),
  notes: z.string().trim().max(2000).optional(),
});

export type CustomerInput = z.infer<typeof customerSchema>;
