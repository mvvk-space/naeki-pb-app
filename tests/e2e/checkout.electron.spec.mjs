/* Electron e2e: the full app with the real Neon-backed API behind it.
   Flow 1: sign in as kate (customer) -> app shell
   Flow 2: add to cart -> coupon NAEKI10 -> checkout -> receipt */
import { test, expect } from "@playwright/test";
import { launchApp } from "./helpers/electron-app.mjs";

let app, win;

test.beforeAll(async () => {
  ({ app, win } = await launchApp());
});

test.afterAll(async () => {
  await app?.close();
});

test("sign-in swaps to the app shell and greets the user", async () => {
  await expect(win.locator("body")).toHaveAttribute("data-mode", "landing", { timeout: 15000 });
  await win.locator("#lp-signin").click();
  await win.locator("#signin-name").fill("kate@naeki.dev");
  await win.locator("#signin-pass").fill("Kate$12345");
  await win.locator("#signin-form button[type=submit]").click();
  await expect(win.locator("body")).toHaveAttribute("data-mode", "app", { timeout: 15000 });
  await expect(win.locator("#session-greeting")).toContainText("Kate");
});

test("cart: add, apply NAEKI10, checkout, receipt", async () => {
  test.setTimeout(60_000);
  // sign in first (kate) — cart checkout is signed-in behavior
  if (await win.locator("body[data-mode=landing]").count()) {
    await win.locator("#lp-signin").click();
    await win.locator("#signin-name").fill("kate@naeki.dev");
    await win.locator("#signin-pass").fill("Kate$12345");
    await win.locator("#signin-form button[type=submit]").click();
    await expect(win.locator("body")).toHaveAttribute("data-mode", "app");
  }

  // go to the order view's menu segment and add a dish (default brand is
  // Naeki GO! — pick a GO! item; the sushi-brand menu is a brand toggle away).
  // Scoped to the app shell: the hidden landing shell also has .view.active
  // sections with display-only dish cards (no steppers) that would win .first().
  const dish = win.locator("#main .view.active .dish", { hasText: "Roasted Salmon" }).first();
  await dish.locator(".d-plus").click();
  await expect(win.locator("#cart-badge")).not.toBeHidden();
  await expect(win.locator("#cart-badge")).toHaveText(/^([1-9]|10)$/);

  // open the cart pane
  await win.locator('[data-view="cart"]').first().click();
  const cartRoot = win.locator("#cart-root");
  await expect(cartRoot).toBeVisible();

  // apply a validated coupon via the PB-backed entry
  const code = win.locator("#cpn-code");
  if (await code.count()) {
    await code.fill("NAEKI10");
    await win.locator("#cpn-form button[type=submit]").click();
    await expect(win.locator("#cart-root")).toContainText("NAEKI10", { timeout: 8000 });
  }

  // checkout -> receipt paints with points
  await win.locator("#cart-checkout").click();
  const receipt = win.locator(".cart-receipt");
  await expect(receipt).toBeVisible({ timeout: 10000 });
  await expect(receipt).toContainText(/points/i);
  await expect(receipt).toContainText(/NK-/);
  // cart is emptied
  await expect(win.locator("#cart-badge")).toBeHidden();
});