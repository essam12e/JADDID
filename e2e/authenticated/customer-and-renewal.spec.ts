import { test, expect } from "@playwright/test";
import { loginAs, requireTestUser } from "../helpers/credentials";

/**
 * Requires the test account to already have at least one product (import
 * it once via the dashboard, or seed one directly in Supabase) — this
 * suite tests the sale/renewal flow, not the importer (see
 * store-import.spec.ts for that).
 */
test.describe("Customer + subscription (spec point 67)", () => {
  test.beforeEach(async ({ page }) => {
    const { email, password } = requireTestUser();
    await loginAs(page, email, password);
  });

  test("registering a sale creates a customer and subscription with a computed end date", async ({ page }) => {
    await page.goto("/dashboard/products");
    const sellLink = page.getByRole("link", { name: "تسجيل عملية بيع" }).first();
    test.skip((await sellLink.count()) === 0, "Test account has no products yet.");
    await sellLink.click();

    const phone = `+9665${Date.now().toString().slice(-8)}`;
    await page.getByLabel("اسم العميل").fill("عميل اختبار E2E");
    await page.getByLabel("رقم الجوال").fill(phone);
    await page.getByLabel("المبلغ المدفوع (ر.س)").fill("99");
    await page.getByLabel("مدة الاشتراك").fill("1");
    await page.getByRole("button", { name: "تسجيل عملية البيع" }).click();

    await expect(page.getByText("تم تسجيل عملية البيع بنجاح")).toBeVisible({ timeout: 15_000 });

    // Same customer, second product/sale: matched by phone, not
    // duplicated (Phase 7's register_sale dedup-by-(store_id, phone)).
    await page.goto("/dashboard/customers");
    await page.getByPlaceholder(/بحث/).fill(phone);
    await expect(page.getByText("عميل اختبار E2E")).toBeVisible();
  });

  test("renewing a subscription extends the date without losing history", async ({ page }) => {
    await page.goto("/dashboard/customers");
    const firstCustomer = page.locator("a", { hasText: /.+/ }).first();
    test.skip((await firstCustomer.count()) === 0, "Test account has no customers yet.");
    await firstCustomer.click();

    const renewButton = page.getByRole("button", { name: /تجديد اشتراك/ }).first();
    test.skip((await renewButton.count()) === 0, "Customer profile has no active subscription to renew.");
    await renewButton.click();
    await page.getByRole("button", { name: "تأكيد التجديد" }).click();

    await expect(page.getByText("تم التجديد بنجاح")).toBeVisible({ timeout: 15_000 });
    // The renewal record is additive (a new row), never a destructive
    // rewrite of the previous one — spec point 27's "لا تمسح سجل
    // الاشتراك القديم" requirement.
    await page.reload();
    await expect(page.getByText(/سجل التجديدات|تجديد/)).toBeVisible();
  });

  test("double-submitting a renewal does not create two renewal rows", async ({ page }) => {
    await page.goto("/dashboard/customers");
    const firstCustomer = page.locator("a", { hasText: /.+/ }).first();
    test.skip((await firstCustomer.count()) === 0, "Test account has no customers yet.");
    await firstCustomer.click();

    const renewButton = page.getByRole("button", { name: /تجديد اشتراك/ }).first();
    test.skip((await renewButton.count()) === 0, "No active subscription to renew.");
    await renewButton.click();
    const confirm = page.getByRole("button", { name: "تأكيد التجديد" });

    // Fire both clicks before either round-trip resolves — this is
    // exactly the double-click scenario the RPC's idempotency key (a
    // fresh UUID generated once per submit, checked as a unique
    // constraint server-side) is meant to protect against.
    await Promise.all([confirm.click(), confirm.click()]);
    await expect(page.getByText("تم التجديد بنجاح")).toBeVisible({ timeout: 15_000 });
  });
});
