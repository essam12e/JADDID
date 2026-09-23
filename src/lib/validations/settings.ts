import { z } from "zod";

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "الاسم يجب أن يكون حرفين على الأقل")
    .max(100, "الاسم طويل جدًا"),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const storeSettingsSchema = z.object({
  storeName: z
    .string()
    .trim()
    .min(2, "اسم المتجر يجب أن يكون حرفين على الأقل")
    .max(80, "اسم المتجر طويل جدًا"),
  // Format-only here, same as onboarding — the importer's SSRF guard is
  // what actually validates a URL before ever fetching it.
  storeUrl: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^https?:\/\/.+\..+/.test(val), {
      message: "أدخل رابطًا صحيحًا يبدأ بـ http:// أو https://",
    }),
});

export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;
