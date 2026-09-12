/* NAEKI SUSHI — data layer: the single source of truth ("backend").
   Everything the UI shows about the business lives here: menu, branches,
   hours, reviews, brand facts, landing config. Views never hardcode these
   values — they render from this module through the frame engine
   (frames.js), so editing an hour, a branch or a quote here updates the
   landing page (and every other view) on the next refresh.

   Prices: INDICATIVE THB, set for the showcase's demo ordering flow —
   naeki.co does not publish prices. Every price surface in the UI carries
   the same caveat; replace with real data here when the brand supplies it.

   Research: naeki.co, Google Maps listings (Sept 2026). Photos are local
   in assets/.

   Pub/sub: components subscribe to topics ("refresh", "tick"). The refresh
   loop below stands in for a real backend feed — in production, swap the
   interval for a fetch()/SSE poll and publish("refresh") from there; no
   UI code changes. */

window.NaekiData = (() => {
  "use strict";

  /* ---------------- MENU ---------------- */

  const MENU = [
    {
      id: "onigiri",
      name: "Onigiri",
      jp: "おにぎり",
      desc: "The signature. Hand-shaped to order, one-handed convenience, the rice seasoned to sit just right against the filling.",
      items: [
        { name: "Roasted Salmon", price: 45, sub: "Aburi, torched to order", img: "assets/onigiri_roasted_salmon.jpg",
          story: "The blowtorch is Naeki's party trick — reviewers single out the torched salmon onigiri for the smell alone." },
        { name: "Salmon Mayo", price: 39, sub: "Classic filling", img: "assets/onigiri_salmon_mayo.jpg" },
        { name: "Salmon Ikura Mayo", price: 55, sub: "With salmon roe", img: "assets/onigiri_salmon_ikura_mayo.jpg",
          story: "Briny ikura against sweet mayo and salmon — the richer sibling of the classic salmon mayo." },
        { name: "Tuna Mayo", price: 35, sub: "The everyday standard", img: "assets/onigiri_tuna_mayo.jpg" },
        { name: "Unagi", price: 49, sub: "Grilled eel, tare glaze", img: "assets/onigiri_unagi.jpg" },
        { name: "Mentaiko", price: 42, sub: "Spiced cod roe", img: "assets/onigiri_mentaiko.jpg" },
        { name: "Ebiko Salad", price: 42, sub: "Shrimp roe salad", img: "assets/onigiri_ebiko_salad.jpg" },
        { name: "Katsuobushi", price: 39, sub: "Bonito flakes", img: "assets/onigiri_katsuobushi.jpg" }
      ]
    },
    {
      id: "nigiri",
      name: "Nigiri Sushi",
      jp: "にぎり",
      desc: "Pressed fresh at the counter — reviewers say the fish \"melts in your mouth\". Two cuts of salmon lead the list.",
      items: [
        { name: "Salmon Nigiri", price: 45, sub: "Fresh, the benchmark", img: "assets/salmon_nigiri.jpg",
          story: "Their best-reviewed piece: thick-cut fresh salmon over properly seasoned Japanese rice." },
        { name: "Fatty Salmon Nigiri", price: 55, sub: "O-toro salmon", img: "assets/fatty_salmon_nigiri.jpg" },
        { name: "Salmon Aburi Nigiri", price: 49, sub: "Seared salmon", img: "assets/salmon_aburi_nigiri.jpg" },
        { name: "Maguro Nigiri", price: 49, sub: "Tuna", img: "assets/maguro_nigiri.jpg" },
        { name: "Unagi Nigiri", price: 59, sub: "Grilled eel", img: "assets/unagi_nigiri.jpg" },
        { name: "Hotate Nigiri", price: 59, sub: "Scallop", img: "assets/hotate_nigiri.jpg" },
        { name: "Foie Gras Nigiri", price: 89, sub: "The indulgent one", img: "assets/foie_gras_nigiri.jpg",
          story: "Proof the counter isn't only classics — foie gras over rice, a Bangkok office-lunch luxury." },
        { name: "Ikura Nigiri", price: 65, sub: "Salmon roe gunkan", img: "assets/ikura_nigiri.jpg" }
      ]
    },
    {
      id: "rolls",
      name: "Sushi Rolls",
      jp: "巻物",
      desc: "Uramaki, hosomaki and futomaki cut to order — plated on bamboo leaf with tobiko and tamagoyaki.",
      items: [
        { name: "Salmon & Crab Uramaki", price: 89, sub: "5 pcs, tobiko, tamagoyaki", img: "assets/roll_salmon_uramaki.jpg" },
        { name: "California Maki", price: 69, sub: "6 pcs, tobiko mayo", img: "assets/roll_california.jpg" },
        { name: "Aburi Salmon Roll", price: 79, sub: "6 pcs, torched salmon", img: "assets/roll_aburi_salmon.jpg" },
        { name: "Unagi Maki", price: 75, sub: "7 pcs, avocado, sesame", img: "assets/roll_unagi_maki.jpg" },
        { name: "Futomaki", price: 65, sub: "5 pcs, the thick roll", img: "assets/roll_futomaki.jpg" }
      ]
    },
    {
      id: "sashimi",
      name: "Sashimi & Sets",
      jp: "さしみ",
      desc: "Thick-cut plates for eating now, and nigiri/aburi sets for sharing at the desk.",
      items: [
        { name: "Salmon Sashimi", price: 129, sub: "With shiso & daikon", img: "assets/sashimi_salmon.jpg" },
        { name: "Aburi Salmon Sashimi", price: 149, sub: "Seared plate", img: "assets/sashimi_aburi.jpg" },
        { name: "Maguro Sashimi", price: 139, sub: "Tuna plate", img: "assets/sashimi_maguro.jpg" },
        { name: "Salmon Nigiri Set", price: 149, sub: "4 or 6 pcs", img: "assets/set_nigiri_4.jpg" },
        { name: "Aburi Salmon Set", price: 159, sub: "4 or 6 pcs, seared", img: "assets/set_aburi_4.jpg" },
        { name: "Assorted Sushi Set", price: 259, sub: "Chef's mixed platter", img: "assets/set_assorted.jpg",
          story: "The party platter: rows of salmon, tuna, eel and white-fish nigiri with maki — the one that gets ordered for Friday team lunches." }
      ]
    },
    {
      id: "don",
      name: "Donburi & Bento",
      jp: "丼・弁当",
      desc: "Rice bowls and boxed sets — the full meal when one onigiri won't cut it.",
      items: [
        { name: "Ultimate Chirashi Don", price: 259, sub: "Nine toppings", img: "assets/don_chirashi_ultimate.jpg",
          story: "Tuna, salmon, white fish, octopus, ark shell, shrimp, mackerel, tamagoyaki and ikura on one bowl." },
        { name: "Salmon & Ikura Don", price: 189, sub: "The house favourite", img: "assets/don_salmon_ikura.jpg" },
        { name: "Unagi Don", price: 199, sub: "Grilled eel bowl", img: "assets/don_unagi.jpg" },
        { name: "Seared Scallop Don", price: 189, sub: "Hotate aburi", img: "assets/don_hotate.jpg" },
        { name: "Sashimi Bento Set", price: 219, sub: "With miso soup", img: "assets/bento_1.jpg",
          story: "A black bento with salmon sashimi, tamago, salmon maki, California roll, seaweed salad and miso on the side." }
      ]
    },
    {
      id: "drinks",
      name: "Drinks & Sweets",
      jp: "飲み物・甘味",
      desc: "Cold matcha and coffee in winter and summer alike, plus Japanese-style puddings.",
      items: [
        { name: "Iced Matcha", price: 55, sub: "Naeki's matcha", img: "assets/drink_matcha_cold.jpg" },
        { name: "Matcha Latte", price: 59, sub: "Iced", img: "assets/drink_matcha_latte.jpg" },
        { name: "Iced Americano", price: 49, sub: "For the deadline run", img: "assets/drink_americano.jpg" },
        { name: "Matcha Pudding", price: 59, sub: "Japanese-style, light", img: "assets/dessert_matcha_pudding.jpg" },
        { name: "Banana Choco Pudding", price: 55, sub: "With chocolate", img: "assets/dessert_banana_choco.jpg" },
        { name: "Honey Lemon Pudding", price: 52, sub: "Bright finish", img: "assets/dessert_honey_lemon.jpg" }
      ]
    }
  ];

  /* The rest of the real daily menu (naeki.co) — shown as a strip in the app */
  const ALSO = [
    "Chicken Teriyaki Onigiri", "Hiyashi Wakame Onigiri", "Shiitake Onigiri", "Ume (Plum) Onigiri",
    "Salmon Teriyaki Onigiri", "Hamachi Nigiri", "Fatty Hamachi Nigiri", "Kohada Nigiri",
    "Shime Saba Nigiri", "Hotate Mentaiko Nigiri", "Hokkikai Nigiri", "Tako Nigiri",
    "Ika Nigiri", "Hotate Nitsumi Nigiri", "Foie Gras Hotate Nigiri", "Unagi Tamago Nigiri",
    "Ikura Foie Gras Nigiri", "Ebiko Nigiri", "Tobiko Nigiri", "Hiyashi Wakame Nigiri",
    "Kanimiso Nigiri", "Inari Nigiri", "Kampyo Hosomaki", "Salmon Hosomaki",
    "Kanikama Hosomaki", "Takuan Hosomaki", "Tamagoyaki Hosomaki", "Vegetable Futomaki",
    "Tuna Hosomaki", "White Fish Sashimi", "Tamagoyaki", "Wakame Salad with Tobiko",
    "Fresh Ikura Bowl", "Deluxe Chirashi Don", "Grand Chirashi Don", "Salmon Avocado Don",
    "Tuna Don", "White Fish & Ikura Don", "Aburi Salmon Don", "Miso Soup",
    "Dashi Soup", "Dashi Lemon Soup", "Matcha Honey Lemon (Iced)",
    "Premium Matcha Chocolate (Iced)", "Espresso", "Cappuccino", "Latte", "Mocha",
    "Premium Chocolate", "Hot Matcha", "Hot Americano", "Hot Cappuccino", "Hot Mocha",
    "Sweet Potato Pudding"
  ];

  /* ---------------- BRANCHES ----------------
     kind: flagship = "Naeki Sushi" counter (seated/take-away), go = "Naeki GO!" kiosk
     Source: naeki.co branch page + Google Maps listings, Sept 2026.
     Hours here are the regularly-updated business data: edit `close` and
     the landing "open now" band, the branch cards and the hours preview
     all follow on the next refresh — no view code to touch. */

  const BRANCHES = [
    { name: "Naeki Sushi @ BTS Siam", kind: "flagship", area: "BTS Siam · Pathum Wan",
      where: "BTS Siam station concourse, Rama I Rd", close: "21:00", phone: "02 658 4001",
      note: "The 4.7★ original take-away & delivery counter, 171+ photos, inside the station gates." },
    { name: "Naeki Sushi @ MRT Chatuchak (JJ)", kind: "flagship", area: "MRT Chatuchak",
      where: "Metro Mall, MRT Blue Line", close: "20:00", phone: "063 228 7980",
      note: "Metro-mall counter, 5.0★ from 56 reviews." },
    { name: "Naeki Sushi @ BTS Sala Daeng", kind: "flagship", area: "BTS Sala Daeng · Silom",
      where: "BTS Sala Daeng station", close: "20:00" },
    { name: "Naeki Sushi Empire Tower", kind: "flagship", area: "Sathorn",
      where: "Empire Tower, Unit 208, 2nd Fl., South Sathorn Rd", close: "19:30", phone: "02 286 2157" },
    { name: "Naeki Go @ BTS Asok", kind: "go", area: "BTS Asok · Sukhumvit",
      where: "Sukhumvit station", close: "20:00" },
    { name: "Naeki GO! @ BTS Chong Non-Si", kind: "go", area: "BTS Chong Non-Si · Narathiwat",
      where: "BTS Chong Nonsi (S3)", close: "18:00" },
    { name: "Naeki GO! Park Silom", kind: "go", area: "Silom",
      where: "Park Silom building, Si Lom Rd (Foodland entrance)", close: "21:00", phone: "062 648 4629",
      note: "4.8★ — B1 by the Foodland entrance." },
    { name: "Naeki Go @ BTS Mochit", kind: "go", area: "BTS Mo Chit",
      where: "Pre-tap-tap fare zone, exits 3–4", close: "20:00" },
    { name: "Naeki GO @ The Trendy", kind: "go", area: "Sukhumvit 13",
      where: "The Trendy Office, 1st floor", close: "18:00" },
    { name: "NAEKI GO! PUNN Tower", kind: "go", area: "Rama IV",
      where: "PUNN Tower, Rama IV", close: "18:00" },
    { name: "NAEKI GO! Central Bangrak", kind: "go", area: "Bang Rak",
      where: "Central Bangrak", close: "20:00" },
    { name: "Naeki Go! @ BTS Saint Louis", kind: "go", area: "BTS Saint Louis · Sathorn",
      where: "South Sathorn Rd", close: "18:30" },
    { name: "Naeki GO! Chamchuri Square", kind: "go", area: "Sam Yan · Chula",
      where: "Chamchuri Square, floor B", close: "20:00" },
    { name: "Naeki Go! Sindhorn", kind: "go", area: "Wireless Rd · Ploenchit",
      where: "Sindhorn Building 3, 1st floor, Witthayu Rd", close: "17:00" },
    { name: "Naeki Go! Rasa Two", kind: "go", area: "Phetchaburi",
      where: "Rasa Two, Phetchaburi Rd", close: "19:00" },
    { name: "Naeki Go! One Pacific Place", kind: "go", area: "Sukhumvit 6",
      where: "One Pacific Place", close: null },
    { name: "Naeki Go @ The Offices at CentralWorld", kind: "go", area: "Ratchaprasong",
      where: "The Offices at CentralWorld", close: "19:30" },
    { name: "Naeki Go! The PARQ", kind: "go", area: "Rama IV",
      where: "The PARQ, Rama IV", close: "20:00" },
    { name: "Naeki Go @ Park Ventures", kind: "go", area: "Ploenchit",
      where: "Park Ventures Ecoplex, Ploenchit", close: "18:30" },
    { name: "Naeki Go! Chula Hospital", kind: "go", area: "Sam Yan · Chula",
      where: "King Chulalongkorn Memorial Hospital", close: "18:00" }
  ];

  /* ---------------- REVIEWS ---------------- (social proof, updatable) */

  const REVIEWS = [
    { text: "Quality just like Japanese people made it.", src: "Google review · BTS Siam" },
    { text: "They torched the top with a blowtorch — the rice sticks together exactly like sushi should.",
      src: "Google review · BTS Siam" },
    { text: "Loved the tuna and salmon sushi. Melts in your mouth.", src: "Google review · BTS Siam" }
  ];

  /* ---------------- BRAND FACTS ---------------- */

  const INFO = {
    brand: "Naeki — Sushi & Go!",
    tagline: "Premium Sushi Take Away and Delivery Since 2013",
    founded: 2013,
    foundedNote: "founded, All Seasons Place",
    flagshipRating: "4.7★",
    flagshipReviews: "BTS Siam flagship · 210 reviews",
    line: "@Naekisushi",
    lineUrl: "https://lin.ee/DqJnedo",
    instagram: "https://www.instagram.com/naekisushi/?hl=en",
    tiktok: "https://www.tiktok.com/@naekisushi",
    facebook: "https://www.facebook.com/naekisushi/",
    hq: "Naeki Sushi Co., Ltd. (HQ), 487/8 Si Ayutthaya Rd, Phaya Thai, Ratchathewi, Bangkok 10400",
    officePhone: "098 229 2278",
    officeEmail: "info@naekisushi.com",
    site: "https://naeki.co"
  };

  /* ---------------- LANDING CONFIG ----------------
     The featured pool is the "pre-view" of the menu: every data refresh
     the frame engine serves `featuredCount` consecutive items from this
     pool (rotating by 2), so the landing page visibly tracks the live
     data layer — swap the pool here and the landing follows. */

  const LANDING = {
    featuredPool: [
      "Roasted Salmon", "Salmon Nigiri", "Salmon & Ikura Don", "Ultimate Chirashi Don",
      "Aburi Salmon Roll", "Salmon Sashimi", "Iced Matcha", "Matcha Pudding",
      "Fatty Salmon Nigiri", "Unagi Don", "California Maki", "Ikura Nigiri",
      "Assorted Sushi Set", "Salmon Mayo"
    ],
    featuredCount: 8,
    previewBranches: 4        // flagship counters shown in the landing hours preview
  };

  /* ============================================================
     PUB/SUB + LIVE COMPUTATIONS
     ============================================================ */

  const subs = {};             // topic -> [fn]
  let refreshCount = 0;
  let lastRefreshAt = null;

  function subscribe(topic, fn) {
    (subs[topic] = subs[topic] || []).push(fn);
  }
  function publish(topic, payload) {
    (subs[topic] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });
  }

  /* ---- Bangkok-time helpers (shared by every status surface) ---- */

  const bangkokParts = () => {
    const t = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour12: false });
    const [h, m, s] = t.split(":").map(Number);
    return { h, m, s, mins: h * 60 + m, str: t };
  };

  const toMins = (hhmm) => {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };

  /* short label for a branch in tight surfaces (live band, etc.):
     prefer the segment after "@", else strip the brand prefix */
  function shortName(b) {
    const parts = b.name.split("@");
    if (parts.length > 1) return parts.pop().trim();
    const stripped = b.name.replace(/^(Naeki|NAEKI)\s+(Sushi|GO!?|Go!?)\s*/, "").trim();
    return stripped || b.name;
  }

  /* true when the branch is still serving (naeki.co publishes closing
     times only; unknown hours are treated as open rather than claiming closed) */
  function isOpenNow(branch, now = bangkokParts()) {
    const close = toMins(branch.close);
    if (close === null) return true;
    return now.mins < close;
  }

  /* ---- derived, always-current stats for frames ---- */

  function stats() {
    const now = bangkokParts();
    const open = BRANCHES.filter(b => isOpenNow(b, now));
    // still-open branch with the earliest closing time = "next to close"
    const nextClose = open
      .filter(b => b.close)
      .sort((a, b) => toMins(a.close) - toMins(b.close))[0] || null;
    return {
      now,
      branchCount: BRANCHES.length,
      openCount: open.length,
      nextClose,
      dishCount: MENU.reduce((n, g) => n + g.items.length, 0),
      categoryCount: MENU.length,
      alsoCount: ALSO.length,
      lastRefreshAt
    };
  }

  /* ---- featured rotation: `featuredCount` consecutive pool items,
         window start walks 2 forward each refresh (wraps around) ---- */
  function featured(now = refreshCount) {
    const { featuredPool: pool, featuredCount: count } = LANDING;
    const start = (now * 2) % pool.length;
    const names = [];
    for (let i = 0; i < count; i++) names.push(pool[(start + i) % pool.length]);
    return names
      .map(name => {
        for (const group of MENU) {
          const item = group.items.find(it => it.name === name);
          if (item) return { item, group };
        }
        console.warn("featured dish not in menu:", name);
        return null;
      })
      .filter(Boolean);
  }

  /* ---- the "backend feed": in production this becomes a fetch()/SSE
     poll of the real Naeki backend; here the interval stands in and
     republishes so every frame re-sources itself from this module.
     The rotation makes the refresh visible; hours edits propagate the
     same way. ---- */
  function refresh() {
    refreshCount++;
    lastRefreshAt = bangkokParts();
    publish("refresh", { count: refreshCount, at: lastRefreshAt });
  }

  // minute tick: status-only topic (open/closed flips at closing time)
  setInterval(() => publish("tick", bangkokParts()), 60 * 1000);
  // data refresh cycle
  setInterval(refresh, 30 * 1000);
  // first refresh at load: stamps lastRefreshAt so the landing band shows a
  // real timestamp and the featured rotation starts from a settled window
  setTimeout(refresh, 1200);

  const Data = {
    MENU, ALSO, BRANCHES, REVIEWS, INFO, LANDING,
    subscribe, publish,
    bangkokParts, toMins, isOpenNow, shortName, stats, featured,
    refresh
  };
  return Data;
})();

/* compat alias — app.js and older references keep working against the
   same live object (no copy), so there is exactly one source of truth. */
window.NAEKI = window.NaekiData;