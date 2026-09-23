import { test, expect } from "@playwright/test";

/**
 * Spec point 70/71's minimum bar ("a non-admin/anonymous request to
 * /admin must be rejected") formalized as an automated check, covering
 * every protected route family rather than a single manual curl.
 */
const PROTECTED_ROUTES = [
  "/dashboard",
  "/dashboard/products",
  "/dashboard/customers",
  "/dashboard/renewals",
  "/dashboard/templates",
  "/dashboard/settings",
  "/dashboard/settings/profile",
  "/dashboard/settings/store",
  "/dashboard/settings/security",
  "/onboarding",
  "/admin",
  "/admin/organizations",
  "/admin/activations",
];

test.describe("Route protection (unauthenticated)", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route} redirects to /login with a return path`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(
        new RegExp(`/login\\?next=${encodeURIComponent(route).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
      );
    });
  }

  test("an admin route under a dynamic id also redirects, not 500s", async ({ page }) => {
    const response = await page.goto("/admin/organizations/00000000-0000-0000-0000-000000000000");
    // Middleware redirect happens before the page ever renders, so this
    // should never reach a database lookup (and therefore never 500) for
    // an unauthenticated request.
    expect(response?.status()).toBeLessThan(500);
    await expect(page).toHaveURL(/\/login\?next=/);
  });
});
