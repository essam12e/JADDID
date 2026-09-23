import { z } from "zod";

export const storeNameSchema = z.object({
  storeName: z
    .string()
    .trim()
    .min(2, "اسم المتجر يجب أن يكون حرفين على الأقل")
    .max(80, "اسم المتجر طويل جدًا"),
});

export type StoreNameInput = z.infer<typeof storeNameSchema>;

// Format-only validation here. Full SSRF-safe fetch validation (blocking
// localhost/private ranges/cloud metadata) belongs to the importer
// itself (Phase 5) — this step only stores the URL, it never fetches it.
export const storeUrlSchema = z.object({
  storeUrl: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^https?:\/\/.+\..+/.test(val), {
      message: "أدخل رابطًا صحيحًا يبدأ بـ http:// أو https://",
    }),
});

export type StoreUrlInput = z.infer<typeof storeUrlSchema>;
