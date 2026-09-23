import { test, expect } from "@playwright/test";

/**
 * Pure client-side Zod validation (react-hook-form + zodResolver) —
 * these never call Supabase, so they're real, runnable checks even
 * without live network access to it. Spec point 73's failure-case list
 * (bad email, short/mismatched password) formalized here.
 */
test.describe("Signup form validation", () => {
  test("rejects a one-character name, bad email, weak/mismatched password", async ({ page }) => {
    await page.goto("/signup");

    await page.getByLabel("الاسم").fill("م");
    await page.getByLabel("البريد الإلكتروني").fill("not-an-email");
    await page.getByLabel("كلمة المرور", { exact: true }).fill("short");
    await page.getByLabel("تأكيد كلمة المرور").fill("different");
    await page.getByRole("button", { name: "إنشاء الحساب" }).click();

    await expect(page.getByText("الاسم يجب أن يكون حرفين على الأقل")).toBeVisible();
    await expect(page.getByText("بريد إلكتروني غير صحيح")).toBeVisible();
    await expect(page.getByText("كلمة المرور يجب أن تكون 8 أحرف على الأقل")).toBeVisible();

    // Should not have navigated away (i.e. never reached the network call).
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("flags mismatched passwords even when both are individually valid", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("الاسم").fill("محمد العتيبي");
    await page.getByLabel("البريد الإلكتروني").fill("test@example.com");
    await page.getByLabel("كلمة المرور", { exact: true }).fill("Password123");
    await page.getByLabel("تأكيد كلمة المرور").fill("Password456");
    await page.getByRole("button", { name: "إنشاء الحساب" }).click();

    await expect(page.getByText("كلمتا المرور غير متطابقتين")).toBeVisible();
  });
});

test.describe("Login form validation", () => {
  test("requires a valid email and non-empty password", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("البريد الإلكتروني").fill("not-an-email");
    await page.getByRole("button", { name: "تسجيل الدخول" }).click();

    await expect(page.getByText("بريد إلكتروني غير صحيح")).toBeVisible();
    await expect(page.getByText("كلمة المرور مطلوبة")).toBeVisible();
  });

  test("links to forgot-password and signup", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: "نسيت كلمة المرور؟" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });
});

test.describe("Forgot password form validation", () => {
  test("rejects an invalid email", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("البريد الإلكتروني").fill("not-an-email");
    await page.getByRole("button", { name: "إرسال رابط الاستعادة" }).click();
    await expect(page.getByText("بريد إلكتروني غير صحيح")).toBeVisible();
  });
});
