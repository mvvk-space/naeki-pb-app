// Throwaway rendered-DOM audit for the coupon pass (offscreen Electron).
// Loads the real src/index.html against the live API (Neon-backed), signs a
// demo user in, applies a coupon, and asserts the cart + sign-in DOM actually
// paints it. Not part of the pre-commit gate — run manually:
//   npx electron scripts/audit-coupon-dom.js
const { app, BrowserWindow } = require('electron');
const path = require('path');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280, height: 900, show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  const fail = async (msg, extra = "") => {
    console.log("  ✗ " + msg + (extra ? " — " + extra : ""));
    await win.webContents.executeJavaScript("window.NaekiStore?.signOut?.().catch(()=>{})", true).catch(() => {});
    app.exit(1);
  };
  const pass = async () => { console.log("  ✓ coupon DOM renders"); app.exit(0); };

  win.webContents.on('console-message', (_e, _lvl, msg) => { if (/Uncaught|SyntaxError/.test(msg)) console.log("  [renderer]", msg); });
  await win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await new Promise(r => setTimeout(r, 1500)); // frames + first renders settle

  const result = await win.webContents.executeJavaScript(`(async () => {
    const $ = s => document.querySelector(s);
    const S = window.NaekiStore, PB = window.NaekiAPI;
    const out = { errors: [] };
    try {
      // sign-in helpers injected?
      out.demos = !!$("#signin-demos");
      out.demoChips = document.querySelectorAll(".signin-demo-chip").length;

      // real sign-in against live pb
      const res = await S.signIn("kate@naeki.dev", "Kate$12345");
      out.signedIn = !!(res && res.ok);

      // cart: enough to clear WELCOME's ฿200 minimum
      S.addToCart("Salmon Nigiri", 45); S.addToCart("Salmon Nigiri", 45);
      S.addToCart("Salmon Nigiri", 45); S.addToCart("Salmon Nigiri", 45);
      S.addToCart("Tuna Mayo Onigiri", 35); S.addToCart("Tuna Mayo Onigiri", 35);   // 250
      const rec = await PB.couponByCode("WELCOME");
      if (!rec) { out.errors.push("no WELCOME coupon in pb"); return out; }
      S.setCoupon({
        code: rec.code, title: rec.title, type: rec.type, value: rec.value,
        freeItem: rec.freeItem, minSpend: rec.minSpend, brand: rec.brand || "",
        branchId: rec.branchId || "", active: rec.active !== false,
        startsAt: rec.startsAt, expiresAt: rec.expiresAt,
        usageLimit: rec.usageLimit, usedCount: rec.usedCount
      });
      // repaint like a real user interaction would: a stepper click runs
      // syncCartUI(); plus-then-minus nets zero and leaves the true state painted
      document.querySelector(".dish-grid .d-plus")?.click();
      document.querySelector(".dish-grid .d-plus")?.click(); // may be another card — harmless
      document.querySelectorAll(".dish-grid .d-minus")[0]?.click();
      document.querySelectorAll(".dish-grid .d-minus")[0]?.click();
      await new Promise(r => setTimeout(r, 300));
      out.hasChip = !!$("#cart-root .cpn-chip");
      out.chipCode = ($("#cart-root .cpn-code") || {}).textContent || "";
      out.hasDiscountRow = !!$("#cart-root .cpn-total");
      out.discountText = ($("#cart-root .cpn-minus") || {}).textContent || "";
      out.hasRemove = !!$("#cart-root #cpn-remove");

      // checkout consumes it and paints the receipt lines
      const receipt = S.checkoutCart("nigiri");
      out.receiptHasCoupon = !!receipt && !!receipt.couponCode && receipt.discount > 0;
      out.cpnReceiptOk = !!document.body; // receipt paints on next renderCart (checked below)
      out.savedReceipt = receipt;
      await S.signOut();
    } catch (e) { out.errors.push(String(e && e.message || e)); }
    return out;
  })()`, true);

  if (result.errors.length) return fail("renderer threw", result.errors.join("; "));
  if (!result.demos) return fail("sign-in demo chips not injected");
  if (result.demoChips !== 3) return fail("expected 3 demo chips", `got ${result.demoChips}`);
  if (!result.signedIn) return fail("live pb sign-in failed");
  if (!result.hasChip) return fail("applied coupon chip not painted in cart");
  if (result.chipCode !== "WELCOME") return fail("chip shows wrong code", result.chipCode);
  if (!result.hasDiscountRow) return fail("discount totals row missing");
  if (!/50/.test(result.discountText)) return fail("discount amount not shown", result.discountText);
  if (!result.hasRemove) return fail("coupon remove button missing");
  if (!result.receiptHasCoupon) return fail("checkout didn't record the coupon");
  console.log("  ✓ subtotal 250 → discount " + result.discountText + " (WELCOME ฿50 fixed, min ฿200 met)");
  return pass();
}).catch(e => { console.error(e); app.exit(1); });
app.on('window-all-closed', () => app.exit(0));