/* NAEKI CI — mobile layout audit (rendered, real Chromium, 390px).
   Runs the actual app offscreen and asserts the phone invariants that
   broke before without anyone noticing:

     - no horizontal document overflow in any view (either shell)
     - no element pokes past the viewport (outside scroll containers)
     - landing grids collapse to one column at phone width
     - nav pills, chips and buttons keep a >=36px touch target
     - dish modal fits the viewport

   Why rendered, not static: v1.6.0 shipped phone CSS rules that existed
   but didn't achieve anything — the landing header still overflowed at
   390px. File checks passed; layout was broken. Only measuring the real
   rendered DOM catches that class of regression.

   Run     : npm run check:mobile
   On commit: .githooks/pre-commit (after validate.mjs; skipped with
              NAEKI_SKIP_MOBILE=1, everything with NAEKI_SKIP=1)
   Not in CI: needs a display + Electron; CI is deliberately zero-dep.
              The pre-commit hook is where this guards ship.

   Self-test: NAEKI_AUDIT_BREAK=1 npm run check:mobile injects an
   oversized element before auditing — the audit must FAIL. Proves the
   detector actually detects. */

const { app, BrowserWindow, session } = require("electron");
const path = require("path");

const W = 390, H = 844;            // iPhone-class viewport, layout px
const TOUCH_FLOOR = 36;             // px; project standard is ~44 for nav
const ROOT = path.join(__dirname, "..");

const lines = [];
let failures = 0;
const pass = (m) => lines.push(`  ✓ ${m}`);
const fail = (m) => (lines.push(`  ✗ ${m}`), failures++);
const note = (m) => lines.push(`  △ ${m}`);

/* The audit payload — runs inside the renderer. Returns a JSON report.
   __SHELL__ is replaced with "landing" or "app" before execution. */
const AUDIT_JS = `(() => {
  const vw = document.documentElement.clientWidth;
  const out = { views: {}, grids: {}, touch: [], modal: null };

  /* an element only counts as an offender if it is NOT inside a
     horizontally scrollable container (side-nav/lp-nav scroll by design) */
  const scrollable = (el) => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const ox = getComputedStyle(a).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
    return false;
  };

  const offenders = (root) => {
    const bad = [];
    root.querySelectorAll("*").forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && !scrollable(el) &&
          (r.right > vw + 1 || r.left < -1)) {
        bad.push((el.id || String(el.className) || el.tagName).slice(0, 44) +
                 " R" + Math.round(r.right));
      }
    });
    return bad.slice(0, 6);
  };

  const isLanding = "__SHELL__" === "landing";
  const names = isLanding ? ["home", "lmenu", "about", "franchise", "servicedesk"]
                          : ["menu", "cart", "branches", "stamps", "rewards", "wallet", "order", "milestones"];

  names.forEach(v => {
    const btn = document.querySelector(
      (isLanding ? ".lp-link" : ".side-link") + '[data-view="' + v + '"]');
    if (btn) btn.click();
    const view = document.getElementById("view-" + v);
    out.views[v] = {
      overflowX: document.documentElement.scrollWidth - vw,
      offenders: offenders(view)
    };
    /* phone invariants for this view, measured WHILE ACTIVE — computed
       grid values on display:none elements are unreliable, so grids are
       read here, per view, not after the loop */
    if (isLanding && (v === "home" || v === "lmenu")) {
      const oneCol = (sel, label) => {
        const el = view.querySelector(sel);
        if (!el) { out.grids[label] = "missing"; return; }
        const cols = getComputedStyle(el).gridTemplateColumns.split(" ").length;
        out.grids[label] = cols;
      };
      if (v === "home") {
        oneCol(".home-hero", "hero");
        oneCol(".home-hours", "hours");
        oneCol(".home-featured", "featured");
        oneCol(".home-teasers", "teasers");
        oneCol(".order-grid", "order");
      }
      // landing menu list: rows are stacked, nothing off-viewport
      if (v === "lmenu") {
        out.lmenuRows = view.querySelectorAll(".lmenu-list li").length;
      }
    }
  });

  /* touch targets: visible controls must clear the floor */
  const seen = new Set();
  document.querySelectorAll(".side-link, .lp-link, .chip, .btn").forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;     // display:none shells/views
    if (seen.has(el)) return;
    seen.add(el);
    if (r.height < ${TOUCH_FLOOR}) {
      out.touch.push((el.id || String(el.className) || el.tagName).slice(0, 36) +
                     " h" + Math.round(r.height));
    }
  });

  /* dish modal fits (app shell only — the menu has the dish cards) */
  if (!isLanding) {
    const dish = document.querySelector("#view-menu .dish");
    if (dish) {
      dish.click();
      const modal = document.getElementById("modal");
      const card = modal && modal.querySelector(".modal-card");
      if (card && !modal.hidden) {
        const r = card.getBoundingClientRect();
        out.modal = { width: Math.round(r.width), fits: r.right <= vw + 1 };
      }
    }
  }

  /* sign-in modal fits (landing shell — the gate most first-time mobile
     users hit; a regression here ships to every new visitor) */
  if (isLanding) {
    const gate = document.getElementById("lp-signin");
    if (gate) {
      gate.click();
      const modal = document.getElementById("signin");
      const card = modal && modal.querySelector(".modal-card");
      if (card && !modal.hidden) {
        const r = card.getBoundingClientRect();
        const input = modal.querySelector("#signin-name");
        const ir = input ? input.getBoundingClientRect() : null;
        out.signin = {
          width: Math.round(r.width),
          fits: r.right <= vw + 1 && r.left >= -1,
          inputInsideCard: !ir || (ir.right <= r.right && ir.left >= r.left)
        };
      }
    }
  }

  /* populated-cart layout (app shell): seed lines THROUGH THE UI (the plus
     button), so the cart view renders via the real sync path, then verify
     the row geometry at phone width */
  if (!isLanding) {
    /* milestones view renders all 7 achievements + the 7-point trust pane */
    const mmBtn = document.querySelector('.side-link[data-view="milestones"]');
    if (mmBtn) {
      mmBtn.click();
      const mmView = document.getElementById('view-milestones');
      out.milestones = {
        tiles: mmView ? mmView.querySelectorAll('.mm-tile').length : -1,
        trust: mmView ? mmView.querySelectorAll('.mm-trust li').length : -1
      };
    }
    try {
      const firstDish = document.querySelector('#view-menu .dish .d-plus');
      if (firstDish) {
        firstDish.click(); firstDish.click();
        const cartBtn = document.querySelector('.side-link[data-view="cart"]');
        if (cartBtn) cartBtn.click();
        const li = document.querySelector(".cart-list li");
        if (li) {
          const r = li.getBoundingClientRect();
          out.cartRow = {
            fits: r.right <= vw + 1,
            stepperH: Math.round(li.querySelector(".c-stepper").getBoundingClientRect().height),
            total: document.querySelector(".cart-total strong")?.textContent || null
          };
        }
      }
      // leave the store clean for the next run
      NaekiStore.clearCart();
      document.querySelector('.side-link[data-view="menu"]')?.click();
    } catch (e) { out.cartRow = { error: String(e).slice(0, 60) }; }
  }

  return JSON.stringify(out);
})()`;

/* Splash kill: the decorative loader hides the shell for ~3s and fades it
   in via CSSOM opacity. Removing it and restoring opacity lets the audit
   measure real layout immediately instead of waiting out the animation.
   (Detached-element timers in app.js fail safe — they just no-op.) */
const SETTLE_JS = `(() => {
  const s = document.getElementById("splash");
  if (s) s.remove();
  const shell = document.body.dataset.mode === "app"
    ? document.getElementById("app") : document.getElementById("landing");
  if (shell) { shell.style.opacity = "1"; shell.style.transition = "none"; }
  return document.body.dataset.mode;
})()`;

const BREAK_JS = `(() => {
  /* plant a defect the audit must catch: a 520px-wide static element inside
     the ACTIVE view — static elements create document overflow and appear
     in the view-rooted offender scan. (A fixed element on <body> would
     evade both checks — that was the first self-test's lesson.) */
  const view = document.querySelector(".view.active") || document.body;
  const d = document.createElement("div");
  d.id = "audit-break";
  d.style.cssText = "width:520px;height:4px;background:#f00";
  view.appendChild(d);
  return "planted in " + (view.id || "body");
})()`;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function shellReport(report, shellName, expectedViews) {
  for (const v of expectedViews) {
    const r = report.views[v];
    if (!r) { fail(`${shellName}/${v}: no audit data`); continue; }
    if (r.overflowX > 1) fail(`${shellName}/${v}: horizontal overflow ${r.overflowX}px`);
    else pass(`${shellName}/${v}: no horizontal overflow`);
    if (r.offenders.length) fail(`${shellName}/${v}: ${r.offenders.length} element(s) past viewport — ${r.offenders.join(" | ")}`);
  }
  if (shellName === "landing") {
    for (const [label, cols] of Object.entries(report.grids)) {
      if (cols === "missing") { fail(`landing grid missing: ${label}`); continue; }
      if (cols === 1) pass(`landing grid ${label}: 1 column at ${W}px`);
      else fail(`landing grid ${label}: ${cols} columns at ${W}px (expected 1)`);
    }
  }
  if (report.touch.length) fail(`touch targets under ${TOUCH_FLOOR}px in ${shellName}: ${report.touch.join(", ")}`);
  else pass(`${shellName}: touch targets ≥ ${TOUCH_FLOOR}px`);
  if (shellName === "app") {
    if (report.modal) {
      if (report.modal.fits) pass(`dish modal fits (${report.modal.width}px)`);
      else fail(`dish modal overflows (${report.modal.width}px > ${W}px)`);
    } else fail("dish modal did not open for audit");
  }
  if (shellName === "landing") {
    if (report.signin) {
      if (report.signin.fits && report.signin.inputInsideCard) {
        pass(`sign-in modal fits (${report.signin.width}px, input inside card)`);
      } else if (!report.signin.fits) {
        fail(`sign-in modal overflows (${report.signin.width}px at viewport ${W}px)`);
      } else {
        fail("sign-in input pokes outside the modal card");
      }
    } else fail("sign-in modal did not open for audit");
    if (typeof report.lmenuRows === "number") {
      if (report.lmenuRows >= 38) pass(`landing menu renders ${report.lmenuRows} rows`);
      else fail(`landing menu rows missing (got ${report.lmenuRows})`);
    }
  }
  if (shellName === "app" && report.cartRow) {
    if (report.cartRow.error) fail(`cart row audit error: ${report.cartRow.error}`);
    else if (report.cartRow.fits && report.cartRow.stepperH >= 30) {
      pass(`cart row fits, stepper ${report.cartRow.stepperH}px tall`);
    } else fail(`cart row problem: fits=${report.cartRow.fits} stepperH=${report.cartRow.stepperH}`);
  }
  if (shellName === "app" && report.milestones) {
    if (report.milestones.tiles === 7) pass(`milestones: 7 achievement tiles render`);
    else fail(`milestones: expected 7 tiles, got ${report.milestones.tiles}`);
    if (report.milestones.trust === 7) pass(`trust pane: 7 items render`);
    else fail(`trust pane: expected 7 items, got ${report.milestones.trust}`);
  }
}

async function auditPass(win, shell) {
  if (process.env.NAEKI_AUDIT_BREAK === "1") {
    await win.webContents.executeJavaScript(BREAK_JS, false);
  }
  await sleep(600);   // paint + first frames render
  const raw = await win.webContents.executeJavaScript(
    AUDIT_JS.replace("__SHELL__", shell), false);
  return JSON.parse(raw);
}

async function main() {
  await app.whenReady();

  // deterministic start: no persisted profile -> landing shell guaranteed
  await session.defaultSession.clearStorageData();

  const win = new BrowserWindow({
    width: W, height: H,
    useContentSize: true,          // content viewport is exactly W×H
    show: false,
    backgroundColor: "#101012",
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  /* ---- pass 1: landing (signed out) ---- */
  await win.loadFile(path.join(ROOT, "src", "index.html"), { query: { v: "audit" } });
  await win.webContents.executeJavaScript(SETTLE_JS, false);
  const modeSeen = await win.webContents.executeJavaScript(
    "document.body.dataset.mode", false);
  if (modeSeen !== "landing") {
    fail(`expected landing shell signed out, got "${modeSeen}"`);
  } else {
    pass("signed out renders the landing shell (body[data-mode=landing])");
    const landing = await auditPass(win, "landing");
    shellReport(landing, "landing", ["home", "lmenu", "about", "franchise", "servicedesk"]);
  }

  /* ---- pass 2: app (signed in) ---- */
  await win.webContents.executeJavaScript(
    "NaekiStore.setProfile('mobile-audit')", false);
  await new Promise((resolve) => {
    win.webContents.once("did-finish-load", resolve);
    win.webContents.reload();
  });
  const modeSeen2 = await win.webContents.executeJavaScript(
    "document.body.dataset.mode", false);
  if (modeSeen2 !== "app") {
    fail(`expected app shell signed in, got "${modeSeen2}"`);
  } else {
    pass("sign-in swaps to the app shell (body[data-mode=app])");
    const appReport = await auditPass(win, "app");
    shellReport(appReport, "app", ["menu", "cart", "branches", "stamps", "rewards", "wallet", "order", "milestones"]);
  }

  console.log("\nNaeki mobile audit — 390px rendered layout");
  console.log("──────────────────────────────────────────");
  for (const l of lines) console.log(l);
  console.log("──────────────────────────────────────────");

  if (process.env.NAEKI_AUDIT_BREAK === "1") {
    /* self-test semantics are inverted: the audit is supposed to FAIL.
       It caught the planted defect → detector works (exit 0). It sailed
       through → the detector is broken (exit 1). */
    if (failures > 0) {
      console.log("\nSelf-test PASSED: detector caught the planted 520px defect " +
                  `(${failures} failure(s) above).`);
      app.exit(0);
    } else {
      console.log("\nSelf-test FAILED: detector missed the planted 520px defect — " +
                  "the audit is not protecting mobile. Do not trust it; fix the checks.");
      app.exit(1);
    }
    return;
  }

  if (failures > 0) {
    console.log(`\nResult: FAIL — ${failures} mobile layout problem(s).`);
    console.log("Fix styles.css (see the phone @media block), then re-run: npm run check:mobile");
    app.exit(1);
  } else {
    console.log(`\nResult: PASS (${lines.length} checks)`);
    app.exit(0);
  }
}

main().catch((e) => { console.error("audit crashed:", e); app.exit(2); });