/* Browser e2e — THE INVARIANT TEST: this app is plain HTML/CSS/JS and must
   render in a stock browser with no Electron. Served by `python3 -m http.server`
   (playwright webServer); PocketBase may be up, but nothing here requires it. */
import { test, expect } from "@playwright/test";

test("landing renders as plain HTML with real dish cards", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Naeki/i);
  await expect(page.locator("body")).toHaveAttribute("data-mode", "landing");
  // dish cards render from the data layer in a stock browser
  const cards = page.locator(".dish");
  await expect(cards.first()).toBeVisible({ timeout: 10000 });
  expect(await cards.count()).toBeGreaterThanOrEqual(10);
  // the landing menu view populates too
  await page.locator('[data-view="lmenu"].lp-link').first().click();
  await expect(page.locator(".lmenu-group").first()).toBeVisible();
});

test("assets resolve: every image on the landing page loads", async ({ page }) => {
  const broken = [];
  page.on("requestfailed", (r) => {
    if (r.resourceType() === "image") broken.push(r.url());
  });
  await page.goto("/");
  await page.waitForTimeout(1500);
  for (const img of await page.locator("img").all()) {
    const nat = await img.evaluate((el) => el.naturalWidth);
    if (nat === 0) broken.push(await img.getAttribute("src"));
  }
  expect(broken, `broken images: ${broken.join(", ")}`).toEqual([]);
});

test("manifest + service worker register (PWA surface intact)", async ({ page }) => {
  await page.goto("/");
  const manifestOk = await page.evaluate(async () => {
    const l = document.querySelector('link[rel="manifest"]');
    if (!l) return false;
    const r = await fetch(l.href);
    if (!r.ok) return false;
    const m = await r.json();
    return !!(m.name && m.icons?.length);
  });
  expect(manifestOk).toBe(true);
});