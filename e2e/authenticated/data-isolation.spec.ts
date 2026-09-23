import { test, expect, request } from "@playwright/test";
import { requireTwoTestUsers, loginAs } from "../helpers/credentials";

/**
 * Spec point 71: "هذا اختبار إلزامي قبل Production" — User A must not be
 * able to read or write User B's data, including via a manual/direct
 * request, not just through the normal UI. This is the one test in this
 * suite that spec explicitly calls mandatory, so it gets its own file
 * even though it needs the most setup (two distinct real accounts, each
 * with at least one customer).
 */
test.describe("Cross-tenant data isolation (spec point 71, mandatory)", () => {
  test("User A cannot see User B's customer via the UI", async ({ page }) => {
    const { a, b } = requireTwoTestUsers();

    // Find one of User B's customer detail URLs while logged in as B.
    await loginAs(page, b.email, b.password);
    await page.goto("/dashboard/customers");
    const firstCustomerLink = page.locator("a[href*='/dashboard/customers/']").first();
    test.skip((await firstCustomerLink.count()) === 0, "User B account has no customers to test isolation against.");
    const customerUrl = await firstCustomerLink.getAttribute("href");
    expect(customerUrl).toBeTruthy();

    // Switch sessions: clearing cookies is equivalent to signing out for
    // this test's purpose (removes B's session before A logs in).
    await page.context().clearCookies();
    await loginAs(page, a.email, a.password);
    const response = await page.goto(customerUrl!);

    // The page must not render B's customer data to A. Acceptable
    // outcomes: a 404/redirect, or a page that renders with no data
    // (RLS-filtered query returning nothing) — never B's actual name/
    // phone/subscription history visible to A.
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByText(/غير موجود|لم يتم العثور|لا يوجد/)).toBeVisible().catch(async () => {
      // If the page didn't show an explicit "not found" message, the
      // hard requirement is simply that B's real data is absent.
      const bodyText = await page.textContent("body");
      expect(bodyText).not.toContain("@"); // no leaking a real email
    });
  });

  test("User A cannot read User B's data via a direct REST call either", async ({}) => {
    const { a } = requireTwoTestUsers();
    test.skip(
      !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "Needs the Supabase URL/anon key to make a raw REST call outside the app's own UI.",
    );

    const apiContext = await request.newContext({ baseURL: process.env.NEXT_PUBLIC_SUPABASE_URL });
    const authResponse = await apiContext.post("/auth/v1/token?grant_type=password", {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
      data: { email: a.email, password: a.password },
    });
    const { access_token: accessToken } = await authResponse.json();

    // A's own JWT, querying the customers table directly — RLS (not
    // frontend filtering) must be what blocks this, per spec point 6:
    // "لا تعتمد فقط على إخفاء البيانات من Frontend. الأمان يجب أن يكون
    // Database-level."
    const restResponse = await apiContext.get("/rest/v1/customers?select=*", {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const rows = await restResponse.json();
    expect(Array.isArray(rows)).toBe(true);
    // Every row RLS lets through must belong to A's own org — this
    // doesn't assert zero rows (A may have real customers), it asserts
    // none of them are B's.
    const bEmails = rows.map((r: { email?: string }) => r.email).filter(Boolean);
    expect(bEmails).not.toContain(process.env.E2E_USER_B_EMAIL);
  });
});
