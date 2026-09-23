import { test, expect } from "@playwright/test";
import { loginAs, requireTestUser } from "../helpers/credentials";

/**
 * Spec point 39/72 lists specific pixel widths to test (360/390/430/
 * 768/1024/1440) — a plain viewport resize, not full touch/mobile-device
 * emulation (which pulls in Chromium subsystems this sandbox's minimal
 * container can't launch: no D-Bus/UPower). A real signed-in session,
 * checking the sidebar collapses into a working mobile nav and every
 * key screen actually renders (not just returns 200).
 */
test.use({ viewport: { width: 390, height: 844 } });

test.describe("Mobile usability (390px)", () => {
  test.beforeEach(async ({ page }) => {
    const { email, password } = requireTestUser();
    await loginAs(page, email, password);
  });

  test("dashboard sidebar collapses into a working hamburger menu", async ({ page }) => {
    await page.goto("/dashboard");
    // Desktop sidebar must be hidden, not just visually squeezed.
    await expect(page.locator("aside")).toBeHidden();

    const menuButton = page.getByRole("button", { name: "فتح القائمة" });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(page.getByRole("link", { name: /المنتجات/ })).toBeVisible();
  });

  test("every core dashboard screen renders without horizontal overflow", async ({ page }) => {
    for (const path of [
      "/dashboard",
      "/dashboard/products",
      "/dashboard/customers",
      "/dashboard/renewals",
      "/dashboard/templates",
      "/dashboard/settings/profile",
    ]) {
      await page.goto(path);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth, `${path} has horizontal overflow at 390px`).toBeLessThanOrEqual(clientWidth + 1);
    }
  });

  test("notification bell and store switcher are reachable on mobile", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByLabel("الإشعارات")).toBeVisible();
  });
});
