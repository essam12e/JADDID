import { z } from "zod";

export const templateSchema = z.object({
  name: z.string().trim().min(2, "اسم القالب يجب أن يكون حرفين على الأقل").max(150),
  body: z.string().trim().min(5, "نص الرسالة قصير جدًا").max(2000),
  triggerDays: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || (Number.isInteger(Number(val)) && Number(val) >= 0), {
      message: "عدد الأيام يجب أن يكون رقمًا صحيحًا موجبًا",
    }),
  isActive: z.boolean(),
});

export type TemplateInput = z.infer<typeof templateSchema>;
