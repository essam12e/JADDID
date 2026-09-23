import { test, expect } from "@playwright/test";
import { loginAs, requireTestUser, requireLiveSupabaseNetwork } from "../helpers/credentials";

test.describe("Signup (spec point 65)", () => {
  test("a fresh signup submits to Supabase and lands on the OTP/verify screen", async ({ page }) => {
    // This part only needs live network to Supabase Auth, not an email
    // inbox — it stops short of actually completing verification, which
    // would need a real inbox (Mailosaur or similar) this suite doesn't
    // have configured. Runs a real signup against Supabase.
    requireLiveSupabaseNetwork();

    const uniqueEmail = `e2e-${Date.now()}@example.com`;
    await page.goto("/signup");
    await page.getByLabel("الاسم").fill("مستخدم اختبار");
    await page.getByLabel("البريد الإلكتروني").fill(uniqueEmail);
    await page.getByLabel("كلمة المرور", { exact: true }).fill("TestPassword123");
    await page.getByLabel("تأكيد كلمة المرور").fill("TestPassword123");
    await page.getByRole("button", { name: "إنشاء الحساب" }).click();

    await page.waitForURL(/\/verify-email\?email=/, { timeout: 15_000 });
    expect(page.url()).toContain(encodeURIComponent(uniqueEmail));
  });
});

test.describe("Login (spec point 9)", () => {
  test("a verified user logs in and reaches /dashboard", async ({ page }) => {
    const { email, password } = requireTestUser();
    await loginAs(page, email, password);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("wrong password shows a generic error, not which field is wrong", async ({ page }) => {
    const { email } = requireTestUser();
    await page.goto("/login");
    await page.getByLabel("البريد الإلكتروني").fill(email);
    await page.getByLabel("كلمة المرور", { exact: true }).fill("definitely-wrong-password");
    await page.getByRole("button", { name: "تسجيل الدخول" }).click();
    await expect(page.getByText("البريد الإلكتروني أو كلمة المرور غير صحيحة")).toBeVisible();
  });

  test("login?next= redirects back to the originally-requested page", async ({ page }) => {
    const { email, password } = requireTestUser();
    await page.goto("/dashboard/settings");
    await page.waitForURL(/\/login\?next=/);
    await page.getByLabel("البريد الإلكتروني").fill(email);
    await page.getByLabel("كلمة المرور", { exact: true }).fill(password);
    await page.getByRole("button", { name: "تسجيل الدخول" }).click();
    await page.waitForURL(/\/dashboard\/settings/, { timeout: 15_000 });
  });
});
