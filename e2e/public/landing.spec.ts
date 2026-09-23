import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("loads, is RTL, and has no console/page errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");

    // Hero headline (spec point 36: import-focused hero, not just alerts).
    await expect(page.getByRole("heading", { level: 1 })).toContainText("جَدِّد");

    expect(errors).toEqual([]);
  });

  test("primary CTAs link to signup", async ({ page }) => {
    await page.goto("/");
    const ctas = page.getByRole("link", { name: /إنشاء حساب|ابدأ مع جَدِّد|إنشاء حساب مجاني/ });
    expect(await ctas.count()).toBeGreaterThan(0);
  });

  test("nav links to pricing, not a dead anchor", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "الأسعار" }).first().click();
    await expect(page).toHaveURL(/\/pricing$/);
  });

  test("footer legal links resolve (terms, privacy, about)", async ({ page }) => {
    for (const path of ["/terms", "/privacy", "/about"]) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
    }
  });
});

test.describe("Standalone pricing page", () => {
  test("loads on its own route", async ({ page }) => {
    const response = await page.goto("/pricing");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /الأسعار|باقة/ }).first()).toBeVisible();
  });
});
