/* Loyalty math (pointsFor / tiers) from data.js + checkout earning flow in store.js. */
import { describe, it, expect, beforeEach } from "vitest";
import { S, D } from "../helpers/sandbox.mjs";

let d, s;
beforeEach(() => { d = D(); s = S(); });

describe("pointsFor (data.js)", () => {
  it("base rate: 1 pt per 10฿", () => {
    expect(d.pointsFor(456)).toBe(45);        // floor(45.6)
  });

  it("tier multiplier applies", () => {
    expect(d.pointsFor(456, d.tierMultOf(d.tierFor(400)))).toBe(57); // maguro ×1.25 → floor(57)
  });

  it("points-day multiplier doubles", () => {
    expect(d.pointsFor(456, 1, 2)).toBe(91);  // floor(91.2)
  });

  it("validate.mjs's own invariant: 456฿ × 1.25 × 2 → 114 pts", () => {
    expect(d.pointsFor(456, 1.25, 2)).toBe(114);
  });

  it("tier boundaries: 0→kome, 350→maguro", () => {
    expect(d.tierFor(0).id).toBe("kome");
    expect(d.tierFor(350).id).toBe("maguro");
    expect(d.tierFor(99).id).toBe("kome");
    expect(d.tierFor(100).id).toBe("sake");
    expect(d.tierFor(600).id).toBe("ikura");
  });

  it("tier multipliers ladder 1 / 1.1 / 1.25 / 1.5", () => {
    expect(d.tierMultOf(d.tierFor(0))).toBe(1);
    expect(d.tierMultOf(d.tierFor(100))).toBe(1.1);
    expect(d.tierMultOf(d.tierFor(300))).toBe(1.25);
    expect(d.tierMultOf(d.tierFor(600))).toBe(1.5);
  });
});

describe("checkout earning (store.js)", () => {
  it("checkout earns points, clears cart, records history", () => {
    s.topUp(500);                      // wallet covers the order
    s.setUseWallet(true);
    s.addToCart("Salmon Nigiri", 120);
    const before = s.loyalty().points;
    const r = s.checkoutCart();
    expect(r).toBeTruthy();
    expect(r.count).toBe(1);
    expect(r.pointsEarned).toBeGreaterThan(0);
    expect(r.pointsEarned).toBe(Math.floor(r.total * 0.1)); // kome tier, no day mult (Tue in test env unknown → assert formula with mult=1 minimum)
    expect(s.cart().length).toBe(0);
    expect(s.loyalty().points).toBe(before + r.pointsEarned);
    expect(s.loyalty().history[0].total).toBe(r.total);
  });

  it("points never float", () => {
    s.topUp(1000);
    s.addToCart("Cheeky Roll", 333);
    const r = s.checkoutCart();
    expect(Number.isInteger(r.pointsEarned)).toBe(true);
  });

  it("coupon consumed on successful checkout, single-use", () => {
    s.topUp(1000);
    s.setCoupon({ code: "WELCOME", type: "fixed_baht", value: 50, minSpend: 200, active: true });
    s.addToCart("Platter", 300);
    const r = s.checkoutCart();
    expect(r.discount).toBe(50);
    expect(r.couponCode).toBe("WELCOME");
    expect(r.total).toBe(250);
    // coupon is gone after use
    expect(s.couponDiscount([{ name: "X", price: 500, qty: 1 }])).toBe(0);
  });

  it("wallet pays first when opted in, and the receipt says so", () => {
    s.topUp(100);
    s.setUseWallet(true);
    s.addToCart("Bento", 260);
    const r = s.checkoutCart();
    expect(r.walletSpent).toBe(100);
    expect(r.paidByWallet).toBe(true);
    expect(r.total).toBe(260);          // total is pre-wallet; walletSpent covers the rest
    expect(s.get().wallet.balance).toBe(0);
    expect(s.loyalty().history[0].couponCode).toBeNull();
  });

  it("wallet opt-out skips wallet payment", () => {
    s.topUp(500);
    s.setUseWallet(false);
    s.addToCart("Bento", 260);
    const r = s.checkoutCart();
    expect(r.walletSpent).toBe(0);
    expect(r.paidByWallet).toBe(false);
  });
});

describe("redeemPoints", () => {
  it("converts 1 pt → 1฿ into the wallet", () => {
    s.topUp(0);
    const l = s.loyalty();
    // seed points directly through a checkout
    s.topUp(1000);
    s.setUseWallet(false);
    s.addToCart("Big Set", 800);
    s.checkoutCart();
    const before = s.loyalty().points;
    const r = s.redeemPoints(50);
    expect(r).toBeTruthy();
    expect(r.baht).toBe(50);
    expect(s.loyalty().points).toBe(before - 50);
  });

  it("refuses to overdraw", () => {
    expect(s.redeemPoints(999999)).toBeNull();
    expect(s.redeemPoints(0)).toBeNull();
    expect(s.redeemPoints(-5)).toBeNull();
  });
});