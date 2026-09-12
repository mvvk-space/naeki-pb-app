/* NAEKI SUSHI — researched data (naeki.co, Google Maps listings, Sept 2026)
   Photos: official naeki.co menu photography + Google Maps kiosk photo, stored locally in assets/. */

window.NAEKI = {};

/* ---------------- MENU ---------------- */

NAEKI.MENU = [
  {
    id: "onigiri",
    name: "Onigiri",
    jp: "おにぎり",
    desc: "The signature. Hand-shaped to order, one-handed convenience, the rice seasoned to sit just right against the filling.",
    items: [
      { name: "Roasted Salmon", sub: "Aburi, torched to order", img: "assets/onigiri_roasted_salmon.jpg",
        story: "The blowtorch is Naeki's party trick — reviewers single out the torched salmon onigiri for the smell alone." },
      { name: "Salmon Mayo", sub: "Classic filling", img: "assets/onigiri_salmon_mayo.jpg" },
      { name: "Salmon Ikura Mayo", sub: "With salmon roe", img: "assets/onigiri_salmon_ikura_mayo.jpg",
        story: "Briny ikura against sweet mayo and salmon — the richer sibling of the classic salmon mayo." },
      { name: "Tuna Mayo", sub: "The everyday standard", img: "assets/onigiri_tuna_mayo.jpg" },
      { name: "Unagi", sub: "Grilled eel, tare glaze", img: "assets/onigiri_unagi.jpg" },
      { name: "Mentaiko", sub: "Spiced cod roe", img: "assets/onigiri_mentaiko.jpg" },
      { name: "Ebiko Salad", sub: "Shrimp roe salad", img: "assets/onigiri_ebiko_salad.jpg" },
      { name: "Katsuobushi", sub: "Bonito flakes", img: "assets/onigiri_katsuobushi.jpg" }
    ]
  },
  {
    id: "nigiri",
    name: "Nigiri Sushi",
    jp: "にぎり",
    desc: "Pressed fresh at the counter — reviewers say the fish \"melts in your mouth\". Two cuts of salmon lead the list.",
    items: [
      { name: "Salmon Nigiri", sub: "Fresh, the benchmark", img: "assets/salmon_nigiri.jpg",
        story: "Their best-reviewed piece: thick-cut fresh salmon over properly seasoned Japanese rice." },
      { name: "Fatty Salmon Nigiri", sub: "O-toro salmon", img: "assets/fatty_salmon_nigiri.jpg" },
      { name: "Salmon Aburi Nigiri", sub: "Seared salmon", img: "assets/salmon_aburi_nigiri.jpg" },
      { name: "Maguro Nigiri", sub: "Tuna", img: "assets/maguro_nigiri.jpg" },
      { name: "Unagi Nigiri", sub: "Grilled eel", img: "assets/unagi_nigiri.jpg" },
      { name: "Hotate Nigiri", sub: "Scallop", img: "assets/hotate_nigiri.jpg" },
      { name: "Foie Gras Nigiri", sub: "The indulgent one", img: "assets/foie_gras_nigiri.jpg",
        story: "Proof the counter isn't only classics — foie gras over rice, a Bangkok office-lunch luxury." },
      { name: "Ikura Nigiri", sub: "Salmon roe gunkan", img: "assets/ikura_nigiri.jpg" }
    ]
  },
  {
    id: "rolls",
    name: "Sushi Rolls",
    jp: "巻物",
    desc: "Uramaki, hosomaki and futomaki cut to order — plated on bamboo leaf with tobiko and tamagoyaki.",
    items: [
      { name: "Salmon & Crab Uramaki", sub: "5 pcs, tobiko, tamagoyaki", img: "assets/roll_salmon_uramaki.jpg" },
      { name: "California Maki", sub: "6 pcs, tobiko mayo", img: "assets/roll_california.jpg" },
      { name: "Aburi Salmon Roll", sub: "6 pcs, torched salmon", img: "assets/roll_aburi_salmon.jpg" },
      { name: "Unagi Maki", sub: "7 pcs, avocado, sesame", img: "assets/roll_unagi_maki.jpg" },
      { name: "Futomaki", sub: "5 pcs, the thick roll", img: "assets/roll_futomaki.jpg" }
    ]
  },
  {
    id: "sashimi",
    name: "Sashimi & Sets",
    jp: "さしみ",
    desc: "Thick-cut plates for eating now, and nigiri/aburi sets for sharing at the desk.",
    items: [
      { name: "Salmon Sashimi", sub: "With shiso & daikon", img: "assets/sashimi_salmon.jpg" },
      { name: "Aburi Salmon Sashimi", sub: "Seared plate", img: "assets/sashimi_aburi.jpg" },
      { name: "Maguro Sashimi", sub: "Tuna plate", img: "assets/sashimi_maguro.jpg" },
      { name: "Salmon Nigiri Set", sub: "4 or 6 pcs", img: "assets/set_nigiri_4.jpg" },
      { name: "Aburi Salmon Set", sub: "4 or 6 pcs, seared", img: "assets/set_aburi_4.jpg" },
      { name: "Assorted Sushi Set", sub: "Chef's mixed platter", img: "assets/set_assorted.jpg",
        story: "The party platter: rows of salmon, tuna, eel and white-fish nigiri with maki — the one that gets ordered for Friday team lunches." }
    ]
  },
  {
    id: "don",
    name: "Donburi & Bento",
    jp: "丼・弁当",
    desc: "Rice bowls and boxed sets — the full meal when one onigiri won't cut it.",
    items: [
      { name: "Ultimate Chirashi Don", sub: "Nine toppings", img: "assets/don_chirashi_ultimate.jpg",
        story: "Tuna, salmon, white fish, octopus, ark shell, shrimp, mackerel, tamagoyaki and ikura on one bowl." },
      { name: "Salmon & Ikura Don", sub: "The house favourite", img: "assets/don_salmon_ikura.jpg" },
      { name: "Unagi Don", sub: "Grilled eel bowl", img: "assets/don_unagi.jpg" },
      { name: "Seared Scallop Don", sub: "Hotate aburi", img: "assets/don_hotate.jpg" },
      { name: "Sashimi Bento Set", sub: "With miso soup", img: "assets/bento_1.jpg",
        story: "A black bento with salmon sashimi, tamago, salmon maki, California roll, seaweed salad and miso on the side." }
    ]
  },
  {
    id: "drinks",
    name: "Drinks & Sweets",
    jp: "飲み物・甘味",
    desc: "Cold matcha and coffee in winter and summer alike, plus Japanese-style puddings.",
    items: [
      { name: "Iced Matcha", sub: "Naeki's matcha", img: "assets/drink_matcha_cold.jpg" },
      { name: "Matcha Latte", sub: "Iced", img: "assets/drink_matcha_latte.jpg" },
      { name: "Iced Americano", sub: "For the deadline run", img: "assets/drink_americano.jpg" },
      { name: "Matcha Pudding", sub: "Japanese-style, light", img: "assets/dessert_matcha_pudding.jpg" },
      { name: "Banana Choco Pudding", sub: "With chocolate", img: "assets/dessert_banana_choco.jpg" },
      { name: "Honey Lemon Pudding", sub: "Bright finish", img: "assets/dessert_honey_lemon.jpg" }
    ]
  }
];

/* The rest of the real daily menu (naeki.co) — shown as a strip in the app */
NAEKI.ALSO = [
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
   Source: naeki.co branch page + Google Maps listings, Sept 2026. */

NAEKI.BRANCHES = [
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

/* ---------------- FOOTNOTES ---------------- */

NAEKI.INFO = {
  brand: "Naeki — Sushi & Go!",
  tagline: "Premium Sushi Take Away and Delivery Since 2013",
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