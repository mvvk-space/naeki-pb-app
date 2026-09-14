// NAEKI-PB FULL SEED — idempotent. Models the whole Naeki business in PocketBase.
// Usage: node scripts/seed.mjs http://127.0.0.1:8090
"use strict";
const BASE = process.argv[2] || "http://127.0.0.1:8090";
const SUPER = { identity: "admin@naeki.dev", password: "Naeki$Dev123" };

async function json(url, opts = {}) {
  // transient "collection not ready" after a just-created collection → retry
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, {
      ...opts,
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    });
    const body = await r.json().catch(() => ({}));
    if (r.status === 404 && /collection context/i.test(body.message || "") && i < 4) {
      await new Promise(res => setTimeout(res, 300));
      continue;
    }
    return { ok: r.ok, status: r.status, body };
  }
  return { ok: false, status: 404, body: {} };
}

async function main() {
  const au = await json(`${BASE}/api/collections/_superusers/auth-with-password`, {
    method: "POST", body: JSON.stringify(SUPER),
  });
  if (!au.ok) throw new Error("superuser auth failed: " + JSON.stringify(au.body));
  const H = { Authorization: au.body.token };
  const ADMIN = await (await fetch(`${BASE}/api/collections`, { headers: H })).json();
  const have = new Set(ADMIN.items.map(c => c.name));
  const users_id = ADMIN.items.find(c => c.name === "users")?.id;
  if (!have.has("users")) throw new Error("users auth collection missing");

  async function ensureCol(name, fields, rules, opts={}) {
    let cid = null;
    if (!have.has(name)) {
      const c = await json(`${BASE}/api/collections`, {
        method: "POST", headers: H,
        body: JSON.stringify({ name, type: "base", fields, ...opts }),
      });
      if (!c.ok) throw new Error(`create ${name}: ${JSON.stringify(c.body)}`);
      cid = c.body.id;
    } else {
      cid = ADMIN.items.find(c => c.name === name).id;
    }
    if (rules) {
      for (const [rn, val] of Object.entries(rules)) {
        await json(`${BASE}/api/collections/${cid}`, { method: "PATCH", headers: H, body: JSON.stringify({ [rn]: val }) });
      }
    }
    return cid;
  }
  // patch a single field into an existing collection
  async function ensureField(name, field) {
    if (!have.has(name)) return;
    const cid = ADMIN.items.find(c => c.name === name).id;
    const col = await (await fetch(`${BASE}/api/collections/${cid}`, { headers: H })).json();
    if (!col.fields.some(f => f.name === field.name)) {
      const r = await json(`${BASE}/api/collections/${cid}`, { method: "PATCH", headers: H, body: JSON.stringify({ fields: [...col.fields, field] }) });
      if (!r.ok) throw new Error(`add field ${name}.${field.name}: ${JSON.stringify(r.body)}`);
    }
  }
  async function upsertRecord(col, data, matchFn) {
    const all = await (await fetch(`${BASE}/api/collections/${col}/records?perPage=2000`, { headers: H })).json();
    const existing = (all.items || []).find(matchFn);
    if (existing) return existing;
    const r = await json(`${BASE}/api/collections/${col}/records`, { method: "POST", headers: H, body: JSON.stringify(data) });
    if (!r.ok) throw new Error(`upsert ${col}: ${JSON.stringify(r.body)}`);
    return r.body;
  }

  /* ============ 1. USERS + ROLES ============ */
  // add a role field to the users auth collection
  await ensureField("users", { name: "role", type: "select", values: ["customer","franchise_owner","admin","superadmin"], maxSelect: 1 });
  await ensureField("users", { name: "branch_id", type: "text", max: 120 });

  async function seedUser(email, name, role, branchId="") {
    const all = await (await fetch(`${BASE}/api/collections/users/records?perPage=2000`, { headers: H })).json();
    if (!(all.items||[]).some(u => u.email === email)) {
      const pass = name.replace(/[^a-zA-Z]/g,"") + "$12345";
      const r = await json(`${BASE}/api/collections/users/records`, { method: "POST", headers: H,
        body: JSON.stringify({ email, password: pass, passwordConfirm: pass, name, role, branch_id: branchId }) });
      if (r.ok) console.log("  user", email, "role", role);
      else console.warn("  user fail", email, r.status, JSON.stringify(r.body));
    }
    return email;
  }
  console.log("Seeding roles/users…");
  await seedUser("kate@naeki.dev", "Kate", "customer");
  await seedUser("leo@naeki.dev", "Leo", "customer");
  await seedUser("may@naeki.dev", "May", "customer");
  // franchise owners (each manages one branch)
  await seedUser("somchai@naeki.dev", "Somchai", "franchise_owner", "Naeki Go! @ BTS Asok");
  await seedUser("niran@naeki.dev", "Niran", "franchise_owner", "Naeki Sushi @ BTS Siam");
  await seedUser("malee@naeki.dev", "Malee", "franchise_owner", "NAEKI GO! Central Bangrak");
  // marketing admins (approve notifications)
  await seedUser("admin@naeki.dev", "Admin", "superadmin");
  await seedUser("marketing@naeki.dev", "Marketing", "admin");
  // a second superadmin for approval
  await seedUser("super@naeki.dev", "Super", "superadmin");

  /* ============ 2. BRANCHES (full) ============ */
  console.log("Seeding branches…");
  const branches = [
    { name:"Naeki Sushi @ BTS Siam", kind:"flagship", area:"BTS Siam · Pathum Wan", where:"BTS Siam station concourse, Rama I Rd", close:"21:00", phone:"02 658 4001", brand:"sushi", note:"The 4.7★ original take-away & delivery counter, 171+ photos." },
    { name:"Naeki Sushi @ MRT Chatuchak (JJ)", kind:"flagship", area:"MRT Chatuchak", where:"Metro Mall, MRT Blue Line", close:"20:00", phone:"063 228 7980", brand:"sushi", note:"Metro-mall counter, 5.0★ from 56 reviews." },
    { name:"Naeki Sushi @ BTS Sala Daeng", kind:"flagship", area:"BTS Sala Daeng · Silom", where:"BTS Sala Daeng station", close:"20:00", brand:"sushi" },
    { name:"Naeki Sushi Empire Tower", kind:"flagship", area:"Sathorn", where:"Empire Tower, Unit 208, 2nd Fl., South Sathorn Rd", close:"19:30", phone:"02 286 2157", brand:"sushi" },
    { name:"Naeki Go @ BTS Asok", kind:"go", area:"BTS Asok · Sukhumvit", where:"Sukhumvit station", close:"20:00", brand:"go" },
    { name:"Naeki GO! @ BTS Chong Non-Si", kind:"go", area:"BTS Chong Non-Si · Narathiwat", where:"BTS Chong Nonsi (S3)", close:"18:00", brand:"go" },
    { name:"Naeki GO! Park Silom", kind:"go", area:"Silom", where:"Park Silom building, Si Lom Rd (Foodland entrance)", close:"21:00", phone:"062 648 4629", brand:"go", note:"4.8★ — B1 by the Foodland entrance." },
    { name:"Naeki Go @ BTS Mochit", kind:"go", area:"BTS Mo Chit", where:"Pre-tap-tap fare zone, exits 3–4", close:"20:00", brand:"go" },
    { name:"Naeki GO @ The Trendy", kind:"go", area:"Sukhumvit 13", where:"The Trendy Office, 1st floor", close:"18:00", brand:"go" },
    { name:"NAEKI GO! PUNN Tower", kind:"go", area:"Rama IV", where:"PUNN Tower, Rama IV", close:"18:00", brand:"go" },
    { name:"NAEKI GO! Central Bangrak", kind:"go", area:"Bang Rak", where:"Central Bangrak", close:"20:00", brand:"go" },
    { name:"Naeki Go! @ BTS Saint Louis", kind:"go", area:"BTS Saint Louis · Sathorn", where:"South Sathorn Rd", close:"18:30", brand:"go" },
    { name:"Naeki GO! Chamchuri Square", kind:"go", area:"Sam Yan · Chula", where:"Chamchuri Square, floor B", close:"20:00", brand:"go" },
    { name:"Naeki Go! Sindhorn", kind:"go", area:"Wireless Rd · Ploenchit", where:"Sindhorn Building 3, 1st floor, Witthayu Rd", close:"17:00", brand:"go" },
    { name:"Naeki Go! Rasa Two", kind:"go", area:"Phetchaburi", where:"Rasa Two, Phetchaburi Rd", close:"19:00", brand:"go" },
    { name:"Naeki Go! One Pacific Place", kind:"go", area:"Sukhumvit 6", where:"One Pacific Place", close:null, brand:"go" },
    { name:"Naeki Go @ The Offices at CentralWorld", kind:"go", area:"Ratchaprasong", where:"The Offices at CentralWorld", close:"19:30", brand:"go" },
    { name:"Naeki Go! The PARQ", kind:"go", area:"Rama IV", where:"The PARQ, Rama IV", close:"20:00", brand:"go" },
    { name:"Naeki Go @ Park Ventures", kind:"go", area:"Ploenchit", where:"Park Ventures Ecoplex, Ploenchit", close:"18:30", brand:"go" },
    { name:"Naeki Go! Chula Hospital", kind:"go", area:"Sam Yan · Chula", where:"King Chulalongkorn Memorial Hospital", close:"18:00", brand:"go" },
  ];
  for (const b of branches) {
    await upsertRecord("branch", b, e => e.name === b.name);
  }
  console.log("  branches:", branches.length);

  /* ============ 3. MENU GROUPS + FULL MENU ============ */
  console.log("Seeding menu groups + full menu…");
  const groups = {
    onigiri: { name:"Onigiri", jp:"おにぎり", brand:"go", desc:"The signature. Hand-shaped to order, one-handed convenience." },
    nigiri:  { name:"Nigiri Sushi", jp:"にぎり", brand:"sushi", desc:"Pressed fresh at the counter — reviewers say the fish melts in your mouth." },
    rolls:   { name:"Sushi Rolls", jp:"巻物", brand:"sushi", desc:"Uramaki, hosomaki and futomaki cut to order." },
    sashimi: { name:"Sashimi & Sets", jp:"さしみ", brand:"sushi", desc:"Thick-cut plates for eating now, and nigiri/aburi sets for sharing." },
    don:     { name:"Donburi & Bento", jp:"丼・弁当", brand:"sushi", desc:"Rice bowls and boxed sets — the full meal when one onigiri won't cut it." },
    party:   { name:"Party Sets", jp:"パーティー", brand:"sushi", desc:"Sushi platters for meetings, events and staff giveaways — order in large quantities." },
    drinks:  { name:"Drinks & Sweets", jp:"飲み物・甘味", brand:null, desc:"Cold matcha and coffee plus Japanese-style puddings." },
  };
  // add a menu_group id → text reference mapping to menu_item via group_id
  const fullMenu = [ // group_id, name, price, sub, img, kcal, allergens
    // Onigiri (GO hero)
    { group_id:"onigiri", name:"Chicken Teriyaki Onigiri", price:45, sub:"Grilled chicken, teriyaki", img:"assets/onigiri_roasted_salmon.jpg", kcal:197 },
    { group_id:"onigiri", name:"Roasted Salmon Onigiri", price:45, sub:"Salt-grilled salmon", img:"assets/onigiri_roasted_salmon.jpg", kcal:198 },
    { group_id:"onigiri", name:"Salmon Mayo Onigiri", price:39, sub:"Classic filling", img:"assets/onigiri_salmon_mayo.jpg", kcal:205 },
    { group_id:"onigiri", name:"Salmon Ikura Mayo Onigiri", price:55, sub:"With salmon roe", img:"assets/onigiri_salmon_ikura_mayo.jpg", kcal:203 },
    { group_id:"onigiri", name:"Salmon Teriyaki Onigiri", price:49, sub:"Teriyaki-glazed salmon", img:"assets/onigiri_salmon_mayo.jpg", kcal:200 },
    { group_id:"onigiri", name:"Unagi Onigiri", price:49, sub:"Grilled eel, tare glaze", img:"assets/onigiri_unagi.jpg", kcal:224 },
    { group_id:"onigiri", name:"Tuna Mayo Onigiri", price:35, sub:"The everyday standard", img:"assets/onigiri_tuna_mayo.jpg", kcal:210 },
    { group_id:"onigiri", name:"Mentaiko Onigiri", price:42, sub:"Spiced cod roe", img:"assets/onigiri_mentaiko.jpg", kcal:196 },
    { group_id:"onigiri", name:"Ebiko Salad Onigiri", price:42, sub:"Shrimp roe salad", img:"assets/onigiri_ebiko_salad.jpg", kcal:202 },
    { group_id:"onigiri", name:"Katsuobushi Onigiri", price:39, sub:"Bonito flakes", img:"assets/onigiri_katsuobushi.jpg", kcal:175 },
    { group_id:"onigiri", name:"Shiitake Onigiri", price:40, sub:"Shiitake mushroom", img:"assets/onigiri_katsuobushi.jpg", kcal:174 },
    { group_id:"onigiri", name:"Ume (Plum) Onigiri", price:42, sub:"Japanese pickled plum", img:"assets/onigiri_katsuobushi.jpg", kcal:155 },
    { group_id:"onigiri", name:"Hiyashi Wakame Onigiri", price:42, sub:"Seaweed salad", img:"assets/onigiri_salmon_mayo.jpg", kcal:165 },
    // Nigiri
    { group_id:"nigiri", name:"Salmon Nigiri", price:45, sub:"Fresh, the benchmark", img:"assets/salmon_nigiri.jpg" },
    { group_id:"nigiri", name:"Fatty Salmon Nigiri", price:55, sub:"O-toro salmon", img:"assets/fatty_salmon_nigiri.jpg" },
    { group_id:"nigiri", name:"Salmon Aburi Nigiri", price:49, sub:"Seared salmon", img:"assets/salmon_aburi_nigiri.jpg" },
    { group_id:"nigiri", name:"Maguro Nigiri", price:49, sub:"Tuna", img:"assets/maguro_nigiri.jpg" },
    { group_id:"nigiri", name:"Hamachi Nigiri", price:59, sub:"Yellowtail", img:"assets/fatty_salmon_nigiri.jpg" },
    { group_id:"nigiri", name:"Hotate Nigiri", price:59, sub:"Scallop", img:"assets/hotate_nigiri.jpg" },
    { group_id:"nigiri", name:"Unagi Nigiri", price:59, sub:"Grilled eel", img:"assets/unagi_nigiri.jpg" },
    { group_id:"nigiri", name:"Ikura Nigiri", price:65, sub:"Salmon roe gunkan", img:"assets/ikura_nigiri.jpg" },
    { group_id:"nigiri", name:"Foie Gras Nigiri", price:89, sub:"The indulgent one", img:"assets/fatty_salmon_nigiri.jpg" },
    { group_id:"nigiri", name:"Tobiko Nigiri", price:49, sub:"Flying fish roe", img:"assets/ikura_nigiri.jpg" },
    { group_id:"nigiri", name:"Kanimiso Nigiri", price:49, sub:"Crab miso", img:"assets/roll_california.jpg" },
    { group_id:"nigiri", name:"Inari Nigiri", price:45, sub:"Sweet tofu pouch", img:"assets/don_hotate.jpg" },
    // Rolls
    { group_id:"rolls", name:"Salmon & Crab Uramaki", price:89, sub:"5 pcs, tobiko, tamagoyaki", img:"assets/roll_salmon_uramaki.jpg" },
    { group_id:"rolls", name:"California Maki", price:69, sub:"6 pcs, tobiko mayo", img:"assets/roll_california.jpg" },
    { group_id:"rolls", name:"Aburi Salmon Roll", price:79, sub:"6 pcs, torched salmon", img:"assets/roll_aburi_salmon.jpg" },
    { group_id:"rolls", name:"Unagi Maki", price:75, sub:"7 pcs, avocado, sesame", img:"assets/roll_unagi_maki.jpg" },
    { group_id:"rolls", name:"Futomaki", price:65, sub:"5 pcs, the thick roll", img:"assets/roll_futomaki.jpg" },
    { group_id:"rolls", name:"Vegetarian Futomaki", price:60, sub:"5 pcs, vegetable", img:"assets/roll_california.jpg" },
    { group_id:"rolls", name:"Tuna Hosomaki", price:55, sub:"6 pcs, small tuna roll", img:"assets/maguro_nigiri.jpg" },
    { group_id:"rolls", name:"Kampyo Hosomaki", price:45, sub:"6 pcs, gourd roll", img:"assets/roll_california.jpg" },
    { group_id:"rolls", name:"Salmon Hosomaki", price:55, sub:"6 pcs", img:"assets/salmon_nigiri.jpg" },
    { group_id:"rolls", name:"Kanikama Hosomaki", price:45, sub:"6 pcs, crab stick", img:"assets/roll_california.jpg" },
    { group_id:"rolls", name:"Tamagoyaki Hosomaki", price:45, sub:"6 pcs, sweet egg", img:"assets/roll_california.jpg" },
    // Sashimi
    { group_id:"sashimi", name:"Salmon Sashimi", price:129, sub:"150g, shiso & daikon", img:"assets/sashimi_salmon.jpg" },
    { group_id:"sashimi", name:"Salmon Sashimi 300g", price:259, sub:"Double portion", img:"assets/sashimi_salmon.jpg" },
    { group_id:"sashimi", name:"Aburi Salmon Sashimi", price:149, sub:"6 cuts, seared", img:"assets/sashimi_aburi.jpg" },
    { group_id:"sashimi", name:"Maguro Sashimi", price:139, sub:"6 cuts, tuna", img:"assets/sashimi_maguro.jpg" },
    { group_id:"sashimi", name:"Hamachi Sashimi", price:149, sub:"6 cuts, yellowtail", img:"assets/sashimi_maguro.jpg" },
    { group_id:"sashimi", name:"Ikura Sashimi", price:129, sub:"Salmon roe 50g", img:"assets/ikura_nigiri.jpg" },
    { group_id:"sashimi", name:"Hiyashi Wakame", price:69, sub:"Seaweed salad 50g", img:"assets/sashimi_salmon.jpg" },
    // Don & Bento
    { group_id:"don", name:"Ultimate Chirashi Don", price:259, sub:"Nine toppings", img:"assets/don_chirashi_ultimate.jpg" },
    { group_id:"don", name:"Salmon & Ikura Don", price:189, sub:"The house favourite", img:"assets/don_salmon_ikura.jpg" },
    { group_id:"don", name:"Salmon Aburi Don", price:199, sub:"Seared salmon bowl", img:"assets/don_hotate.jpg" },
    { group_id:"don", name:"Unagi Don", price:199, sub:"Grilled eel bowl", img:"assets/don_unagi.jpg" },
    { group_id:"don", name:"Seared Scallop Don", price:189, sub:"Hotate aburi", img:"assets/don_hotate.jpg" },
    { group_id:"don", name:"Duo Don (Salmon Avocado)", price:179, sub:"Salmon, avocado, tobiko", img:"assets/don_salmon_ikura.jpg" },
    { group_id:"don", name:"Fresh Maguro Don", price:199, sub:"Tuna sashimi bowl", img:"assets/don_chirashi_ultimate.jpg" },
    { group_id:"don", name:"Sashimi Bento Set", price:219, sub:"With miso soup", img:"assets/bento_1.jpg" },
    { group_id:"don", name:"Miso Soup", price:39, sub:"Side", img:"assets/bento_1.jpg" },
    { group_id:"don", name:"Dashi Soup", price:39, sub:"Side", img:"assets/bento_1.jpg" },
    // Party sets
    { group_id:"party", name:"Salmon Nigiri Set", price:149, sub:"4 or 6 pcs", img:"assets/set_nigiri_4.jpg" },
    { group_id:"party", name:"Aburi Salmon Set", price:159, sub:"4 or 6 pcs, seared", img:"assets/set_aburi_4.jpg" },
    { group_id:"party", name:"Assorted Sushi Set", price:259, sub:"Chef's mixed platter", img:"assets/set_assorted.jpg" },
    { group_id:"party", name:"Party Set A", price:599, sub:"Assorted nigiri platter 20 pcs", img:"assets/set_assorted.jpg" },
    { group_id:"party", name:"Party Set B", price:799, sub:"Mixed platter 30 pcs", img:"assets/set_assorted.jpg" },
    { group_id:"party", name:"Party Set C", price:1099, sub:"Large platter 45 pcs", img:"assets/set_assorted.jpg" },
    { group_id:"party", name:"Party Set D", price:1399, sub:"Grand sashimi platter", img:"assets/set_assorted.jpg" },
    { group_id:"party", name:"Grand Sashimi", price:1699, sub:"Signature sashimi platter", img:"assets/sashimi_salmon.jpg" },
    { group_id:"party", name:"Super Sashimi", price:1999, sub:"Luxury sashimi platter", img:"assets/sashimi_salmon.jpg" },
    { group_id:"party", name:"Vegetarian Set", price:129, sub:"Plant-based selection", img:"assets/roll_california.jpg" },
    // Drinks & sweets (shared)
    { group_id:"drinks", name:"Iced Matcha", price:55, sub:"Naeki's matcha", img:"assets/drink_matcha_cold.jpg" },
    { group_id:"drinks", name:"Iced Matcha Latte", price:59, sub:"Iced", img:"assets/drink_matcha_latte.jpg" },
    { group_id:"drinks", name:"Iced Americano", price:49, sub:"For the deadline run", img:"assets/drink_americano.jpg" },
    { group_id:"drinks", name:"Iced Espresso", price:45, sub:"Espresso shot", img:"assets/drink_americano.jpg" },
    { group_id:"drinks", name:"Iced Latte", price:55, sub:"Iced", img:"assets/drink_matcha_latte.jpg" },
    { group_id:"drinks", name:"Iced Mocha", price:59, sub:"Iced", img:"assets/drink_matcha_latte.jpg" },
    { group_id:"drinks", name:"Hot Matcha", price:55, sub:"Hot", img:"assets/drink_matcha_cold.jpg" },
    { group_id:"drinks", name:"Matcha Pudding", price:59, sub:"Japanese-style, light", img:"assets/dessert_matcha_pudding.jpg" },
    { group_id:"drinks", name:"Honey Lemon Pudding", price:52, sub:"Bright finish", img:"assets/dessert_honey_lemon.jpg" },
    { group_id:"drinks", name:"Banana Choco Pudding", price:55, sub:"With chocolate", img:"assets/dessert_banana_choco.jpg" },
    { group_id:"drinks", name:"Sweet Potato Pudding", price:59, sub:"Japanese sweet potato", img:"assets/dessert_matcha_pudding.jpg" },
  ];
  for (const m of fullMenu) {
    await upsertRecord("menu_item", m, e => e.name === m.name && e.price === m.price);
  }
  console.log("  menu items:", fullMenu.length);

  /* ============ 4. COUPONS ============ */
  console.log("Seeding coupons…");
  ensureCol("coupon", [
    { name:"code", type:"text", required:true, max:40 },
    { name:"title", type:"text", max:60 },
    { name:"description", type:"text", max:160 },
    { name:"type", type:"select", values:["fixed_baht","percent","free_item"], maxSelect:1 },
    { name:"value", type:"number" },          // fixed baht or percent amount
    { name:"freeItem", type:"text", max:80 }, // for free_item coupons
    { name:"minSpend", type:"number" },
    { name:"startsAt", type:"number" }, { name:"expiresAt", type:"number" },
    { name:"usageLimit", type:"number" }, { name:"usedCount", type:"number" },
    { name:"branchId", type:"text", max:120 }, // null = all branches
    { name:"brand", type:"text", max:10 },     // coupon may apply to one brand
    { name:"active", type:"bool" },
  ], {
    listRule: "", viewRule: "",               // public read (codes shown in app)
    createRule: "@request.auth.role='superadmin' || @request.auth.role='admin'",
    updateRule: "@request.auth.role='superadmin' || @request.auth.role='admin'",
    deleteRule: "superadmin",
    options: { allowCreate:false, allowUpdate:false, allowDelete:false },
  });
  const coupons = [
    { code:"NAEKI10", title:"10% off your tray", description:"10% off any order over ฿300.", type:"percent", value:10, minSpend:300, usageLimit:1000, active:true, brand:null },
    { code:"MATCHA50", title:"Free iced matcha", description:"Free iced matcha with any onigiri.", type:"free_item", freeItem:"Iced Matcha", minSpend:0, usageLimit:500, active:true, brand:"go" },
    { code:"FRIDAY20", title:"Party set upgrade", description:"20% off party sets over ฿599.", type:"percent", value:20, minSpend:599, usageLimit:200, active:true, brand:"sushi" },
    { code:"WELCOME", title:"Welcome bonus", description:"฿50 off your first order.", type:"fixed_baht", value:50, minSpend:200, usageLimit:2000, active:true, brand:null },
    { code:"OFFICE250", title:"Office tray ฿250 off", description:"฿250 off Assorted Sushi Set (minimum order)".replace(/\)/,""), type:"fixed_baht", value:250, minSpend:600, usageLimit:100, active:true, brand:"sushi" },
    { code:"ASOK5", title:"BTS Asok ฿5 off", description:"฿5 off any onigiri at BTS Asok.", type:"fixed_baht", value:5, minSpend:0, usageLimit:9999, active:true, brand:"go", branchId:"Naeki Go @ BTS Asok", expiresAt: Date.now()+30*86400000 },
  ].map(c => ({ ...c, usedCount: 0, startsAt: Date.now(), expiresAt: c.expiresAt || Date.now()+90*86400000 }));
  for (const c of coupons) {
    await upsertRecord("coupon", c, e => e.code === c.code);
  }
  console.log("  coupons:", coupons.length);

  /* ============ 5. MILESTONES (seven achievements) ============ */
  console.log("Seeding milestones…");
  ensureCol("milestone", [
    { name:"id", type:"text", required:true },
    { name:"kicker", type:"text" }, { name:"title", type:"text" },
    { name:"text", type:"text" }, { name:"pts", type:"number" },
    { name:"jp", type:"text" }, { name:"order", type:"number" },
  ], { listRule: "", viewRule: "", createRule: "@request.auth.role='superadmin'", options:{ allowCreate:false, allowUpdate:false, allowDelete:false } });
  const milestones = [
    { id:"first", kicker:"First bite", title:"Your first order", text:"Welcome in — a one-time bonus.", pts:50, jp:"初注文", order:1 },
    { id:"breadth", kicker:"Full-menu tour", title:"Try all six categories", text:"Rewarded for breadth.", pts:100, jp:"全種類", order:2 },
    { id:"cadence", kicker:"Weekly regular", title:"Order on 7 different days", text:"Showing up is the habit.", pts:150, jp:"常連", order:3 },
    { id:"party", kicker:"Office hero", title:"One order of ฿500+", text:"The tray run for the team.", pts:100, jp:"大皿", order:4 },
    { id:"week", kicker:"This week", title:"Order 3× in one calendar week", text:"A stretch goal past your cadence.", pts:100, jp:"今週", order:5 },
    { id:"friend", kicker:"Give + get", title:"Redeem a friend's referral", text:"When a shared code lands, both sides earn.", pts:100, jp:"紹介", order:6 },
    { id:"lifetime", kicker:"Loyal wallet", title:"Spend ฿1,000 lifetime", text:"Cross the ฿1,000 mark.", pts:200, jp:"生涯", order:7 },
  ];
  for (const m of milestones) await upsertRecord("milestone", m, e => e.id === m.id);
  console.log("  milestones:", milestones.length);

  /* ============ 6. PROMOTIONS — the notification/approval workflow ============ */
  console.log("Seeding promotions (approval workflow)…");
  ensureCol("promotion", [
    { name:"author", type:"relation", maxSelect:1, collectionId:users_id },
    { name:"branch", type:"text", max:120 },
    { name:"type", type:"select", values:["offer","event","update"], maxSelect:1 },
    { name:"title", type:"text" }, { name:"body", type:"text" },
    { name:"ctaLabel", type:"text" }, { name:"ctaUrl", type:"text" },
    { name:"audience", type:"select", values:["everyone","members"], maxSelect:1 },
    { name:"when", type:"text", max:40 },
    { name:"status", type:"select", values:["draft","pending","approved","rejected","sent"], maxSelect:1 },
    { name:"approver", type:"relation", maxSelect:1, collectionId:users_id },
    { name:"reviewNote", type:"text", max:200 },
    { name:"reviewedAt", type:"number" }, { name:"sentAt", type:"number" },
    { name:"created", type:"number" },
    { name:"couponCode", type:"text", max:40 },  // optional linked coupon
    { name:"sendCount", type:"number" },
  ], {
    // only staff roles create; franchise owners compose (blocked from
    // approving their own via updateRule); admins/superadmins review+approve
    createRule: "@request.auth.role='franchise_owner' || @request.auth.role='admin' || @request.auth.role='superadmin'",
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    updateRule: "(@request.auth.role='superadmin' || @request.auth.role='admin') || author = @request.auth.id",
  });
  // seed a couple of demo promotions to show the workflow shape
  await upsertRecord("promotion", {
    author:null, branch:"Naeki Go! @ BTS Asok", type:"offer",
    title:"Free iced matcha with any onigiri", body:"This Friday 11:30–14:00 at BTS Asok.",
    ctaLabel:"Order on LINE", ctaUrl:"https://lin.ee/DqJnedo", audience:"everyone", when:"Fri 11:30–14:00",
    status:"pending", created: Date.now()-2*86400000,
  }, e=>e.title==="Free iced matcha with any onigiri");
  await upsertRecord("promotion", {
    author:null, branch:"Naeki Sushi @ BTS Siam", type:"offer",
    title:"2× points this Thursday", body:"Double points on every order at the Siam counter.",
    ctaLabel:"See rewards", audience:"members", status:"approved", reviewNote:"Looks good.", created: Date.now()-1*86400000, reviewedAt: Date.now()-12*3600000,
  }, e=>e.title==="2× points this Thursday");

  console.log("\n✅ NAEKI DB fully seeded →", BASE);
}

main().catch(e => { console.error("SEED ERROR:", e.message); process.exit(1); });
