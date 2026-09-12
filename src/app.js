/* NAEKI SHOWCASE — app logic: tabs, live search, open/closed clock, modal */
(() => {
  "use strict";

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  /* ---------------- Bangkok clock ---------------- */
  function tickClock() {
    const t = new Date().toLocaleTimeString("en-GB", {
      timeZone: "Asia/Bangkok", hour12: false
    });
    $("#clock").textContent = t;
    return t;
  }
  const bangkokHour = () => {
    const h = new Date().toLocaleString("en-GB", {
      timeZone: "Asia/Bangkok", hour: "2-digit", hour12: false
    });
    return parseInt(h, 10);
  };

  /* ---------------- Landing / App modes ----------------
     One app, two modes. "landing" (signed out) leads with the marketing
     views; "app" (local, on-device profile set) leads with the utility
     views. Mode only changes which nav links are visible + the default
     view — every view and component is shared by both. */
  const S = window.NaekiStore;
  const D = window.NaekiData;      // the data layer ("backend") — single source of truth
  let mode = S.get().profile ? "app" : "landing";
  const DEFAULT_VIEW = { landing: "home", app: "menu" };

  function goToView(name) {
    const link = $('.side-link[data-view="' + name + '"]');
    $$(".side-link").forEach(b => b.classList.toggle("active", b === link));
    $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + name));
    $("#main").scrollTo({ top: 0, behavior: "smooth" });
  }

  function applyMode(activateDefault = true) {
    mode = S.get().profile ? "app" : "landing";

    // show this mode's links, renumber them 01, 02, …
    const visible = [];
    $$(".side-link").forEach(btn => {
      const allowed = (btn.dataset.modes || "").split(" ").includes(mode);
      btn.hidden = !allowed;
      if (allowed) visible.push(btn);
    });
    visible.forEach((btn, i) => {
      btn.querySelector(".n").textContent = String(i + 1).padStart(2, "0");
    });

    // sidebar session area vs landing CTA
    const profile = S.get().profile;
    $("#side-open-app").hidden = mode !== "landing";
    $("#side-session").hidden = mode !== "app";
    if (profile) $("#session-greeting").textContent = "Hi, " + profile.name;

    if (activateDefault) goToView(DEFAULT_VIEW[mode]);
  }

  $$(".side-link").forEach(btn => {
    btn.addEventListener("click", () => {
      if (btn.hidden) return; // view not part of this mode
      $$(".side-link").forEach(b => b.classList.toggle("active", b === btn));
      $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + btn.dataset.view));
    });
  });
  $("#brand-home").addEventListener("click", () => goToView(DEFAULT_VIEW[mode]));

  // secondary nav (side-foot "About · Franchise", landing "read more" links)
  $$("button[data-view]:not(.side-link)").forEach(btn => {
    btn.addEventListener("click", () => goToView(btn.dataset.view));
  });

  /* ---------------- Sign in / out (local demo) ---------------- */
  const signin = $("#signin");
  function openSignin() {
    $("#signin-name").value = "";
    signin.hidden = false;
    $("#signin-name").focus();
  }
  function closeSignin() { signin.hidden = true; }
  ["#side-open-app", "#home-open-app", "#cta-open-app"].forEach(sel => {
    $(sel).addEventListener("click", openSignin);
  });
  $$("#signin [data-close]").forEach(el => el.addEventListener("click", closeSignin));
  $("#signin-form").addEventListener("submit", e => {
    e.preventDefault();
    if (S.setProfile($("#signin-name").value)) {
      closeSignin();
      applyMode();
    }
  });
  $("#side-signout").addEventListener("click", () => {
    S.signOut();
    applyMode();
  });

  /* ---------------- Live frames (turbo-frames-style) ----------------
     Landing regions are data-frame mounts (see frames.js). Each renderer
     sources from the data layer, so a business-data edit — hours, menu,
     reviews — repaints the landing page on the next refresh with no view
     code changes. Renderers are defined before NaekiFrames.mount(). */

  const F = window.NaekiFrames;

  const fact = (strong, span) =>
    `<div class="fact"><strong>${strong}</strong><span>${span}</span></div>`;

  F.define("facts", {
    topics: ["refresh"],
    render(el, D) {
      const s = D.stats();
      el.innerHTML =
        fact(D.INFO.founded, D.INFO.foundedNote) +
        fact(s.branchCount, "branches across the city") +
        fact(s.openCount + " open", "right now, live from branch hours") +
        fact(D.INFO.flagshipRating, D.INFO.flagshipReviews) +
        fact(s.dishCount, "dishes highlighted · " + s.alsoCount + " more daily");
    }
  });

  F.define("open-now", {
    topics: ["refresh", "tick"],
    render(el, D) {
      const s = D.stats();
      const closing = s.nextClose
        ? ` · next closes ${D.shortName(s.nextClose)} @ ${s.nextClose.close}`
        : "";
      el.innerHTML = `
        <span class="lb-dot ${s.openCount ? "open" : "closed"}"></span>
        <strong>${s.openCount}</strong> of ${s.branchCount} branches open now${closing}
        <span class="lb-live">LIVE · refreshed ${s.lastRefreshAt ? s.lastRefreshAt.str.slice(0, 5) : "just now"} ICT</span>`;
    }
  });

  F.define("featured", {
    topics: ["refresh"],
    render(el, D) {
      el.innerHTML = "";
      D.featured().forEach(({ item, group }) => el.appendChild(dishCard(item, group)));
    }
  });

  F.define("reviews", {
    topics: ["refresh"],
    render(el, D) {
      el.innerHTML = D.REVIEWS
        .map(r => `<div class="quote"><p>“${r.text}”</p><span>${r.src}</span></div>`)
        .join("");
    }
  });

  F.define("hours", {
    topics: ["refresh", "tick"],
    render(el, D) {
      const s = D.stats();
      el.innerHTML = "";
      D.BRANCHES
        .filter(b => b.kind === "flagship")
        .slice(0, D.LANDING.previewBranches)
        .forEach(b => {
          const open = D.isOpenNow(b, s.now);
          const card = document.createElement("article");
          card.className = "hour-card";
          card.tabIndex = 0;
          card.setAttribute("role", "link");
          card.setAttribute("aria-label", `${b.name} — open on Google Maps`);
          card.innerHTML = `
            <div class="hc-top">
              <h4>${b.name}</h4>
              <span class="b-kind ${b.kind}">${b.kind === "flagship" ? "SUSHI" : "GO!"}</span>
            </div>
            <div class="b-where">${b.where}${b.area ? " — " + b.area : ""}</div>
            <div class="b-meta">
              <span class="b-status ${open ? "open" : "closed"}">
                <i class="dot ${open ? "open" : "closed"}"></i>${open ? "Open now" : "Closed for today"}
              </span>
              ${b.close ? `<span class="b-close">until ${b.close}</span>` : ""}
            </div>`;
          const go = () =>
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.name + " Bangkok")}`, "_blank");
          card.addEventListener("click", go);
          card.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
          el.appendChild(card);
        });
    }
  });

  F.mount();

  $("#home-browse-menu").addEventListener("click", () => goToView("menu"));
  $("#home-full-menu").addEventListener("click", () => goToView("menu"));
  // "All branches in the app →" — gates into the app like the other CTAs
  $("#hours-open-app").addEventListener("click", openSignin);

  applyMode();

  /* ---------------- Menu render ---------------- */
  const chipRoot = $("#chips");
  const menuRoot = $("#menu-root");
  const searchInput = $("#menu-search");
  const countEl = $("#menu-count");

  let activeCat = "all";

  function renderChips() {
    const cats = [{ id: "all", name: "All", jp: "全て" }]
      .concat(D.MENU.map(g => ({ id: g.id, name: g.name, jp: g.jp })));
    chipRoot.innerHTML = "";
    cats.forEach(c => {
      const b = document.createElement("button");
      b.className = "chip" + (c.id === activeCat ? " active" : "");
      b.setAttribute("role", "tab");
      b.innerHTML = `${c.name}<span class="jp">${c.jp}</span>`;
      b.addEventListener("click", () => {
        activeCat = c.id;
        renderChips();
        renderMenu();
      });
      chipRoot.appendChild(b);
    });
  }

  function dishCard(item, group) {
    const card = document.createElement("article");
    card.className = "dish";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", item.name);
    card.innerHTML = `
      <div class="dish-wrap"><img loading="lazy" src="${item.img}" alt="${item.name}"></div>
      <div class="dish-body">
        <h4>${item.name}</h4>
        <div class="dish-sub">${item.sub || ""}</div>
      </div>`;
    const open = () => openModal(item, group);
    card.addEventListener("click", open);
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
    return card;
  }

  function renderMenu() {
    const q = searchInput.value.trim().toLowerCase();
    let shown = 0;
    menuRoot.innerHTML = "";

    const groups = D.MENU.filter(g => activeCat === "all" || g.id === activeCat);

    groups.forEach(group => {
      const items = group.items.filter(it =>
        !q || it.name.toLowerCase().includes(q) ||
        (it.sub || "").toLowerCase().includes(q) ||
        group.name.toLowerCase().includes(q)
      );
      if (!items.length) return;

      const sec = document.createElement("section");
      sec.className = "menu-group";
      sec.innerHTML = `
        <div class="group-head">
          <h3>${group.name}</h3>
          <span class="jp">${group.jp}</span>
          <span class="rule"></span>
          <span class="n-items">${items.length} items</span>
        </div>
        <p class="group-desc">${group.desc}</p>`;
      const grid = document.createElement("div");
      grid.className = "dish-grid";
      items.forEach(it => { grid.appendChild(dishCard(it, group)); shown++; });
      sec.appendChild(grid);
      menuRoot.appendChild(sec);
    });

    countEl.textContent = q || activeCat !== "all"
      ? `${shown} shown`
      : `${shown} highlights · full menu daily in-store`;
    $("#also-strip").hidden = !!(q || activeCat !== "all");
  }

  $("#also-list").innerHTML = D.ALSO.join('<span class="sep">·</span>');

  searchInput.addEventListener("input", renderMenu);
  renderChips();
  renderMenu();

  /* ---------------- Branches ----------------
     Consumes the same data layer + status helpers the landing frames use;
     re-renders on the minute tick so statuses flip live at closing time. */
  const branchList = $("#branch-list");
  const branchSearch = $("#branch-search");
  const branchCount = $("#branch-count");

  function renderBranches() {
    const q = branchSearch.value.trim().toLowerCase();
    const now = D.bangkokParts();
    branchList.innerHTML = "";
    let shown = 0;
    D.BRANCHES
      .filter(b => !q ||
        b.name.toLowerCase().includes(q) ||
        b.area.toLowerCase().includes(q) ||
        (b.where || "").toLowerCase().includes(q))
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "flagship" ? -1 : 1))
      .forEach(b => {
        const open = D.isOpenNow(b, now);
        const el = document.createElement("article");
        el.className = "branch";
        el.tabIndex = 0;
        el.setAttribute("role", "link");
        el.setAttribute("aria-label", `${b.name} — open on Google Maps`);
        el.innerHTML = `
          <div class="branch-top">
            <h4>${b.name}</h4>
            <span class="b-kind ${b.kind}">${b.kind === "flagship" ? "SUSHI" : "GO!"}</span>
          </div>
          <div class="b-where">${b.where || ""}${b.area ? " — " + b.area : ""}</div>
          <div class="b-meta">
            <span class="b-status ${open ? "open" : "closed"}">
              <i class="dot ${open ? "open" : "closed"}"></i>${open ? "Open now" : "Closed for today"}
            </span>
            ${b.close ? `<span class="b-close">until ${b.close}</span>` : ""}
            ${b.phone ? `<span class="b-close">${b.phone}</span>` : ""}
          </div>
          ${b.note ? `<div class="b-where b-note">${b.note}</div>` : ""}`;
        const go = () =>
          window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.name + " Bangkok")}`, "_blank");
        el.addEventListener("click", go);
        el.addEventListener("keydown", e => {
          if (e.key === "Enter") go();
        });
        branchList.appendChild(el);
        shown++;
      });
    branchCount.textContent = `${shown} / ${D.BRANCHES.length} branches`;
  }
  branchSearch.addEventListener("input", renderBranches);
  renderBranches();
  D.subscribe("tick", renderBranches);

  /* ---------------- Stamp card (local demo, via NaekiStore) ---------------- */
  const stampGrid = $("#stamp-grid");
  const stampCount = $("#stamp-count");
  const stampTotal = $("#stamp-total");
  const stampFill = $("#stamp-progress-fill");
  const stampHistory = $("#stamp-history");
  const stampRedeem = $("#stamp-redeem");

  // one triangular onigiri stamp, reused for every slot
  const STAMP_SVG = `
    <svg viewBox="0 0 40 36" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path class="st-body" d="M20 3 L34.5 28.5 Q35.4 31 32.5 31 L7.5 31 Q4.6 31 5.5 28.5 Z"/>
      <rect class="st-nori" x="16" y="21" width="8" height="7" rx="2"/>
      <circle class="st-salmon" cx="14" cy="11" r="2.6"/>
    </svg>`;

  function fmtWhen(ts) {
    return new Date(ts).toLocaleString(undefined, {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });
  }

  function renderStamps() {
    const card = S.card();
    const n = card.stamps.length;

    stampGrid.innerHTML = "";
    for (let i = 0; i < card.size; i++) {
      const slot = document.createElement("div");
      slot.className = "stamp-slot" + (i < n ? " filled" : "");
      slot.innerHTML = STAMP_SVG;
      stampGrid.appendChild(slot);
    }
    stampCount.textContent = n;
    stampTotal.textContent = "/ " + card.size;
    stampFill.style.width = (n / card.size) * 100 + "%";
    stampRedeem.disabled = n < card.size;

    stampHistory.innerHTML = "";
    const entries = [
      ...card.redemptions.map(r => ({ ts: r.ts, cls: "redeem", text: `Redeemed — ${r.reward} (${r.stampCount} stamps)` })),
      ...card.stamps.map(s => ({ ts: s.ts, cls: "stamp", text: "Stamp collected" }))
    ].sort((a, b) => b.ts - a.ts);

    if (!entries.length) {
      const li = document.createElement("li");
      li.className = "stamp-empty";
      li.textContent = "No stamps yet — collect your first one.";
      stampHistory.appendChild(li);
    } else {
      entries.forEach(e => {
        const li = document.createElement("li");
        li.className = e.cls;
        li.innerHTML = `<span class="sh-what"></span><span class="sh-when"></span>`;
        li.querySelector(".sh-what").textContent = e.text;
        li.querySelector(".sh-when").textContent = fmtWhen(e.ts);
        stampHistory.appendChild(li);
      });
    }
  }

  $("#stamp-add").addEventListener("click", () => {
    S.addStamp();
    const n = S.card().stamps.length;
    if (n === S.card().size) $("#stamp-redeem").focus();
    renderStamps();
  });

  stampRedeem.addEventListener("click", () => {
    if (S.redeem("Free drink (demo)")) renderStamps();
  });

  $("#stamp-reset").addEventListener("click", () => {
    S.reset();
    renderStamps();
  });

  renderStamps();

  /* ---------------- Modal ---------------- */
  const modal = $("#modal");
  function openModal(item, group) {
    $("#modal-img").src = item.img;
    $("#modal-img").alt = item.name;
    $("#modal-cat").textContent = group.name + " · " + group.jp;
    $("#modal-title").textContent = item.name;
    $("#modal-jp").textContent = item.jp || "";
    $("#modal-desc").textContent =
      item.story || `${item.sub || ""} — shaped fresh daily at the counter, no preservatives. Availability rotates; check the LINE OA for today's line-up.`;
    const q = $("#modal-quote");
    if (item.quote) { q.hidden = false; q.textContent = "“" + item.quote + "”"; }
    else q.hidden = true;
    $("#modal-find").href =
      "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("Naeki Sushi BTS Siam Bangkok");
    modal.hidden = false;
    $(".modal-x").focus();
  }
  function closeModal() { modal.hidden = true; }
  $$("[data-close]", modal).forEach(el => el.addEventListener("click", closeModal));
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (!modal.hidden) closeModal();
      if (!signin.hidden) closeSignin();
    }
  });

  /* ---------------- External links → system browser ---------------- */
  $$("a[data-external]").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      window.open(a.href, "_blank");
    });
  });

  /* ---------------- Clock loop ---------------- */
  tickClock();
  setInterval(tickClock, 1000);

  /* ---------------- PWA service worker ----------------
     Only registers when actually served over http(s) — the Electron build
     loads via file://, and dev file:// opens shouldn't error in console. */
  if ("serviceWorker" in navigator &&
      (location.protocol === "https:" ||
       ["localhost", "127.0.0.1"].includes(location.hostname))) {
    navigator.serviceWorker.register("sw.js").catch(() => { /* offline-first still works without it */ });
  }

  /* ---------------- Splash sequence ----------------
     stand draws → ball rolls → POP! (onigiri + stars) → fade to app.
     Timing vars live in styles.css (:root block). Skips entirely on
     prefers-reduced-motion and always fails safe to the app. */
  const splash = $("#splash");
  if (splash) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      splash.remove();
    } else {
      const css = getComputedStyle(document.documentElement);
      const s = (name) => (parseFloat(css.getPropertyValue(name)) || 0) * 1000;
      const T = {
        draw: s("--splash-draw"),
        fill: s("--splash-fill"),
        popIn: s("--splash-pop-in"),
        hold: s("--splash-hold"),
        fade: s("--splash-fade")
      };
      const popInDelay = 0.12 * 1000; // matches .splash-pop animation-delay

      // app starts hidden behind the splash, fades in after
      const app = $("#app");
      app.style.opacity = "0";
      app.style.transition = "opacity 0.3s ease";

      // per-stroke draw delays via CSSOM (CSP blocks inline style attributes)
      $$("#art-stand .draw").forEach(p => {
        if (p.dataset.d) p.style.setProperty("--d", p.dataset.d);
      });

      /* pie-chart fill: a black wedge sweeps 12 o'clock → 360° inside the
         ring; the same wedge clip reveals the orange line-art clone. */
      const fillSweep = (duration, onDone) => {
        const pie = $("#pie-path");
        const wipe = $("#wipe-path");
        const cx = 130, cy = 132, r = 260; // wedge radius ≥ ring outer radius
        const start = performance.now();
        const tick = (now) => {
          const t = Math.min(1, (now - start) / duration);
          if (t >= 1) {
            // full circle would degenerate (arc start == end) — clamp to full cover
            const full = "M-2000 -2000 H4000 V4000 H-2000 Z";
            pie.setAttribute("d", full);
            wipe.setAttribute("d", full);
            onDone && onDone();
            return;
          }
          const ang = t * 2 * Math.PI; // clockwise from 12 o'clock
          const ex = cx + r * Math.sin(ang);
          const ey = cy - r * Math.cos(ang);
          const large = ang > Math.PI ? 1 : 0;
          const d = `M${cx} ${cy} L${cx} ${cy - r} A${r} ${r} 0 ${large} 1 ${ex.toFixed(1)} ${ey.toFixed(1)} Z`;
          pie.setAttribute("d", d);
          wipe.setAttribute("d", d);
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      };

      requestAnimationFrame(() => {
        splash.classList.add("phase-draw");            // ring + stand draw on
        setTimeout(() => {                             // pie fill sweeps over it
          splash.classList.add("phase-fill");
          fillSweep(T.fill);
        }, T.draw - 120);
        setTimeout(() => splash.classList.add("phase-roll"), T.draw + T.fill + 40);
        const popDone = T.draw + T.fill + popInDelay + T.popIn + T.hold;
        setTimeout(() => {                              // fade splash out
          splash.classList.add("phase-out");
          app.style.opacity = "1";
        }, popDone);
        setTimeout(() => {
          splash.classList.add("done");
          splash.remove();
        }, popDone + T.fade + 120);
      });
    }
  }
})();