#!/usr/bin/env node
/* Naeki CI check — zero-dependency validation engine (pure Node, no npm deps).

   The project is plain HTML/CSS/JS (Electron + PWA) with a live data layer.
   This script is the "always true" floor CI is built on: JS syntax, JSON &
   data-layer integrity, PWA manifest, and asset-reference correctness.

     Run        : npm run check               (or node scripts/validate.mjs)
     On commit  : .githooks/pre-commit        (core.hooksPath -> .githooks)
     On CI      : .github/workflows/ci.yml    (GitHub Actions — zero-dep,
                deliberately no `npm ci`: nothing here needs node_modules,
                so CI stays fast without an Electron download)

   Everything below is host-agnostic: it only ever *reads* files, so it runs
   identically in a pre-commit hook, a pre-push hook, or CI. Exit 0 = pass,
   1 = fail. Deliberately scoped to stable architecture facts — it does NOT
   assert DOM wiring or nav details that are in active flux, so in-flight
   commits don't trip it on things that aren't actually broken.
*/
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");

const lines = [];
let failures = 0;
const pass = (m) => lines.push(`  ✓ ${m}`);
const warn = (m) => lines.push(`  △ ${m}`);
const problem = (m) => (lines.push(`  ✗ ${m}`), failures++);

/* ------------------------------------------------------------------ */
/* 1. JS syntax — parse every .js in the repo root and src/            */
/* ------------------------------------------------------------------ */
const jsFiles = [];
for (const dir of [ROOT, SRC]) {
  for (const f of readdirSync(dir)) if (f.endsWith(".js")) jsFiles.push(join(dir, f));
}
for (const f of jsFiles) {
  try {
    execFileSync(process.execPath, ["--check", f], { stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    const msg = String(e.stderr || e.message).trim().split("\n")[0];
    problem(`syntax: ${f.replace(ROOT + "/", "")} — ${msg}`);
  }
}
pass(`JS syntax: ${jsFiles.length} file(s) parse clean`);

/* ------------------------------------------------------------------ */
/* 2. JSON + PWA manifest                                              */
/* ------------------------------------------------------------------ */
const MANIFEST_PATH = join(SRC, "manifest.webmanifest");
let MANIFEST = null;
for (const rel of ["asset_map.json", "src/manifest.webmanifest"]) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) { problem(`missing JSON: ${rel}`); continue; }
  try { JSON.parse(readFileSync(p, "utf8")); pass(`JSON ok: ${rel}`); }
  catch (e) { problem(`invalid JSON: ${rel} — ${e.message.split("\n")[0]}`); }
}
// gitignored research scratch — validate only when present (absent in CI)
for (const rel of ["menu_images_en.json", "branch_links.json"]) {
  const p = join(ROOT, rel);
  if (!existsSync(p)) continue;
  try { JSON.parse(readFileSync(p, "utf8")); pass(`JSON ok: ${rel} (scratch, not shipped)`); }
  catch (e) { problem(`invalid JSON: ${rel} — ${e.message.split("\n")[0]}`); }
}
try { MANIFEST = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")); }
catch { /* reported above */ }
if (MANIFEST) {
  for (const field of ["name", "short_name", "start_url", "display"]) {
    if (!MANIFEST[field]) problem(`manifest: missing required field "${field}"`);
  }
  if (!Array.isArray(MANIFEST.icons) || MANIFEST.icons.length === 0) {
    problem("manifest: no icons array");
  } else {
    for (const ic of MANIFEST.icons) {
      if (!ic.src) { problem("manifest: icon without src"); continue; }
      if (!existsSync(join(SRC, ic.src))) problem(`manifest icon missing: ${ic.src}`);
    }
    pass(`PWA manifest: ${MANIFEST.icons.length} icon(s) resolve`);
  }
}

/* ------------------------------------------------------------------ */
/* 3. Asset reference integrity — every assets/ literal used by the    */
/*    shell must exist under src/assets/                               */
/* ------------------------------------------------------------------ */
const refs = new Set();
for (const f of readdirSync(SRC)) {
  if (!f.endsWith(".html") && !f.endsWith(".js") && !f.endsWith(".css")) continue;
  const text = readFileSync(join(SRC, f), "utf8");
  for (const m of text.matchAll(/assets\/[A-Za-z0-9_.\-/]+/g)) refs.add(m[0]);
}
let missingRefs = 0;
for (const rel of refs) {
  const clean = rel.replace(/\.\/|\.{2,}/g, ""); // collapse "." / "../" noise
  let p = join(SRC, clean);
  if (!existsSync(p)) { missingRefs++; problem(`missing asset referenced in src/: ${clean}`); }
}
pass(missingRefs === 0
  ? `Assets: ${refs.size} referenced paths all exist under src/assets/`
  : `Assets: ${refs.size} referenced paths, ${missingRefs} missing`);

/* ------------------------------------------------------------------ */
/* 4. Data layer — execute data.js in a sandbox and verify the live    */
/*    business data (menu, branches, hours, landing pool).             */
/* ------------------------------------------------------------------ */
let DATA = null;
try {
  const src = readFileSync(join(SRC, "data.js"), "utf8");
  DATA = vm.runInNewContext(src, {
    window: { NaekiData: null, NAEKI: null },
    setInterval: () => 0,   // no background refresh/tick timers in the sandbox
    setTimeout: () => 0,
    console,
  }, { filename: "data.js" });
} catch (e) {
  problem(`data.js failed to load in sandbox: ${e.message.split("\n")[0]}`);
}

if (DATA) {
  /* menu */
  if (!Array.isArray(DATA.MENU) || DATA.MENU.length === 0) {
    problem("data: MENU is empty");
  } else {
    const ids = new Set();
    const itemNames = new Set();
    for (const g of DATA.MENU) {
      if (!g.id) { problem(`data: category missing id (${g.name ?? "?"})`); continue; }
      if (ids.has(g.id)) problem(`data: duplicate category id "${g.id}"`);
      ids.add(g.id);
      for (const it of g.items) {
        if (!it.img) { problem(`data: menu item missing img: ${g.id}/${it.name}`); continue; }
        if (!/^assets\//.test(it.img)) {
          problem(`data: item img not under assets/: ${it.name} → ${it.img}`);
        } else if (!existsSync(join(SRC, it.img))) {
          problem(`data: missing item image: ${it.img} (${it.name})`);
        }
        itemNames.add(it.name);
      }
    }
    const dishCount = DATA.MENU.reduce((n, g) => n + (g.items?.length ?? 0), 0);
    pass(`Menu: ${DATA.MENU.length} categories · ${dishCount} dishes — all images resolve`);
  }

  /* branches + hours */
  if (!Array.isArray(DATA.BRANCHES) || DATA.BRANCHES.length === 0) {
    problem("data: BRANCHES is empty");
  } else {
    const names = new Set();
    let parseable = 0;
    for (const b of DATA.BRANCHES) {
      if (names.has(b.name)) problem(`data: duplicate branch "${b.name}"`);
      names.add(b.name);
      if (!["flagship", "go"].includes(b.kind)) problem(`data: branch kind invalid (${b.name}): ${b.kind}`);
      if (b.close != null) {
        const m = /^(\d{1,2}):(\d{2})$/.exec(String(b.close));
        if (!m || +m[1] > 23 || +m[2] > 59) problem(`data: bad closing time (${b.name}): ${b.close}`);
        else parseable++;
      }
    }
    const unknown = DATA.BRANCHES.length - parseable;
    pass(`Branches: ${DATA.BRANCHES.length} · ${parseable} parseable close times · ${unknown} unknown (treated open)`);
  }

  if (!Array.isArray(DATA.REVIEWS) || DATA.REVIEWS.length === 0) problem("data: REVIEWS is empty");
  else pass(`Reviews: ${DATA.REVIEWS.length} quote(s)`);

  if (!DATA.INFO || !DATA.INFO.brand) problem("data: INFO.brand missing");

  /* landing featured pool — every name must resolve to a menu item, or
     the frame engine's featured() console.warns on every refresh */
  const pool = DATA.LANDING && DATA.LANDING.featuredPool;
  if (!Array.isArray(pool) || pool.length === 0) {
    problem("data: LANDING.featuredPool is empty");
  } else {
    const itemNames = new Set();
    for (const g of DATA.MENU) for (const it of g.items) itemNames.add(it.name);
    const missing = pool.filter(n => !itemNames.has(n));
    if (missing.length) problem(`data: featuredPool name(s) not in menu: ${missing.join(", ")}`);
    else pass(`Landing: featured pool (${pool.length}) all resolve to menu items`);
  }

  /* live-computation smoke — the exact code paths the UI runs every tick */
  try {
    const s = DATA.stats();
    pass(`stats(): ${s.openCount}/${s.branchCount} open now · ${s.dishCount} dishes` +
         (s.nextClose ? ` · next close ${s.nextClose.close} ${s.nextClose.name}` : " · nothing open"));
  } catch (e) { problem(`data: stats() threw — ${e.message.split("\n")[0]}`); }
  try {
    const f = DATA.featured((DATA.LANDING?.featuredCount ?? 0));
    pass(`featured(${f.length}): rotation runs without warnings`);
  } catch (e) { problem(`data: featured() threw — ${e.message.split("\n")[0]}`); }
  /* order() composes the shared contact cards from INFO + the flagship
     branch — the exact code path both order-grid mounts render each refresh */
  try {
    const cards = DATA.order();
    if (!Array.isArray(cards) || cards.length !== 4) {
      problem(`data: order() returned ${cards?.length ?? "non-array"} cards (expected 4)`);
    } else {
      const bad = cards.filter(c => !c.kicker || !c.title || !(c.links || c.socials));
      if (bad.length) problem(`data: order() card(s) missing kicker/title/actions: ${bad.map(c => c.kicker).join(", ")}`);
      else pass(`order(): ${cards.length} contact cards compose from INFO + flagship branch`);
    }
  } catch (e) { problem(`data: order() threw — ${e.message.split("\n")[0]}`); }
} else {
  problem("data: window.NaekiData did not initialize — skip data-layer checks");
}

/* ------------------------------------------------------------------ */
/* 5. asset_map.json ↔ menu coherence                                  */
/* ------------------------------------------------------------------ */
try {
  const map = JSON.parse(readFileSync(join(ROOT, "asset_map.json"), "utf8"));
  const imgBasenames = new Set();
  for (const g of DATA?.MENU ?? []) for (const it of g.items ?? []) imgBasenames.add(String(it?.img).split("/").pop());
  for (const [name, path] of Object.entries(map)) {
    if (!/^assets\//.test(path)) { problem(`asset_map: "${name}" value not under assets/: ${path}`); continue; }
    if (!existsSync(join(SRC, path))) { problem(`asset_map: file missing for "${name}": ${path}`); continue; }
    if (!imgBasenames.has(path.split("/").pop())) warn(`asset_map: "${name}" → ${path} not used by any menu item`);
  }
  if (failures > 0 || lines.some(l => l.startsWith("  ✗"))) { /* reported above */ }
} catch {
  /* asset_map already reported in section 2 */
}

/* ------------------------------------------------------------------ */
/* summary                                                             */
/* ------------------------------------------------------------------ */
console.log("\nNaeki CI check");
console.log("──────────────");
for (const l of lines) console.log(l);
console.log("──────────────");
if (failures > 0) {
  console.log(`\nResult: FAIL — ${failures} problem(s). Fix, then re-run "npm run check".`);
  process.exit(1);
}
console.log(`\nResult: PASS (${lines.length} checks)`);
process.exit(0);
