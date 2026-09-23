import { z } from "zod";

export const startImportSchema = z.object({
  storeId: z.string().uuid("معرّف متجر غير صالح"),
  sourceUrl: z
    .string()
    .trim()
    .min(1, "الرابط مطلوب")
    .refine((val) => /^https?:\/\/.+\..+/.test(val), {
      message: "أدخل رابطًا صحيحًا يبدأ بـ http:// أو https://",
    }),
});

export type StartImportInput = z.infer<typeof startImportSchema>;
