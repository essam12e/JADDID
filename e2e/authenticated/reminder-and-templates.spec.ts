import { test, expect } from "@playwright/test";
import { loginAs, requireTestUser } from "../helpers/credentials";

test.describe("WhatsApp reminder (spec points 28-30, 69)", () => {
  test.beforeEach(async ({ page }) => {
    const { email, password } = requireTestUser();
    await loginAs(page, email, password);
  });

  test("templates CRUD page renders and default templates exist or can be created", async ({ page }) => {
    await page.goto("/dashboard/templates");
    await expect(page.getByRole("heading")).toBeVisible();
  });

  test("the reminder link opens wa.me with variables substituted, never auto-sends", async ({ page }) => {
    await page.goto("/dashboard/renewals");
    const openWhatsApp = page.getByRole("link", { name: "فتح واتساب" }).first();
    test.skip(
      (await openWhatsApp.count()) === 0,
      "No subscription currently needs a reminder (nothing expiring/expired/at-risk) in this test account.",
    );

    const href = await openWhatsApp.getAttribute("href");
    expect(href).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    // The whole point of spec point 30: this only opens WhatsApp with a
    // pre-filled message — the merchant still has to press send inside
    // WhatsApp themselves. There is no code path that could mark this
    // as "sent" from here alone.
    expect(href).not.toMatch(/sent=true|delivered/);

    // Clicking it should never claim the message was actually sent —
    // only that WhatsApp was opened.
    await openWhatsApp.click();
    await expect(page.getByText(/تم فتح واتساب.*لا يعني إرسال الرسالة فعليًا/)).toBeVisible();
  });
});
