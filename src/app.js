/* NAEKI SHOWCASE — app logic: tabs, live search, open/closed clock, modal */
(() => {
  "use strict";

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  /* indicative-price formatter (see data.js: prices are demo THB) */
  const fmtBaht = (n) => "฿" + Math.round(Number(n) || 0);

  /* registry of live dish-card qty syncs, keyed by menu-item name —
     lets the cart view / checkout resync every visible stepper at once.
     Declared here (not near dishCard) because F.mount() builds featured
     cards at load time, before the later const declarations run. */
  const orderables = new Map();

  /* ---------------- Bangkok clock ---------------- */
  function tickClock() {
    const t = new Date().toLocaleTimeString("en-GB", {
      timeZone: "Asia/Bangkok", hour12: false
    });
    $("#clock").textContent = t;
    return t;
  }

  /* ---------------- Landing / App shells ----------------
     Two shells over one data layer. Signed out: the PLAIN landing page
     (#landing — own slim header, natural page scroll, marketing views).
     Signed in (local, on-device profile): the app shell (#app — sidebar,
     utility views). The landing page never shows app chrome; it references
     the same live data through the frame engine. body[data-mode] owns
     which shell is visible (see styles.css). */
  const S = window.NaekiStore;
  const D = window.NaekiData;      // the data layer ("backend") — single source of truth
  let mode = S.get().profile ? "app" : "landing";
  const DEFAULT_VIEW = { landing: "home", app: "menu" };

  function goToView(name) {
    const view = $("#view-" + name);
    if (!view) return;
    const shell = view.closest("#landing") ? $("#landing") : $("#app");
    // one active view per shell; light up that shell's nav links to match
    $$(".view", shell).forEach(v => v.classList.toggle("active", v === view));
    $$(".lp-link, .side-link", shell).forEach(b =>
      b.classList.toggle("active", b.dataset.view === name));
    // each shell has its own scroller: the page (landing) or #main (app)
    if (shell.id === "landing") window.scrollTo({ top: 0, behavior: "smooth" });
    else $("#main").scrollTo({ top: 0, behavior: "smooth" });
  }

  function applyMode(activateDefault = true) {
    mode = S.get().profile ? "app" : "landing";
    // CSS owns shell visibility from here (body[data-mode])
    document.body.dataset.mode = mode;

    const profile = S.get().profile;
    if (profile) $("#session-greeting").textContent = "Hi, " + profile.name;

    if (activateDefault) goToView(DEFAULT_VIEW[mode]);
  }

  /* sign-in handoff: flip to app mode, then land on the CTA's target (if any)
     instead of the default view — "All branches in the app →" reaches branches */
  function enterApp(view) {
    applyMode(false);                     // don't bounce through the default
    goToView(view || DEFAULT_VIEW.app);
  }

  $$(".side-link").forEach(btn => {
    btn.addEventListener("click", () => goToView(btn.dataset.view));
  });
  $("#brand-home").addEventListener("click", () => goToView(DEFAULT_VIEW.app));

  // secondary nav (landing header brand + section links, landing "read more" links)
  $$("button[data-view]:not(.side-link):not(.lp-link)").forEach(btn => {
    btn.addEventListener("click", () => goToView(btn.dataset.view));
  });
  $$(".lp-link, .lp-brand").forEach(btn => {
    btn.addEventListener("click", () => goToView(btn.dataset.view));
  });

  /* ---------------- Sign in / out (local demo) ---------------- */
  const signin = $("#signin");
  // landing CTAs may carry data-goto to say where sign-in should land
  // ("All branches in the app →" → branches, not the default menu)
  let pendingView = null;
  function openSignin(e) {
    pendingView = (e && e.currentTarget && e.currentTarget.dataset.goto) || null;
    $("#signin-name").value = "";
    signin.hidden = false;
    $("#signin-name").focus();
  }
  function closeSignin() { signin.hidden = true; }
  ["#lp-signin", "#home-open-app", "#cta-open-app", "#hours-open-app", "#lmenu-order-now"].forEach(sel => {
    $(sel).addEventListener("click", openSignin);
  });
  $$("#signin [data-close]").forEach(el => el.addEventListener("click", closeSignin));
  $("#signin-form").addEventListener("submit", e => {
    e.preventDefault();
    if (S.setProfile($("#signin-name").value)) {
      closeSignin();
      enterApp(pendingView);
      pendingView = null;
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
      // landing display-only: no ordering chrome on the marketing surface
      D.featured().forEach(({ item, group }) =>
        el.appendChild(dishCard(item, group, { orderable: false })));
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

  /* ---------------- Order & info cards (shared frame) ----------------
     One renderer, two mounts: the app's Order view and the landing page's
     bottom section. Sourced from D.order() — contact facts edited in the
     data layer repaint both surfaces on the next refresh. */
  F.define("order", {
    topics: ["refresh"],
    render(el, D) {
      el.innerHTML = "";
      D.order().forEach(card => {
        const node = document.createElement("article");
        node.className = "order-card";
        node.innerHTML = `
          <div class="oc-kicker">${card.kicker}</div>
          <h3>${card.title}</h3>
          <p>${card.text}</p>
          ${(card.links || []).map(l =>
            `<a class="btn ${l.accent ? "accent" : "ghost"}" href="${l.url}" data-external>${l.label}</a>`
          ).join("\n          ")}
          ${card.socials ? `<div class="oc-socials">${card.socials.map(([label, url]) =>
            `<a href="${url}" data-external>${label}</a>`).join("")}</div>` : ""}`;
        el.appendChild(node);
      });
    }
  });

  /* ---------------- Landing full menu (display only) ----------------
     The landing page surfaces the app's menu data without ordering —
     the "stripped down" view: category headers + name/sub/price lines.
     Live frame: menu edits in data.js repaint it on the next refresh. */
  F.define("full-menu", {
    topics: ["refresh"],
    render(el, D) {
      el.innerHTML = "";
      D.MENU.forEach(group => {
        const sec = document.createElement("section");
        sec.className = "lmenu-group";
        sec.innerHTML = `
          <div class="sec-head sec-head--sub">
            <h3>${group.name}</h3>
            <span class="jp">${group.jp}</span>
            <span class="rule"></span>
            <span class="n-items">${group.items.length} items</span>
          </div>
          <p class="group-desc">${group.desc}</p>`;
        const list = document.createElement("ul");
        list.className = "lmenu-list";
        group.items.forEach(it => {
          const li = document.createElement("li");
          li.innerHTML = `
            <span class="lm-name">${it.name}<em>${it.sub || ""}</em></span>
            <span class="lm-price">${fmtBaht(it.price)}</span>`;
          list.appendChild(li);
        });
        sec.appendChild(list);
        el.appendChild(sec);
      });
      // the rest of the daily line-up (NAEKI.ALSO) — names only
      const also = document.createElement("section");
      also.className = "lmenu-group";
      also.innerHTML = `
        <div class="sec-head sec-head--sub">
          <h3>Also rotating daily</h3>
          <span class="jp">日替わり</span>
          <span class="rule"></span>
          <span class="n-items">${D.ALSO.length} more</span>
        </div>
        <p class="group-desc">The rest of the daily line-up — ask at the counter.</p>`;
      const strip = document.createElement("p");
      strip.className = "lmenu-also";
      strip.innerHTML = D.ALSO.map(n => `<span>${n}</span>`).join("");
      also.appendChild(strip);
      el.appendChild(also);
    }
  });
  F.mount();

  $("#home-browse-menu").addEventListener("click", () => goToView("lmenu"));
  $("#home-full-menu").addEventListener("click", () => goToView("lmenu"));
  // "All branches in the app →" — gates into the app (wired to openSignin via
  // the CTA list above); its data-goto hands sign-in off to the branches view

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

  function dishCard(item, group, { orderable = true } = {}) {
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
        ${orderable ? `
        <div class="dish-foot">
          <span class="dish-price">${fmtBaht(item.price)}</span>
          <div class="dish-order" data-name="${item.name}">
            <button class="d-step d-minus" aria-label="Remove one ${item.name}">−</button>
            <span class="d-qty" aria-live="polite">0</span>
            <button class="d-step d-plus" aria-label="Add one ${item.name}">+</button>
          </div>
        </div>` : `<div class="dish-foot"><span class="dish-price">${fmtBaht(item.price)}</span></div>`}
      </div>`;
    // ordering: stepper writes to the store, badge + steppers sync.
    // Non-orderable cards (landing display-only) skip the wiring entirely.
    const name = item.name;
    const qtyEl = card.querySelector(".d-qty");
    const sync = orderable ? () => {
      const line = S.cart().find(l => l.name === name);
      const q = line ? line.qty : 0;
      qtyEl.textContent = q;
      card.querySelector(".dish-order").classList.toggle("has-qty", q > 0);
    } : null;
    if (orderable) {
      card.querySelector(".d-plus").addEventListener("click", e => {
        e.stopPropagation();                       // don't open the modal
        S.addToCart(name, item.price);
        syncCartUI();
        sync();
      });
      card.querySelector(".d-minus").addEventListener("click", e => {
        e.stopPropagation();
        const line = S.cart().find(l => l.name === name);
        if (line) { S.setCartQty(name, line.qty - 1); syncCartUI(); sync(); }
      });
      orderables.set(name, sync);                   // global resync point
      sync();
    }
    const open = () => openModal(item, group);
    card.addEventListener("click", e => {
      if (e.target.closest(".dish-order")) return; // stepper owns clicks
      open();
    });
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        if (e.target.closest(".dish-order")) return;
        e.preventDefault(); open();
      }
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
        <div class="sec-head sec-head--sub">
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

  /* ---------------- Order cart (app shell) ----------------
     Steppers on dish cards write to NaekiStore; the badge, the cart view,
     and every mounted stepper stay in sync through syncCartUI(). */
  const cartBadge = $("#cart-badge");
  const cartRoot = $("#cart-root");

  function cartTotals() {
    const lines = S.cart();
    const count = lines.reduce((n, l) => n + l.qty, 0);
    const total = lines.reduce((t, l) => t + l.price * l.qty, 0);
    return { count, total };
  }

  function syncCartUI() {
    const { count, total } = cartTotals();
    cartBadge.textContent = count;
    cartBadge.hidden = count === 0;
    renderCart();
    orderables.forEach(sync => sync());
    // dish modal shows the add-to-cart affordance too
    const modalAdd = $("#modal-add");
    if (modalAdd && !$("#modal").hidden) syncModalAdd();
  }

  function renderCart() {
    const lines = S.cart();
    if (!cartRoot) return;
    cartRoot.innerHTML = "";
    if (!lines.length) {
      const empty = document.createElement("div");
      empty.className = "cart-empty";
      empty.innerHTML = `
        <p>Nothing in the cart yet.</p>
        <p class="cart-empty-sub">Add dishes from the menu — your lines wait here.</p>
        <button class="btn accent" id="cart-browse">Browse the menu</button>`;
      cartRoot.appendChild(empty);
      $("#cart-browse").addEventListener("click", () => goToView("menu"));
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "cart-wrap";
    const list = document.createElement("ul");
    list.className = "cart-list";
    lines.forEach(l => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="c-name">${l.name}</span>
        <span class="c-stepper" data-name="${l.name}">
          <button class="d-step c-minus" aria-label="Remove one ${l.name}">−</button>
          <span class="c-qty">${l.qty}</span>
          <button class="d-step c-plus" aria-label="Add one ${l.name}">+</button>
        </span>
        <span class="c-line">${fmtBaht(l.price * l.qty)}</span>`;
      li.querySelector(".c-plus").addEventListener("click", () => {
        S.setCartQty(l.name, l.qty + 1); syncCartUI();
      });
      li.querySelector(".c-minus").addEventListener("click", () => {
        S.setCartQty(l.name, l.qty - 1); syncCartUI();
      });
      list.appendChild(li);
    });
    wrap.appendChild(list);

    const { count, total } = cartTotals();
    const foot = document.createElement("div");
    foot.className = "cart-foot";
    foot.innerHTML = `
      <div class="cart-total"><span>${count} item${count === 1 ? "" : "s"}</span><strong>${fmtBaht(total)}</strong></div>
      <p class="cart-note">Indicative prices — demo checkout, nothing is sent anywhere.</p>
      <div class="cart-actions">
        <button class="btn accent" id="cart-checkout">Checkout</button>
        <button class="btn ghost" id="cart-clear">Clear cart</button>
      </div>`;
    wrap.appendChild(foot);
    cartRoot.appendChild(wrap);

    $("#cart-checkout").addEventListener("click", () => {
      // dominant category of this cart → powers "because you order it" offers
      const catTally = {};
      S.cart().forEach(l => {
        const group = D.MENU.find(g => g.items.some(it => it.name === l.name));
        if (group) catTally[group.id] = (catTally[group.id] || 0) + l.qty;
      });
      const category = Object.entries(catTally).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      const receipt = S.checkoutCart(category);
      if (receipt) {
        syncCartUI();          // badge + steppers to empty state first…
        renderReceipt(receipt); // …then paint the receipt (renderCart would wipe it)
      }
    });
    $("#cart-clear").addEventListener("click", () => {
      S.clearCart();
      syncCartUI();
    });
  }

  function renderReceipt(receipt) {
    cartRoot.innerHTML = "";
    const card = document.createElement("div");
    card.className = "cart-receipt";
    const when = new Date(receipt.ts).toLocaleString(undefined, {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });
    // loyalty line — points earned this order (checkout writes it)
    const earned = receipt.pointsEarned || 0;
    const walletLine = receipt.paidByWallet
      ? `Paid ${fmtBaht(receipt.walletSpent)} from wallet balance.` : "";
    card.innerHTML = `
      <div class="oc-kicker">Demo order placed</div>
      <h3>${receipt.id}</h3>
      <p class="receipt-when">${when} · ${receipt.count} items · ${fmtBaht(receipt.total)}</p>
      <ul class="receipt-lines">
        ${receipt.lines.map(l => `<li><span>${l.qty}×</span> ${l.name}</li>`).join("")}
      </ul>
      ${earned ? `<div class="receipt-points">
        <span class="rp-num">+${earned}</span> points earned · ${receipt.tier} tier
      </div>` : ""}
      ${walletLine ? `<p class="cart-note">${walletLine}</p>` : ""}
      <p class="cart-note">
        Nothing was sent anywhere — this is a local demo reference. Take the id
        to the counter or order for real via
        <a href="https://lin.ee/DqJnedo" data-external>LINE OA (@naekisushi)</a>.
      </p>
      <div class="cart-actions">
        <button class="btn accent" id="receipt-done">Back to the menu</button>
        ${earned ? `<button class="btn ghost" id="receipt-rewards">See rewards</button>` : ""}
      </div>`;
    cartRoot.appendChild(card);
    $("#receipt-done").addEventListener("click", () => {
      renderCart();
      goToView("menu");
    });
    const rw = $("#receipt-rewards");
    if (rw) rw.addEventListener("click", () => {
      renderCart();
      goToView("rewards");
    });
  }

  // landing full-menu CTAs
  $("#lmenu-open-app").addEventListener("click", e => openSignin(e));
  $("#lmenu-back").addEventListener("click", () => goToView("home"));

  /* ---------------- Rewards (points + tiers + offers inbox) ----------------
     Renders from the data-layer rules (TIERS, offers()) + store balances;
     re-renders on every loyalty change (checkout, redeem) and on data
     refresh so weekday deals flip live. */
  const rwHero = $("#rw-hero");
  const rwTiers = $("#rw-tiers");
  const rwOffers = $("#rw-offers");
  const rwNote = $("#rw-offers-note");

  function renderRewards() {
    const lo = S.loyalty();
    const tier = D.tierFor(lo.lifetime);
    const next = D.nextTier(lo.lifetime);
    const pct = next
      ? Math.min(100, Math.round((lo.lifetime - tier.threshold) / (next.threshold - tier.threshold) * 100))
      : 100;

    rwHero.innerHTML = `
      <div class="rw-hero-tier ${tier.id}">
        <div class="rw-tier-name">${tier.name} <span lang="ja">${tier.jp}</span></div>
        <div class="rw-tier-blurb">${tier.blurb}</div>
      </div>
      <div class="rw-hero-points">
        <div class="rw-pts"><strong>${lo.points}</strong><span>points to spend</span></div>
        <div class="rw-pts"><strong>${lo.lifetime}</strong><span>lifetime points</span></div>
        <div class="rw-tier-progress">
          ${next
            ? `<span class="rw-progress-label">${next.threshold - lo.lifetime} pts to ${next.name}</span>
               <div class="rw-progress-track"><div class="rw-progress-fill" ></div></div>`
            : `<span class="rw-progress-label">Top tier — enjoy the perks</span>`}
        </div>
        <div class="rw-perk">${tier.perk}</div>
        ${lo.points >= 10 ? `
          <div class="rw-redeem-row">
            <button class="btn accent" id="rw-redeem-50">Redeem 50 pts → ฿50 balance</button>
          </div>` : `<p class="rw-redeem-hint">Redeem from 50 points (1 pt = ฿1).</p>`}
      </div>`;

    // tier ladder
    rwTiers.innerHTML = D.TIERS.map(t => {
      const state = lo.lifetime >= t.threshold ? "done" : (t === next ? "next" : "todo");
      return `<div class="rw-tier ${state} ${t.id}">
        <span class="rw-tier-jp" lang="ja">${t.jp}</span>
        <strong>${t.name}</strong>
        <span class="rw-tier-th">${t.threshold} pts</span>
        <span class="rw-tier-perk">${t.perk}</span>
      </div>`;
    }).join("");

    // offers inbox: weekly brand deals + local affinity matches
    const list = D.offers({ history: lo.history, points: lo.points });
    const live = list.filter(o => o.live);
    rwNote.textContent = `${live.length} live now · this week`;
    rwOffers.innerHTML = list.map(o => `
      <div class="rw-offer ${o.live ? "live" : ""} ${o.personal ? "personal" : ""}">
        <div class="rw-offer-kicker">${o.kicker}${o.personal ? " · just for you" : ""}</div>
        <div class="rw-offer-title">${o.title}</div>
        <p>${o.text}</p>
        ${o.live ? `<span class="rw-live-dot"></span>` : ""}
      </div>`).join("");

    // progress width via CSSOM (CSP blocks inline style attributes)
    const fill = rwHero.querySelector(".rw-progress-fill");
    if (fill) fill.style.setProperty("--rw-pct", pct + "%");

    const redeemBtn = $("#rw-redeem-50");
    if (redeemBtn) redeemBtn.addEventListener("click", () => {
      if (S.redeemPoints(50, "Rewards → wallet")) flash("50 points → ฿50 added to your wallet");
    });
  }

  /* ---------------- Wallet (stored value) ---------------- */
  const wlAmount = $("#wl-amount");
  const wlSub = $("#wl-sub");
  const wlGifts = $("#wl-gifts");
  const wlPayNote = $("#wl-pay-note");
  const wlRedeemNote = $("#wl-redeem-note");
  const wlLedger = $("#wl-ledger");

  function renderWallet() {
    const w = S.walletState();
    wlAmount.textContent = fmtBaht(w.balance);
    wlSub.textContent = w.balance > 0
      ? `Pays at checkout before cash · ${S.giftsState().filter(g => !g.spent).length} gift code(s) unredeemed`
      : "Load to pay with one tap at checkout";

    // top-up ledger — newest first, ts · amount · method · ref
    const topups = w.topups;
    wlLedger.innerHTML = topups.length
      ? topups.map(t => `
          <div class="wl-ledger-row">
            <span class="wl-lt">${fmtWhen(t.ts)}</span>
            <span class="wl-la">+${fmtBaht(t.amount)}</span>
            <span class="wl-lm">${t.method}</span>
            <code>${t.ref}</code>
          </div>`).join("")
      : `<p class="wl-note">No top-ups yet — load TrueMoney above to see it here.</p>`;

    const gifts = S.giftsState();
    wlGifts.innerHTML = gifts.length
      ? gifts.map(g => `
          <div class="wl-gift-row ${g.spent ? "spent" : ""}">
            <code>${g.code}</code>
            <span>${fmtBaht(g.amount)}</span>
            <span class="wl-gift-state">${g.spent ? "redeemed" : "ready to send"}</span>
          </div>`).join("")
      : `<p class="wl-note">No gift cards yet — buy one above.</p>`;
  }

  // top-up chips + TrueMoney CTA
  $$("[data-topup]").forEach(btn => btn.addEventListener("click", () => {
    const rec = S.topUp(Number(btn.dataset.topup), "TrueMoney");
    if (rec) flash(`TrueMoney top-up ${fmtBaht(rec.amount)} · ref ${rec.ref}`);
  }));
  $("#wl-topup-cta").addEventListener("click", () => {
    const rec = S.topUp(300, "TrueMoney");
    if (rec) flash(`TrueMoney top-up ${fmtBaht(rec.amount)} · ref ${rec.ref}`);
  });

  // gift purchase chips
  $$("[data-gift]").forEach(btn => btn.addEventListener("click", () => {
    const amount = Number(btn.dataset.gift);
    if (S.walletState().balance < amount) {
      wlGifts.innerHTML = `<p class="wl-note wl-warn">Need ${fmtBaht(amount)} balance first — top up, then gift.</p>`;
      return;
    }
    const gift = S.buyGift(amount);
    if (gift) flash(`Gift card ${gift.code} ready to send`);
  }));

  // redeem code form
  $("#wl-redeem-form").addEventListener("submit", e => {
    e.preventDefault();
    const code = $("#wl-redeem-code").value;
    const gift = S.redeemGift(code);
    wlRedeemNote.textContent = gift
      ? `Added ${fmtBaht(gift.amount)} from ${gift.code}.`
      : "Code not found or already redeemed.";
    if (gift) $("#wl-redeem-code").value = "";
  });

  // express pay surfaces — honest demo: they mark intent locally
  $("#wl-applepay").addEventListener("click", () => {
    const w = S.walletState();
    wlPayNote.textContent = w.balance > 0
      ? "Demo: in the real app this opens Apple's Add Card sheet for your Naeki balance."
      : "Load a balance first — then this would provision an Apple Pay card.";
  });
  $("#wl-gpay").addEventListener("click", () => {
    wlPayNote.textContent = "Demo: the real app would launch Google Wallet's Add to Wallet flow.";
  });

  // loyalty changes repaint both views + every dish stepper; the offers
  // inbox also flips when the data layer refreshes (weekday deals)
  S.onLoyalty(() => { renderRewards(); renderWallet(); syncSessionLoyalty(); });
  D.subscribe("refresh", renderRewards);
  renderRewards();
  renderWallet();
  syncSessionLoyalty();

  /* sidebar glance: points + wallet balance chips */
  function syncSessionLoyalty() {
    const box = $("#session-loyalty");
    if (!box) return;
    const lo = S.loyalty();
    const w = S.walletState();
    box.hidden = false;
    $("#sl-points").textContent = lo.points + " pts";
    $("#sl-balance").textContent = fmtBaht(w.balance);
  }

  /* small toast — used for top-ups, gifts, redemptions */
  function flash(msg) {
    let t = $("#flash");
    if (!t) {
      t = document.createElement("div");
      t.id = "flash";
      t.className = "flash";
      t.setAttribute("role", "status");
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove("on"), 2600);
  }

  syncCartUI();

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
    S.resetCard(); // card only — keeps the signed-in profile (and app mode)
    renderStamps();
  });

  renderStamps();

  /* ---------------- Modal ---------------- */
  const modal = $("#modal");
  let modalItem = null, modalGroup = null;
  function openModal(item, group) {
    modalItem = item; modalGroup = group;
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
    // order affordance: app shell only. The landing's display-only cards
    // open this modal too, but ordering lives behind sign-in — hide it there.
    const priceEl = $("#modal-price");
    const addEl = $("#modal-add");
    const inApp = document.body.dataset.mode === "app";
    if (priceEl) priceEl.textContent = fmtBaht(item.price);
    if (addEl) { addEl.hidden = !inApp; if (inApp) syncModalAdd(); }
    $("#modal-find").href =
      "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("Naeki Sushi BTS Siam Bangkok");
    modal.hidden = false;
    $(".modal-x").focus();
  }
  function syncModalAdd() {
    const addEl = $("#modal-add");
    if (!addEl || !modalItem) return;
    const line = S.cart().find(l => l.name === modalItem.name);
    addEl.textContent = line ? `In cart · ${line.qty} — add one` : `Add to cart · ${fmtBaht(modalItem.price)}`;
  }
  const modalAddBtn = $("#modal-add");
  if (modalAddBtn) modalAddBtn.addEventListener("click", () => {
    if (!modalItem) return;
    S.addToCart(modalItem.name, modalItem.price);
    syncCartUI();          // also re-syncs the modal label
  });
  function closeModal() { modal.hidden = true; modalItem = null; }
  $$("[data-close]", modal).forEach(el => el.addEventListener("click", closeModal));
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if (!modal.hidden) closeModal();
      if (!signin.hidden) closeSignin();
    }
  });

  /* ---------------- External links → system browser ----------------
     Delegated at document level: live frames (order cards, hours, menu)
     re-render on every refresh and would shed per-anchor listeners. */
  document.addEventListener("click", e => {
    const a = e.target.closest("a[data-external]");
    if (!a) return;
    e.preventDefault();
    window.open(a.href, "_blank");
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

      // the active shell starts hidden behind the splash, fades in after —
      // landing page when signed out, app shell when signed in
      const shell = document.body.dataset.mode === "app" ? $("#app") : $("#landing");
      shell.style.opacity = "0";
      shell.style.transition = "opacity 0.3s ease";

      // per-stroke draw delays via CSSOM (CSP blocks inline style attributes)
      $$("#art-scene .draw").forEach(p => {
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
          fillSweep(T.fill);
        }, T.draw - 120);
        setTimeout(() => splash.classList.add("phase-roll"), T.draw + T.fill + 40);
        const popDone = T.draw + T.fill + popInDelay + T.popIn + T.hold;
        setTimeout(() => {                              // fade splash out
          splash.classList.add("phase-out");
          shell.style.opacity = "1";
        }, popDone);
        setTimeout(() => {
          splash.classList.add("done");
          splash.remove();
        }, popDone + T.fade + 120);
      });
    }
  }
})();