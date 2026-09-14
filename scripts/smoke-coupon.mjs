// Throwaway smoke harness for the coupon pass: loads data.js + store.js + pb.js
// in a sandbox with a localStorage stub and drives apply → checkout against the
// LIVE PocketBase. Run: node scripts/smoke-coupon.mjs
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

// minimal browser shims
const mem = new Map();
const sandbox = {
  console,
  fetch: globalThis.fetch.bind(globalThis),
  setTimeout, clearTimeout, setInterval, clearInterval,
  structuredClone,
  Date,
  Math,
  localStorage: {
    getItem: k => mem.has(k) ? mem.get(k) : null,
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: k => mem.delete(k),
  },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);
for (const f of ["data.js", "pb.js", "store.js"]) {
  vm.runInContext(fs.readFileSync(path.join(root, "src", f), "utf8"), ctx, { filename: f });
}

const S = sandbox.window.NaekiStore;
const PB = sandbox.window.NaekiPB;
let fails = 0;
const ok = (name, cond, extra = "") => {
  if (cond) console.log("  ✓", name);
  else { fails++; console.log("  ✗", name, extra); }
};
const add = (name, price, qty) => { for (let i = 0; i < qty; i++) S.addToCart(name, price); };
const mkCoupon = (over = {}) => ({
  code: "T", title: "T", type: "fixed_baht", value: 50, freeItem: "", minSpend: 200,
  brand: "", branchId: "", active: true, startsAt: 0, expiresAt: 0,
  usageLimit: 0, usedCount: 0, ...over
});

// ---- live pb: coupon lookup ----
console.log("pb coupon lookups (live PocketBase):");
ok("couponByCode finds NAEKI10", (await PB.couponByCode("naeki10"))?.code === "NAEKI10");
ok("couponByCode unknown → null", (await PB.couponByCode("NOPE123")) === null);
ok("couponByCode empty → null", (await PB.couponByCode("  ")) === null);

// ---- apply + validate against a real store cart ----
console.log("store coupon validation:");
add("Tuna Mayo Onigiri", 35, 4);      // 140 — under the ฿200 minimum
add("Salmon Nigiri", 45, 1);          // +45 = 185
S.setCoupon(mkCoupon());
ok("minSpend unmet → discount 0", S.couponDiscount(S.cart()) === 0);
ok("minSpend problem is readable", /more — coupon T needs/.test(S.couponProblem(S.cart()) || ""));

add("Salmon Nigiri", 45, 2);          // +90 → 275
ok("minSpend met → fixed ฿50 off", S.couponDiscount(S.cart()) === 50, `got ${S.couponDiscount(S.cart())}`);

S.setCoupon(mkCoupon({ code: "P", type: "percent", value: 10, minSpend: 0 }));
ok("percent 10% of 275 → 28 (rounded)", S.couponDiscount(S.cart()) === 28, `got ${S.couponDiscount(S.cart())}`);

S.setCoupon(mkCoupon({ code: "F", type: "free_item", freeItem: "Iced Matcha", minSpend: 0 }));
ok("free item missing → problem explains", /Add the Iced Matcha/.test(S.couponProblem(S.cart()) || ""));
add("Iced Matcha", 55, 1);
ok("free item present → its price off (55)", S.couponDiscount(S.cart()) === 55, `got ${S.couponDiscount(S.cart())}`);

S.setCoupon(mkCoupon({ code: "X", active: false, minSpend: 0 }));
ok("inactive → no discount", S.couponDiscount(S.cart()) === 0);
S.setCoupon(mkCoupon({ code: "X", expiresAt: Date.now() - 1000, minSpend: 0 }));
ok("expired → no discount", S.couponDiscount(S.cart()) === 0);
S.setCoupon(mkCoupon({ code: "X", usageLimit: 5, usedCount: 5, minSpend: 0 }));
ok("fully claimed → no discount", S.couponDiscount(S.cart()) === 0);

// ---- checkout consumes the coupon ----
console.log("checkout integration:");
S.setCoupon(mkCoupon({ code: "WELCOME", value: 50, minSpend: 200 }));
const subtotal = S.cart().reduce((t, l) => t + l.price * l.qty, 0);   // 275+55 = 330
const receipt = S.checkoutCart("onigiri");
ok("receipt carries subtotal 330", receipt.subtotal === 330, `got ${receipt?.subtotal}`);
ok("receipt total = 330 − 50 = 280", receipt.total === 280, `got ${receipt?.total}`);
ok("receipt couponCode recorded", receipt.couponCode === "WELCOME");
ok("loyalty history carries the code", S.loyalty().history[0].couponCode === "WELCOME");
ok("coupon cleared after use", S.couponState() === null);
ok("points earned on discounted total", receipt.pointsEarned === Math.round(280 / 10), `got ${receipt.pointsEarned}`);

// coupon that doesn't fit stays applied, order goes through undiscounted
add("Tuna Mayo Onigiri", 35, 1);
S.setCoupon(mkCoupon({ code: "STAY", value: 100, minSpend: 999 }));
const r2 = S.checkoutCart(null);
ok("unusable coupon dropped at checkout", r2.couponDropped === "STAY" && r2.discount === 0);
ok("unusable coupon stays applied for next order", S.couponState()?.code === "STAY");

console.log(fails ? `\n${fails} FAILURE(S)` : "\nALL PASS");
process.exit(fails ? 1 : 0);