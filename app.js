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

  /* ---------------- View switching ---------------- */
  $$(".side-link").forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".side-link").forEach(b => b.classList.toggle("active", b === btn));
      $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + btn.dataset.view));
    });
  });
  $("#brand-home").addEventListener("click", () => {
    $('.side-link[data-view="menu"]').click();
    $("#main").scrollTo({ top: 0, behavior: "smooth" });
  });

  /* ---------------- Menu render ---------------- */
  const chipRoot = $("#chips");
  const menuRoot = $("#menu-root");
  const searchInput = $("#menu-search");
  const countEl = $("#menu-count");

  let activeCat = "all";

  function renderChips() {
    const cats = [{ id: "all", name: "All", jp: "全て" }]
      .concat(NAEKI.MENU.map(g => ({ id: g.id, name: g.name, jp: g.jp })));
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

    const groups = NAEKI.MENU.filter(g => activeCat === "all" || g.id === activeCat);

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

  $("#also-list").innerHTML = NAEKI.ALSO.join('<span class="sep">·</span>');

  searchInput.addEventListener("input", renderMenu);
  renderChips();
  renderMenu();

  /* ---------------- Branches ---------------- */
  const branchList = $("#branch-list");
  const branchSearch = $("#branch-search");
  const branchCount = $("#branch-count");

  function parseClose(hhmm) {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }

  function isOpenNow(closeStr) {
    if (!closeStr) return true; // unknown → assume open, don't claim closed
    const now = new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour12: false });
    const [h, m] = now.split(":").map(Number);
    const mins = h * 60 + m;
    const close = parseClose(closeStr);
    return mins < close;
  }

  function renderBranches() {
    const q = branchSearch.value.trim().toLowerCase();
    branchList.innerHTML = "";
    let shown = 0;
    NAEKI.BRANCHES
      .filter(b => !q ||
        b.name.toLowerCase().includes(q) ||
        b.area.toLowerCase().includes(q) ||
        (b.where || "").toLowerCase().includes(q))
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "flagship" ? -1 : 1))
      .forEach(b => {
        const open = isOpenNow(b.close);
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
          ${b.note ? `<div class="b-where" style="margin-top:6px">${b.note}</div>` : ""}`;
        const go = () =>
          window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.name + " Bangkok")}`, "_blank");
        el.addEventListener("click", go);
        el.addEventListener("keydown", e => {
          if (e.key === "Enter") go();
        });
        branchList.appendChild(el);
        shown++;
      });
    branchCount.textContent = `${shown} / ${NAEKI.BRANCHES.length} branches`;
  }
  branchSearch.addEventListener("input", renderBranches);
  renderBranches();

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
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) closeModal(); });

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