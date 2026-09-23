import { test } from "@playwright/test";

/**
 * Every authenticated-flow test needs a real signed-in session against a
 * real Supabase project. This sandbox's outbound network is blocked to
 * *.supabase.co (confirmed directly — same limitation the README
 * documents for every phase since Phase 3), so these can only be
 * *written* correctly here, not *run* here. Call this at the top of a
 * test (or describe block) to skip with an honest reason instead of
 * either faking a pass or deleting the test.
 *
 * To actually run this suite: deploy, or use a machine with normal
 * network access, and set:
 *   E2E_TEST_EMAIL / E2E_TEST_PASSWORD   — a verified, non-admin user
 *   E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD — a verified platform_role=admin user
 */
/**
 * A dedicated opt-in flag for "this run can actually reach
 * *.supabase.co" — deliberately NOT inferred from E2E_BASE_URL, which
 * just points Playwright at a running app (may be this very sandbox,
 * pointed at localhost, with zero live Supabase reachability).
 */
export function requireLiveSupabaseNetwork() {
  test.skip(
    process.env.E2E_LIVE_SUPABASE !== "1",
    "Set E2E_LIVE_SUPABASE=1 only when this run's network can actually reach *.supabase.co (a real signup call is about to be made).",
  );
}

export function requireTestUser() {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  test.skip(
    !email || !password,
    "E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set — needs a live Supabase-reachable environment with a real verified test account.",
  );
  return { email: email!, password: password! };
}

export function requireAdminUser() {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(
    !email || !password,
    "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set — needs a live Supabase-reachable environment with a real verified admin account.",
  );
  return { email: email!, password: password! };
}

export function requireTwoTestUsers() {
  const aEmail = process.env.E2E_USER_A_EMAIL;
  const aPassword = process.env.E2E_USER_A_PASSWORD;
  const bEmail = process.env.E2E_USER_B_EMAIL;
  const bPassword = process.env.E2E_USER_B_PASSWORD;
  test.skip(
    !aEmail || !aPassword || !bEmail || !bPassword,
    "E2E_USER_A_* / E2E_USER_B_* not set — spec point 71's mandatory isolation test needs two distinct real accounts, each with at least one store/customer, on a live Supabase-reachable environment.",
  );
  return { a: { email: aEmail!, password: aPassword! }, b: { email: bEmail!, password: bPassword! } };
}

export async function loginAs(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("/login");
  await page.getByLabel("البريد الإلكتروني").fill(email);
  await page.getByLabel("كلمة المرور", { exact: true }).fill(password);
  await page.getByRole("button", { name: "تسجيل الدخول" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
}
