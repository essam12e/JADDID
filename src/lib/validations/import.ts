import { z } from "zod";

/** Ceiling on one import request, whatever the caller asks for. */
export const MAX_IMPORT_LIMIT = 2000;

/** The choices offered on the import screen. */
export const IMPORT_LIMIT_CHOICES = [50, 100, 200, 500, MAX_IMPORT_LIMIT] as const;

export const DEFAULT_IMPORT_LIMIT = 200;

export const startImportSchema = z.object({
  storeId: z.string().uuid("معرّف متجر غير صالح"),
  sourceUrl: z
    .string()
    .trim()
    .min(1, "الرابط مطلوب")
    .refine((val) => /^https?:\/\/.+\..+/.test(val), {
      message: "أدخل رابطًا صحيحًا يبدأ بـ http:// أو https://",
    }),
  /**
   * How many products to bring in. Omitted means "as many as the run can
   * reach" — the merchant chooses on the import screen, because a small
   * shop wants everything and a large one usually wants a batch it can
   * check before committing to the rest.
   */
  limit: z.number().int().min(1).max(MAX_IMPORT_LIMIT).optional(),
});

export type StartImportInput = z.infer<typeof startImportSchema>;
