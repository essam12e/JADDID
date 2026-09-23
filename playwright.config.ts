import { defineConfig, devices } from "@playwright/test";

/**
 * Real E2E suite (Phase 12 follow-up). Split deliberately into two
 * groups by what they need:
 *
 * - e2e/public/**  — no auth, no live Supabase network reachability
 *   required. These run anywhere, including this sandbox.
 * - e2e/authenticated/** — need a real signed-in session (signup, OTP,
 *   onboarding, import, admin actions). They're written for real, not
 *   stubbed, but every one calls test.skip() with an explicit reason
 *   when SUPABASE reachability isn't available, rather than being
 *   silently green for nothing. Run them for real against a deployed
 *   environment or a machine with normal network access, with
 *   E2E_TEST_EMAIL / E2E_TEST_PASSWORD / E2E_ADMIN_EMAIL /
 *   E2E_ADMIN_PASSWORD set.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Pre-installed browser in this sandbox — see AGENT/session notes.
        // Harmless to point at the same binary anywhere Chrome for
        // Testing isn't separately downloaded.
        launchOptions: {
          ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
            ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
            : {}),
          // Many CI/container runners (including this one) run as root,
          // where Chromium refuses its own sandbox. Harmless to disable
          // in a throwaway test browser; never do this for a browser
          // that renders untrusted content.
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run build && npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
