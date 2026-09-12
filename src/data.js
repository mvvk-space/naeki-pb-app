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
    hqAddress: "487/8 Si Ayutthaya Rd, Phaya Thai, Ratchathewi, Bangkok 10400",
    officePhone: "098 229 2278",
    officeEmail: "info@naekisushi.com",
    site: "https://naeki.co"
  };

  /* ---------------- ORDER & INFO CARDS ----------------
     The four contact cards (LINE OA, flagship counter, catering, company)
     shared by the app's Order view and the landing page's bottom section.
     Composed from INFO + BRANCHES — a phone or hours edit repaints both
     surfaces on the next refresh. socials: [label, url] pairs. */

  const flagship = () => BRANCHES.find(b => b.kind === "flagship");

  function order() {
    const f = flagship();
    return [
      {
        kicker: "Line Official Account",
        title: INFO.line,
        text: "Order ahead for pickup at your nearest kiosk and catch the seasonal drops.",
        links: [{ label: "Open LINE OA", url: INFO.lineUrl, accent: true }]
      },
      {
        kicker: "Flagship counter",
        title: "Naeki Sushi · " + shortName(f),
        text: f.where + ". Open daily until " + f.close + ".",
        links: [
          { label: f.phone, url: "tel:" + f.phone.replace(/\s+/g, ""), accent: false },
          { label: "Directions", url: "https://www.google.com/maps/search/?api=1&query=" +
            encodeURIComponent(f.name + " Bangkok"), accent: false }
        ]
      },
      {
        kicker: "Catering & party sets",
        title: "Party trays & bulk orders",
        text: "Sushi platters, bento sets and party trays for offices and events — arranged through the Naeki team.",
        links: [{ label: INFO.officePhone, url: "tel:" + INFO.officePhone.replace(/\s+/g, ""), accent: false }]
      },
      {
        kicker: "The company",
        title: "Naeki Sushi Co., Ltd.",
        text: INFO.hqAddress,
        socials: [
          ["Instagram", INFO.instagram],
          ["TikTok", INFO.tiktok],
          ["Facebook", INFO.facebook]
        ]
      }
    ];
  }

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

  /* ============================================================
     LOYALTY: points, tiers, offers — the Starbucks/McDonald's loop.

     Earning: 1 point per 10฿ spent (rounded down), doubled on the
     "points day" below. Tier multipliers stack on top. Offers are
     the "correspondence about offers and promotions": weekly brand
     deals + affinity matches computed from THIS DEVICE's purchase
     history — the honest version of the data brokerage those apps do
     server-side; receipts never leave this device (UI says so).
     In production offers() gains a fetch() source the way refresh()
     does; the shape stays identical. */

  const POINTS_PER_BAHT = 0.1;        // 1 pt / 10฿
  const TIERS = [
    { id: "kome",    name: "Kome",     jp: "米",    threshold: 0,
      blurb: "Rice — everyone starts here.", perk: "Earn 1 pt / 10฿" },
    { id: "sake",    name: "Sake",     jp: "鮭",    threshold: 100,
      blurb: "Salmon — a regular at the counter.", perk: "+10% points on every order" },
    { id: "maguro",  name: "Maguro",   jp: "鮪",    threshold: 300,
      blurb: "Tuna — trusted with the good cuts.", perk: "+25% points · birthday don" },
    { id: "ikura",   name: "Ikura",    jp: "イクラ", threshold: 600,
      blurb: "Roe — the indulgent circle.", perk: "+50% points · early seasonal drops" }
  ];
  const POINTS_DAY = 4;               // 0=Sun … 4=Thu: double points
  const POINTS_DAY_NAME = "Thursdays";

  function pointsFor(total, tierMult = 1, dayMult = 1) {
    return Math.floor(total * POINTS_PER_BAHT * tierMult * dayMult);
  }

  function tierMultOf(tier) {
    return { kome: 1, sake: 1.1, maguro: 1.25, ikura: 1.5 }[tier?.id] || 1;
  }

  function tierFor(points) {
    let t = TIERS[0];
    for (const cand of TIERS) if (points >= cand.threshold) t = cand;
    return t;
  }

  function nextTier(points) {
    return TIERS.find(t => points < t.threshold) || null;
  }

  /* purchase-history shape (store writes it at checkout):
     { ts, total, count, category, lines } */
  function favoriteCategory(history) {
    if (!history || !history.length) return null;
    const tally = {};
    for (const o of history) {
      const cat = o.category || "other";
      tally[cat] = (tally[cat] || 0) + (o.count || 1);
    }
    return Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
  }

  function daysSince(ts, now = Date.now()) {
    return Math.floor((now - ts) / 86400000);
  }

  function bangkokWeekday(ts = Date.now()) {
    const d = new Date(ts).toLocaleDateString("en-GB", { timeZone: "Asia/Bangkok" });
    const [dd, mm, yy] = d.split("/").map(Number);
    return new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay();
  }

  /* the offers inbox: weekly brand deals + locally-personalized matches */
  function offers(opts = {}) {
    const history = opts.history || [];
    const now = opts.now || Date.now();
    const weekday = bangkokWeekday(now);
    const out = [];

    const WEEKLY = [
      { day: 1, kicker: "Monday set",   title: "Onigiri + Iced Matcha 89฿",
        text: "Start the week light — any onigiri with an iced matcha.", tag: "deal" },
      { day: 2, kicker: "Two-for-Tuesday", title: "Second roll half price",
        text: "Any two sushi rolls — the cheaper one at 50% off.", tag: "deal" },
      { day: 3, kicker: "Wednesday",     title: "Donburi day — free miso",
        text: "Free miso soup with any donburi or bento.", tag: "deal" },
      { day: POINTS_DAY, kicker: "Points day", title: `2× points ${POINTS_DAY_NAME}`,
        text: "Every order earns double points — tier multipliers stack.", tag: "points" },
      { day: 5, kicker: "Friday trays",  title: "Party set upgrade",
        text: "Order the Assorted Sushi Set — we add tamagoyaki for the office.", tag: "deal" }
    ];
    for (const w of WEEKLY) {
      out.push({ ...w, live: w.day === weekday, personal: false });
    }

    // affinity matches from local history — "because you order it" offers
    const fav = favoriteCategory(history);
    if (history.length && fav) {
      const favGroup = MENU.find(g => g.id === fav);
      const favName = favGroup ? favGroup.name : "your favorite";
      out.push({
        kicker: "Because you order it",
        title: `2× points on ${favName}`,
        text: `Your top category on this device is ${favName} — earn double on it this week.`,
        tag: "personal", personal: true, live: true
      });
    }
    const last = history[0];
    if (last && daysSince(last.ts, now) >= 7) {
      out.push({
        kicker: "We saved you a seat",
        title: "Welcome back — free Iced Matcha",
        text: "It's been a week since your last order. First drink's on the demo house.",
        tag: "personal", personal: true, live: true
      });
    }
    if (history.some(o => o.total >= 500)) {
      out.push({
        kicker: "Office hero",
        title: "5% back on 500฿+ trays",
        text: "You run big orders — party trays over 500฿ earn bonus points.",
        tag: "personal", personal: true, live: true
      });
    }
    return out;
  }

  /* ============================================================
     MILESTONES + TRUST — the franchise-app hidden gems, applied
     on-device. Seven achievements that map one-to-one onto the
     mechanics the research surfaced:
       1. Mixue/Alibaba Qwen  — the free-first-order hook that rockets
          adoption (here, honestly: a one-time welcome bonus).
       2. Starbucks "breadth"  — reward trying every category, not
          just spending more.
       3. Starbucks "frequency"— reward showing up on different days
          (visit cadence), the thing gamified loyalty lifts most.
       4. McDonald's B2B       — reward the big tray order.
       5. Starbucks weekly     — a stretch goal pitched just past habit
          ("order 3× this week") with a bonus on completion.
       6. Alibaba Qwen referral— give + get: both sides earn.
       7. McDonald's lifetime  — a loyalty-floor threshold reward.
     Every milestone is computed from THIS device's own history; the
     store awards the points once and records the claim. Nothing
     leaves the device — the honest version of the data playbook.
     ============================================================ */

  const MILESTONES = [
    { id: "first",   kicker: "First bite",    title: "Your first order",
      text: "Welcome in — here's a one-time bonus to make your first counter visit count.",
      pts: 50, jp: "初注文" },
    { id: "breadth", kicker: "Full-menu tour",title: "Try all six categories",
      text: "Every onigiri, nigiri, roll, sashimi, don and sweet — rewarded for breadth.",
      pts: 100, jp: "全種類" },
    { id: "cadence", kicker: "Weekly regular", title: "Order on 7 different days",
      text: "Showing up is the habit the big apps gamify hardest; here it earns real points.",
      pts: 150, jp: "常連" },
    { id: "party",   kicker: "Office hero",    title: "One order of ฿500+",
      text: "The tray run for the team — bonus points for the big order.",
      pts: 100, jp: "大皿" },
    { id: "week",    kicker: "This week",     title: "Order 3× in one calendar week",
      text: "A stretch goal past your normal cadence — finish it and bank the points.",
      pts: 100, jp: "今週" },
    { id: "friend",  kicker: "Give + get",    title: "Redeem a friend's referral",
      text: "When a shared code lands, both sides earn — the loop that took Qwen to #1.",
      pts: 100, jp: "紹介" },
    { id: "lifetime",kicker: "Loyal wallet",   title: "Spend ฿1,000 lifetime",
      text: "A loyalty floor: cross the ฿1,000 mark and the house thanks you.",
      pts: 200, jp: "生涯" }
  ];

  /* the seven things that live on this device — the trust pane copy.
     Keeps the "honest data brokerage" stance a first-class surface. */
  const TRUST = [
    "Your order history stays on this device",
    "Your stamp card is self-issued, never verified by Naeki",
    "Your wallet balance is a local simulation",
    "Your points and offers are computed from this device's data",
    "No account, no login, no tracker follows you",
    "Nothing — points, offers, balance — is transmitted anywhere",
    "You can wipe it all any time with the sign-out and reset buttons"
  ];

  /* distinct calendar days the user has ordered on (Bangkok) */
  function streakOf(history, now = Date.now()) {
    const days = new Set();
    for (const o of history) days.add(bangkokDayKey(o.ts));
    return { count: days.size, days };
  }

  function bangkokDayKey(ts) {
    return new Date(ts).toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  }

  /* how many orders fall in the current calendar week (Mon-start, Bangkok) */
  function ordersThisWeek(history, now = Date.now()) {
    const nowKey = bangkokDayKey(now);
    const nowD = new Date(nowKey + "T00:00:00Z");
    const dow = (nowD.getUTCDay() + 6) % 7;       // 0=Monday
    const monday = new Date(nowD); monday.setUTCDate(monday.getUTCDate() - dow);
    return history.filter(o => bangkokDayKey(o.ts) >= bangkokDayKey(monday.getTime()) &&
                                bangkokDayKey(o.ts) <= nowKey).length;
  }

  /* distinct categories present across history */
  function categoriesSeen(history) {
    const cats = new Set();
    for (const o of history) if (o.category) cats.add(o.category);
    return cats.size;
  }

  /* computed achievement state — done but not-yet-claimed lives here;
     the store persists the claim atomically when it awards. */
  function achievements(history, opts = {}) {
    const referralsRedeemed = opts.referralsRedeemed ?? 0;
    const order3Week = ordersThisWeek(history, opts.now ?? Date.now());
    const stk = streakOf(history, opts.now ?? Date.now()).count;
    const breadth = Math.min(categoriesSeen(history), MENU.length);
    const lifetimeSpend = history.reduce((s, o) => s + (o.total || 0), 0);
    const done = {
      first:     history.length > 0,
      breadth:   breadth >= MENU.length,
      cadence:   stk >= 7,
      party:     history.some(o => o.total >= 500),
      week:      order3Week >= 3,
      friend:    referralsRedeemed >= 1,
      lifetime:  lifetimeSpend >= 1000
    };
    return { done, breadth, cadence: stk, week: order3Week, lifetime: lifetimeSpend };
  }

  /* the mission-of-the-week card (Starbucks stretch goal) + its progress
     out of 3 — computed from this week's orders */
  function weeklyMission(history, now = Date.now()) {
    const n = ordersThisWeek(history, now);
    const weekday = bangkokWeekday(now);
    const left = weekday < 6;                      // Mon–Sat still live
    return {
      kicker: "This week's mission",
      title: "Order 3× for +100 pts",
      text: left
        ? `You've ordered ${n} time${n === 1 ? "" : "s"} this week. One more stretch, then it's yours.`
        : "Week's over — Sunday refresh resets the mission.",
      have: n, need: 3, live: left
    };
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
    bangkokParts, toMins, isOpenNow, shortName, stats, featured, order,
    // loyalty engine
    POINTS_PER_BAHT, TIERS, POINTS_DAY, POINTS_DAY_NAME,
    pointsFor, tierMultOf, tierFor, nextTier, offers,
    bangkokWeekday, daysSince,
    // milestone engine + trust pane
    MILESTONES, TRUST,
    streakOf, categoriesSeen, ordersThisWeek, achievements, weeklyMission,
    refresh
  };
  return Data;
})();

/* compat alias — app.js and older references keep working against the
   same live object (no copy), so there is exactly one source of truth. */
window.NAEKI = window.NaekiData;