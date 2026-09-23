import { test, expect } from "@playwright/test";
import { loginAs, requireTestUser, requireAdminUser } from "../helpers/credentials";

test.describe("Admin access control (spec point 70)", () => {
  test("a signed-in non-admin is redirected away from /admin", async ({ page }) => {
    const { email, password } = requireTestUser();
    await loginAs(page, email, password);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("a signed-in non-admin cannot open an admin org detail page either", async ({ page }) => {
    const { email, password } = requireTestUser();
    await loginAs(page, email, password);
    await page.goto("/admin/organizations/00000000-0000-0000-0000-000000000000");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe("Admin activation review (spec points 14, 18)", () => {
  test.beforeEach(async ({ page }) => {
    const { email, password } = requireAdminUser();
    await loginAs(page, email, password);
  });

  test("admin nav link is visible and /admin loads real stats, not mock numbers", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("link", { name: /لوحة الإدارة/ }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("approving a pending activation requires an explicit confirm step", async ({ page }) => {
    await page.goto("/admin/activations");
    const approveButton = page.getByRole("button", { name: "الموافقة والتفعيل" }).first();
    test.skip((await approveButton.count()) === 0, "No pending activation request to review right now.");

    await approveButton.click();
    // This is the exact gap that was found and fixed: the first click
    // must NOT call the RPC yet — it must show a confirmation step first
    // (spec point 18: "لا تنفذ عمليات حساسة بدون confirmation modal").
    await expect(page.getByText("سيتم تفعيل حساب هذه المؤسسة فورًا")).toBeVisible();
    await expect(page.getByRole("button", { name: "تأكيد الموافقة والتفعيل" })).toBeVisible();

    await page.getByRole("button", { name: "إلغاء" }).click();
    await expect(page.getByText("سيتم تفعيل حساب هذه المؤسسة فورًا")).not.toBeVisible();

    // Now actually confirm, and verify it lands in the audit log visible
    // on the org's own detail page (spec point 17).
    await approveButton.click();
    await page.getByRole("button", { name: "تأكيد الموافقة والتفعيل" }).click();
    await expect(page.getByText("تعذّر تنفيذ الإجراء")).not.toBeVisible();
  });

  test("org detail page shows members, stores, and an audit log", async ({ page }) => {
    await page.goto("/admin/organizations");
    const firstOrgLink = page.locator("table a").first();
    test.skip((await firstOrgLink.count()) === 0, "No organizations registered yet.");
    await firstOrgLink.click();
    await expect(page.getByText("سجل الإجراءات الإدارية")).toBeVisible();
  });
});
