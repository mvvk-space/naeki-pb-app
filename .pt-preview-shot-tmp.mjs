/* One-off visual check of the partner-portal phone preview: sign in as
   Somchai (franchise owner), open the portal, type an offer, screenshot.
   Throwaway — delete after use. */
import { chromium } from "@playwright/test";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 940 } });
await page.goto("http://127.0.0.1:8931/index.html");
await page.waitForTimeout(2500); // splash
await page.locator("#lp-signin").click();
await page.locator("#signin-name").fill("somchai@naeki.dev");
await page.locator("#signin-pass").fill("Somchai$12345");
await page.locator("#signin-form button[type=submit]").click();
await page.waitForFunction(() => document.body.dataset.mode === "app", null, { timeout: 15000 });
await page.waitForTimeout(1200);
await page.locator('.side-link[data-view="partners"]').click();
await page.waitForTimeout(600);
if (await page.locator('[data-ptrole="franchisee"]').count()) {
  await page.locator('[data-ptrole="franchisee"]').click();
  await page.waitForTimeout(500);
}
await page.locator("#pt-title").fill("Free iced matcha with any onigiri");
await page.locator("#pt-text").fill("Today only — buy any onigiri, get an iced matcha on us. Show the bell.");
await page.locator("#pt-cta-label").fill("Order on LINE");
await page.waitForTimeout(300);
await page.locator(".phone-frame").scrollIntoViewIfNeeded();
await page.screenshot({ path: ".pt-preview-1-tmp.png" });
await page.locator("#pt-type").selectOption("event");
await page.locator("#pt-when").fill("Fri 11:30–14:00");
await page.waitForTimeout(400);
await page.screenshot({ path: ".pt-preview-2-tmp.png" });
await browser.close();
console.log("done");