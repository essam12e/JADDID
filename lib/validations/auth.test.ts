import { describe, it, expect } from "vitest";
import { signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, otpSchema } from "./auth";

describe("signupSchema", () => {
  const base = {
    fullName: "أحمد محمد",
    email: "Test@Example.com",
    password: "abcd1234",
    confirmPassword: "abcd1234",
  };

  it("accepts a valid signup and lowercases/trims the email", () => {
    const result = signupSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("test@example.com");
  });

  it("rejects a password with no digits", () => {
    const result = signupSchema.safeParse({ ...base, password: "abcdefgh", confirmPassword: "abcdefgh" });
    expect(result.success).toBe(false);
  });

  it("rejects a password with no letters", () => {
    const result = signupSchema.safeParse({ ...base, password: "12345678", confirmPassword: "12345678" });
    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = signupSchema.safeParse({ ...base, password: "ab1", confirmPassword: "ab1" });
    expect(result.success).toBe(false);
  });

  it("rejects mismatched passwords, flagging confirmPassword", () => {
    const result = signupSchema.safeParse({ ...base, confirmPassword: "different1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["confirmPassword"]);
    }
  });

  it("rejects an invalid email", () => {
    const result = signupSchema.safeParse({ ...base, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a one-character name", () => {
    const result = signupSchema.safeParse({ ...base, fullName: "أ" });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts a valid login", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(loginSchema.safeParse({ email: "bad", password: "x" }).success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.com" }).success).toBe(true);
  });

  it("rejects an invalid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "nope" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching valid passwords", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "abcd1234", confirmPassword: "abcd1234" }).success,
    ).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    expect(
      resetPasswordSchema.safeParse({ password: "abcd1234", confirmPassword: "abcd9999" }).success,
    ).toBe(false);
  });
});

describe("otpSchema", () => {
  it("accepts a 6-digit code", () => {
    expect(otpSchema.safeParse({ email: "a@b.com", token: "123456" }).success).toBe(true);
  });

  it("rejects a code that is too short", () => {
    expect(otpSchema.safeParse({ email: "a@b.com", token: "123" }).success).toBe(false);
  });

  it("rejects a code containing non-digit characters", () => {
    expect(otpSchema.safeParse({ email: "a@b.com", token: "12a456" }).success).toBe(false);
  });
});
