/* Coupon engine — pure logic, no backend, no network. */
import { describe, it, expect, beforeEach } from "vitest";
import { S } from "../helpers/sandbox.mjs";

const mkCoupon = (over = {}) => ({
  code: "T", title: "T", type: "fixed_baht", value: 50, freeItem: "",
  minSpend: 200, brand: "", branchId: "", active: true, startsAt: 0, expiresAt: 0,
  usageLimit: 0, usedCount: 0, ...over,
});

let s;
beforeEach(() => { s = S(); });

describe("couponDiscount", () => {
  it("no coupon applied → 0 discount", () => {
    expect(s.couponDiscount([{ name: "A", price: 300, qty: 1 }])).toBe(0);
  });

  it("percent coupon: 10% of subtotal, rounded", () => {
    s.setCoupon({ ...mkCoupon({ code: "NAEKI10", type: "percent", value: 10, minSpend: 300 }) });
    // 350 subtotal → 35
    expect(s.couponDiscount([{ name: "A", price: 350, qty: 1 }])).toBe(35);
  });

  it("fixed_baht coupon: flat amount off", () => {
    s.setCoupon({ ...mkCoupon({ code: "WELCOME", type: "fixed_baht", value: 50, minSpend: 200 }) });
    expect(s.couponDiscount([{ name: "A", price: 260, qty: 1 }])).toBe(50);
  });

  it("fixed_baht never exceeds the subtotal", () => {
    s.setCoupon({ ...mkCoupon({ code: "WELCOME", type: "fixed_baht", value: 50, minSpend: 40 }) });
    expect(s.couponDiscount([{ name: "A", price: 40, qty: 1 }])).toBe(40);
  });

  it("free_item only discounts the matching item", () => {
    s.setCoupon({ ...mkCoupon({ code: "MATCHA50", type: "free_item", freeItem: "Iced Matcha", minSpend: 0 }) });
    const lines = [{ name: "Onigiri", price: 45, qty: 2 }, { name: "Iced Matcha", price: 60, qty: 1 }];
    expect(s.couponDiscount(lines)).toBe(60);
  });

  it("free_item without the item in cart → 0, with a plain-language problem", () => {
    s.setCoupon({ ...mkCoupon({ code: "MATCHA50", type: "free_item", freeItem: "Iced Matcha", minSpend: 0 }) });
    const lines = [{ name: "Onigiri", price: 45, qty: 2 }];
    expect(s.couponDiscount(lines)).toBe(0);
    expect(s.couponProblem(lines)).toContain("Iced Matcha");
  });
});

describe("coupon gating (couponProblem)", () => {
  it("minSpend below threshold explains the gap in baht", () => {
    s.setCoupon({ ...mkCoupon({ code: "WELCOME", minSpend: 200 }) });
    const why = s.couponProblem([{ name: "A", price: 120, qty: 1 }]);
    expect(why).toContain("80");       // 200 - 120
    expect(why).toContain("WELCOME");
  });

  it("inactive coupon is rejected", () => {
    s.setCoupon({ ...mkCoupon({ code: "OLD", active: false }) });
    expect(s.couponProblem([{ name: "A", price: 500, qty: 1 }])).toContain("no longer active");
  });

  it("expired coupon is rejected", () => {
    s.setCoupon({ ...mkCoupon({ code: "OLD", expiresAt: Date.now() - 1000 }) });
    expect(s.couponProblem([{ name: "A", price: 500, qty: 1 }])).toContain("expired");
  });

  it("not-yet-started coupon is rejected", () => {
    s.setCoupon({ ...mkCoupon({ code: "FUTURE", startsAt: Date.now() + 86400000 }) });
    expect(s.couponProblem([{ name: "A", price: 500, qty: 1 }])).toContain("hasn't started");
  });

  it("exhausted usage limit is rejected", () => {
    s.setCoupon({ ...mkCoupon({ code: "DONE", usageLimit: 100, usedCount: 100 }) });
    expect(s.couponProblem([{ name: "A", price: 500, qty: 1 }])).toContain("fully claimed");
  });

  it("brand-locked coupon rejects carts with nothing from that brand", () => {
    s.setCoupon({ ...mkCoupon({ code: "ASOK5", brand: "go", minSpend: 0 }) });
    // cart of sushi-brand items
    const why = s.couponProblem([{ name: "Salmon Nigiri", price: 120, qty: 1 }]);
    expect(why).toContain("Naeki Go!");
  });

  it("clearCoupon resets everything", () => {
    s.setCoupon({ ...mkCoupon({ code: "WELCOME" }) });
    s.clearCoupon();
    expect(s.couponDiscount([{ name: "A", price: 500, qty: 1 }])).toBe(0);
    expect(s.couponProblem([{ name: "A", price: 500, qty: 1 }])).toBeNull();
  });
});