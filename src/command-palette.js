/// <reference path="./types.d.ts" />
/* NAEKI SHOWCASE — command palette (⌘K / Ctrl-K).
   Keyboard-first control over the whole app: fuzzy search across
   navigation, dishes, branches and rewards actions. It drives the REAL
   surfaces — every action clicks the same controls the UI does, so there
   is exactly one code path. Works on the landing page (views) and in the
   app (tabs, segments, actions). CSP-safe: built DOM, wired listeners,
   no inline handlers. */
window.NaekiPalette = (() => {
  "use strict";

  const S = window.NaekiStore;
  const D = window.NaekiData;

  const state = { open: false, items: [], view: [], active: 0, prevFocus: null };
  let root = null, input = null, listEl = null;

  /* score: substring > word-start > gapped subsequence; -1 = no match */
  function fuzzy(hay, q) {
    hay = String(hay || "").toLowerCase();
    q = String(q || "").trim().toLowerCase();
    if (!q) return 0;
    const at = hay.indexOf(q);
    if (at >= 0) {
      const edge = at === 0 || /[\s·\-—(/]/.test(hay[at - 1] || "");
      return 100 - Math.min(at, 24) + (edge ? 15 : 0);
    }
    let hi = 0, score = 30;
    for (const ch of q) {
      const found = hay.indexOf(ch, hi);
      if (found < 0) return -1;
      score -= Math.min(found - hi, 8);
      hi = found + 1;
    }
    return score;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function clickFirst(sel) {
    const el = document.querySelector(sel);
    if (el) el.click();
    return !!el;
  }

  function navView(view) {
    return clickFirst(
      `.side-link[data-view="${view}"], .tab-btn[data-view="${view}"], .lp-link[data-view="${view}"]`);
  }

  function resetMenuFilters() {
    const si = document.getElementById("menu-search");
    if (si && si.value) { si.value = ""; si.dispatchEvent(new Event("input", { bubbles: true })); }
    const all = document.querySelector("#chips .chip");
    if (all && !all.classList.contains("active")) all.click();
  }

  function findDishCard(name) {
    return Array.from(document.querySelectorAll("#view-menu .dish"))
      .find(c => (c.querySelector("h4") || {}).textContent === name);
  }

  /* the action index, rebuilt each open — mode-aware (landing vs app) */
  function collectItems() {
    const items = [];
    const app = document.body.dataset.mode === "app";

    if (app) {
      const seg = (label, jp, tab) => items.push({
        label, jp, sub: "order",
        run: () => { navView("menu"); clickFirst(`.od-tab[data-odtab="${tab}"]`); }
      });
      seg("Order · Menu", "メニュー", "menu");
      seg("Order · Cart", "カート", "cart");
      seg("Order · Branches", "店舗", "branches");
      items.push({ label: "Chat", jp: "相談", sub: "view", run: () => navView("chat") });
      if (document.body.dataset.staff === "true")
        items.push({ label: "Partner portal", jp: "ポータル", sub: "staff", run: () => navView("partners") });

      const rw = (label, jp, tab) => items.push({
        label: "Rewards · " + label, jp, sub: "tab",
        run: () => { navView("rewards"); clickFirst(`.rw-tab[data-rwtab="${tab}"]`); }
      });
      rw("Points", "ポイント", "points");
      rw("Stamps", "スタンプ", "stamps");
      rw("Wallet", "ウォレット", "wallet");
      rw("Milestones", "達成", "milestones");
      rw("Offers feed", "オファー", "offers");

      items.push({
        label: "Add a stamp", sub: "rewards action",
        run: () => { navView("rewards"); clickFirst('.rw-tab[data-rwtab="stamps"]'); clickFirst("#stamp-add"); }
      });
      items.push({
        label: "Top up ฿300", sub: "wallet action",
        run: () => { navView("rewards"); clickFirst('.rw-tab[data-rwtab="wallet"]'); clickFirst('[data-topup="300"]'); }
      });
      items.push({
        label: "Generate referral code", sub: "give + get",
        run: () => { navView("rewards"); clickFirst('.rw-tab[data-rwtab="milestones"]'); clickFirst("#mm-make-ref"); }
      });
      items.push({
        label: "Toggle sounds", sub: "settings", kwd: "sound mute haptic audio",
        run: () => {                       // drives the real sidebar checkbox — one code path
          const el = document.getElementById("sound-toggle");
          if (el) { el.checked = !S.get().sound; el.dispatchEvent(new Event("change", { bubbles: true })); }
        }
      });

      for (const g of D.brandGroups(D.getBrand().id)) {
        for (const it of g.items) {
          items.push({
            label: it.name, sub: g.name, kwd: "dish menu order",
            run: () => {
              navView("menu");
              clickFirst('.od-tab[data-odtab="menu"]');
              resetMenuFilters();
              const card = findDishCard(it.name);
              if (card) card.click();
            }
          });
        }
      }
      for (const b of D.BRANCHES) {
        const sel = ".b-sub-toggle[data-sub=\"" +
          b.name.replace(/\\/g, "\\\\").replace(/"/g, "\\\"") + "\"]";
        items.push({
          label: b.name, sub: b.area, kwd: "branch station notify subscribe",
          run: () => {
            navView("menu");
            clickFirst('.od-tab[data-odtab="branches"]');
            if (!S.isSubscribed(b.name)) clickFirst(`.b-sub-toggle[data-sub="${b.name.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"]`);
          }
        });
      }
    } else {
      const lp = (label, jp, view) =>
        items.push({ label, jp, sub: "page", run: () => navView(view) });
      lp("Home", "ホーム", "home");
      lp("Full menu", "メニュー", "lmenu");
      lp("About us", "紹介", "about");
      lp("Franchise", "フランチャイズ", "franchise");
      lp("Customer service", "お問い合わせ", "servicedesk");
      items.push({
        label: "Open the app", sub: "sign in", kwd: "order rewards",
        run: () => clickFirst("#lp-signin")
      });
    }
    return items;
  }

  function renderList() {
    const q = input.value;
    const scored = state.items
      .map((it, i) => ({
        i,
        s: q ? Math.max(fuzzy(it.label, q), fuzzy(it.sub, q), fuzzy(it.kwd, q)) : 0
      }))
      .filter(x => x.s >= 0)
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .slice(0, 24);
    state.view = scored.map(x => x.i);
    if (state.active >= state.view.length) state.active = Math.max(0, state.view.length - 1);
    listEl.innerHTML = scored.length
      ? scored.map((x, n) => {
          const it = state.items[x.i];
          return `<li class="cp-item${n === state.active ? " active" : ""}" role="option"
            id="cp-opt-${n}" aria-selected="${n === state.active}" data-n="${n}">
            <span class="cp-item-label">${escapeHtml(it.label)}</span>
            ${it.jp ? `<span class="cp-item-jp" lang="ja">${escapeHtml(it.jp)}</span>` : ""}
            <span class="cp-item-sub">${escapeHtml(it.sub || "")}</span>
          </li>`;
        }).join("")
      : `<li class="cp-empty">Nothing matches — try a dish, a branch or a tab.</li>`;
    const act = listEl.querySelector(".cp-item.active");
    input.setAttribute("aria-activedescendant", act ? act.id : "");
    if (act) act.scrollIntoView({ block: "nearest" });
  }

  function setActive(n) {
    if (!state.view.length) return;
    state.active = (n + state.view.length) % state.view.length;
    renderList();
  }

  function run(n) {
    const it = state.items[state.view[n]];
    if (!it) return;
    close();
    it.run();
  }

  function ensureDom() {
    if (root) return;
    root = document.createElement("div");
    root.id = "cp";
    root.hidden = true;
    root.innerHTML = `
      <div class="cp-backdrop" data-cp-close></div>
      <div class="cp-panel" role="dialog" aria-modal="true" aria-label="Command palette">
        <input class="cp-input" type="text" role="combobox" aria-expanded="true"
               aria-controls="cp-list" aria-autocomplete="list"
               placeholder="Search actions, dishes, branches…" autocomplete="off" />
        <ul class="cp-list" id="cp-list" role="listbox" aria-label="Commands"></ul>
        <div class="cp-foot">
          <span>↑↓ navigate</span><span>↵ run</span><span>esc close</span>
          <span class="cp-foot-k" aria-hidden="true">⌘K</span>
        </div>
      </div>`;
    document.body.appendChild(root);
    input = root.querySelector(".cp-input");
    listEl = root.querySelector(".cp-list");

    input.addEventListener("input", () => { state.active = 0; renderList(); });
    input.addEventListener("keydown", e => {
      if (e.key === "Escape") { e.stopPropagation(); close(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); setActive(state.active + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(state.active - 1); }
      else if (e.key === "Enter") { e.preventDefault(); run(state.active); }
    });
    listEl.addEventListener("click", e => {
      const li = e.target.closest(".cp-item");
      if (li) run(Number(li.dataset.n));
    });
    listEl.addEventListener("mousemove", e => {
      const li = e.target.closest(".cp-item");
      if (li && Number(li.dataset.n) !== state.active) setActive(Number(li.dataset.n));
    });
    root.querySelector(".cp-backdrop").addEventListener("click", close);
  }

  function open() {
    ensureDom();
    state.items = collectItems();
    input.value = "";
    state.active = 0;
    state.prevFocus = document.activeElement;
    renderList();
    root.hidden = false;
    state.open = true;
    input.focus();
  }

  function close() {
    if (!root) return;
    root.hidden = true;
    state.open = false;
    if (state.prevFocus && typeof state.prevFocus.focus === "function") state.prevFocus.focus();
  }

  function toggle() { state.open ? close() : open(); }

  document.addEventListener("keydown", e => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey &&
        String(e.key).toLowerCase() === "k") {
      e.preventDefault();
      toggle();
    }
  });

  return { open, close, toggle, isOpen: () => state.open };
})();