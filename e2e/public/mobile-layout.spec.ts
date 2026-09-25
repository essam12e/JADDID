import { test, expect } from "@playwright/test";

/**
 * Nothing may spill past the right edge of a phone.
 *
 * This caught a real one: a responsive grid written as
 * `grid gap-4 sm:grid-cols-2` has *no* column definition below the `sm`
 * breakpoint, so its single implicit column is sized to the widest item
 * — and one long imported product name stretched every card to 779px on
 * a 390px screen. The page scrolled sideways and names were cut off.
 *
 * `grid-cols-1` (which compiles to `minmax(0, 1fr)`) is the fix; this
 * test is the guard, and it runs without auth so it guards every deploy.
 */
const PHONES = [
  { name: "small", width: 320 },
  { name: "common", width: 390 },
];

const PAGES = ["/", "/pricing", "/login", "/signup", "/forgot-password", "/terms", "/privacy"];

for (const phone of PHONES) {
  for (const path of PAGES) {
    test(`${path} fits a ${phone.name} phone (${phone.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: phone.width, height: 844 });
      await page.goto(path, { waitUntil: "domcontentloaded" });

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        const widest = [...document.querySelectorAll<HTMLElement>("body *")]
          .map((el) => ({
            width: Math.round(el.getBoundingClientRect().width),
            selector: `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(/\s+/).slice(0, 3).join(".")}`,
          }))
          .filter((el) => el.width > doc.clientWidth + 1)
          .sort((a, b) => b.width - a.width)[0];

        return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth, widest };
      });

      expect(
        overflow.scrollWidth,
        `page scrolls sideways; widest element: ${JSON.stringify(overflow.widest)}`,
      ).toBeLessThanOrEqual(overflow.clientWidth + 1);
    });
  }
}
