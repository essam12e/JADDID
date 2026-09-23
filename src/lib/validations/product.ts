import { z } from "zod";

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .refine((val) => !val || /^https?:\/\/.+\..+/.test(val), {
    message: "أدخل رابطًا صحيحًا يبدأ بـ http:// أو https://",
  });

export const productSchema = z.object({
  name: z.string().trim().min(2, "اسم المنتج يجب أن يكون حرفين على الأقل").max(150),
  description: z.string().trim().max(2000).optional(),
  price: z
    .string()
    .optional()
    .refine((val) => !val || (!Number.isNaN(Number(val)) && Number(val) >= 0), {
      message: "السعر يجب أن يكون رقمًا موجبًا",
    }),
  imageUrl: optionalUrl,
  renewalUrl: optionalUrl,
  sourceUrl: optionalUrl,
});

export type ProductInput = z.infer<typeof productSchema>;
