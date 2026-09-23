import { z } from "zod";

// A deliberately simple, non-leaky strength rule: length + character
// variety, without telling an attacker exactly which rule failed in a
// way that helps them (the message stays generic).
const passwordSchema = z
  .string()
  .min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل")
  .max(72, "كلمة المرور طويلة جدًا")
  .refine(
    (val) => /[a-zA-Z]/.test(val) && /[0-9]/.test(val),
    "يجب أن تحتوي كلمة المرور على أحرف وأرقام",
  );

export const signupSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "الاسم يجب أن يكون حرفين على الأقل")
      .max(100, "الاسم طويل جدًا"),
    email: z.string().trim().toLowerCase().email("بريد إلكتروني غير صحيح"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "كلمتا المرور غير متطابقتين",
    path: ["confirmPassword"],
  });

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("بريد إلكتروني غير صحيح"),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
  rememberMe: z.boolean().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("بريد إلكتروني غير صحيح"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "كلمتا المرور غير متطابقتين",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const otpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z
    .string()
    .length(6, "الرمز يجب أن يتكون من 6 أرقام")
    .regex(/^\d{6}$/, "الرمز يجب أن يتكون من أرقام فقط"),
});

export type OtpInput = z.infer<typeof otpSchema>;
