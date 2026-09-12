/* NAEKI SHOWCASE — app logic: tabs, live search, open/closed clock, modal */
(() => {
  "use strict";

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  /* indicative-price formatter (see data.js: prices are demo THB) */
  const fmtBaht = (n) => "฿" + Math.round(Number(n) || 0);

  /* shared timestamp formatter (ledger rows, receipt, stamp + chat history) */
  function fmtWhen(ts) {
    return new Date(ts).toLocaleString(undefined, {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
    });
  }

  /* compact relative time: "now", "12m", "3h", "2d" — for the offers feed's
     recency line. Old/unknown falls back to an absolute stamp. */
  function fmtAgo(ts) {
    if (!ts) return "";
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return "now";
    const m = Math.floor(s / 60);
    if (m < 60) return m + "m";
    const h = Math.floor(m / 60);
    if (h < 24) return h + "h";
    const d = Math.floor(h / 24);
    return d < 14 ? d + "d" : fmtWhen(ts);
  }

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
  function isStaff() { return S.isStaff(); }

  /* signed-in routing: staff logins (admin/franchisee/marketing) land on the
     partner portal; everyone else lands on the customer menu. */
  function defaultView() {
    return isStaff() ? "partners" : "menu";
  }
  function goToView(name) {
    // "rewards/wallet" form deep-links a rewards sub-tab from anywhere;
    // "menu/cart" does the same for the Order tab's segments
    let sub = null;
    if (name.includes("/")) [name, sub] = name.split("/");
    // cart + branches are segments of the Order tab now
    const parent = SEGMENT_PARENT[name];
    if (parent) { showOdTab(name); name = parent; }
    const view = $("#view-" + name);
    if (!view) return;
    const shell = view.closest("#landing") ? $("#landing") : $("#app");
    // one active view per shell; light up that shell's nav links to match
    $$(".view", shell).forEach(v => v.classList.toggle("active", v === view));
    $$(".lp-link, .side-link, .tab-btn", shell).forEach(b =>
      b.classList.toggle("active", b.dataset.view === name));
    // each shell has its own scroller: the page (landing) or #main (app)
    if (shell.id === "landing") window.scrollTo({ top: 0, behavior: "smooth" });
    else $("#main").scrollTo({ top: 0, behavior: "smooth" });
    // merged Rewards section: land on the requested tab (or keep the current one);
    // Order segments deep-link the same way ("menu/cart", "menu/branches")
    if (sub) {
      if (RW_TABS.includes(sub)) showRwTab(sub);
      if (OD_TABS.includes(sub)) showOdTab(sub);
    }
    else if (name === "rewards") showRwTab(activeRwTab);
    // Order tab: land on the requested segment (or keep the current one)
    if (name === "menu" && !parent && !sub) showOdTab(activeOdTab);
  }

  function applyMode(activateDefault = true) {
    mode = S.get().profile ? "app" : "landing";
    // CSS owns shell visibility from here (body[data-mode])
    document.body.dataset.mode = mode;

    const profile = S.get().profile;
    if (profile) $("#session-greeting").textContent = "Hi, " + profile.name;
    // staff logins keep the portal reachable via a "Portal" nav link (CSS shows
    // it only for body[data-staff] and hides the consumer tabs/links)
    document.body.dataset.staff = profile ? (isStaff() ? "true" : "false") : "";

    if (activateDefault) goToView(profile ? defaultView() : "home");
  }

  /* ---------------- Rewards tabs (Points · Wallet · Milestones) ----------------
     One section, three panes. State lives here so goToView can deep-link
     ("rewards/wallet") and the pane keeps its tab across revisits. Panes
     are plain class swaps — no re-render needed; every renderer paints its
     mounts regardless of which pane is visible. */
  const RW_TABS = ["points", "stamps", "wallet", "milestones", "offers"];
  let activeRwTab = "points";

  function showRwTab(tab) {
    if (!RW_TABS.includes(tab)) return;
    activeRwTab = tab;
    $$(".rw-tab").forEach(b => {
      const on = b.dataset.rwtab === tab;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    $$(".rw-pane").forEach(p =>
      p.classList.toggle("active", p.dataset.rwpane === tab));
    // the offers pane is a live feed (bell acks, branch subs, published offers
    // all mutate its contents) — repaint it whenever it's selected so it
    // reflects the current device state, not the last global re-render
    if (tab === "offers") renderOffersInbox();
  }

  $$(".rw-tab").forEach(btn =>
    btn.addEventListener("click", () => showRwTab(btn.dataset.rwtab)));

  /* ---------------- Order segments (Menu · Cart · Branches) ----------------
     The Order tab's inner nav — same chip/pane mechanic as the rewards
     tabs. State lives here so goToView can deep-link ("menu/cart") and
     the segment survives revisits. */
  const OD_TABS = ["menu", "cart", "branches"];
  let activeOdTab = "menu";

  function showOdTab(tab) {
    if (!OD_TABS.includes(tab)) return;
    activeOdTab = tab;
    $$(".od-tab").forEach(b => {
      const on = b.dataset.odtab === tab;
      b.classList.toggle("active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    $$(".od-pane").forEach(p =>
      p.classList.toggle("active", p.dataset.odpane === tab));
    // the branches pane carries persisted state (your-branch subscriptions),
    // so re-render it whenever it is re-selected — not just on search/tick
    if (tab === "branches") renderBranches();
  }

  $$(".od-tab").forEach(btn =>
    btn.addEventListener("click", () => showOdTab(btn.dataset.odtab)));

  // segment shortcuts: goToView("menu/cart") shows the Order tab on Cart,
  // goToView("branches") lands on its segment — the phone's IA without
  // extra top-level destinations
  const SEGMENT_PARENT = { menu: null, cart: "menu", branches: "menu" };

  /* sign-in handoff: flip to app mode, then land on the CTA's target (if any)
     instead of the default view — "All branches in the app →" reaches branches */
  function enterApp(view) {
    applyMode(false);                     // don't bounce through the default
    // staff logins always route to the portal; consumer names honor the CTA
    goToView(isStaff() ? "partners" : (view || "menu"));
  }

  $$(".side-link").forEach(btn => {
    btn.addEventListener("click", () => goToView(btn.dataset.view));
  });
  $("#brand-home").addEventListener("click", () => goToView(isStaff() ? "partners" : "menu"));

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
  ["#lp-signin", "#home-open-app", "#cta-open-app", "#hours-open-app", "#lmenu-order-now", "#lp-portal-signin"].forEach(sel => {
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

  /* ---------------- Partner portal (landing) — the send-flow demo ----------------
     Two local personas, one store. Franchisee drafts for their branch, submits;
     marketing admin approves → published (to a seeded subscriber count) and merged
     into the offers feed. Everything stays on-device — see the portal disclaimer. */
  const $id = (x) => document.getElementById(x);
  const personaBox = $id("pt-persona");
  const frPane = $id("pt-franchisee");
  const adPane = $id("pt-admin");
  const branchSel = $id("pt-branch");
  const myDraftsEl = $id("pt-my-drafts");
  const reviewEl = $id("pt-review-list");
  const sentEl = $id("pt-sent");

  function fillBranchSel() {
    if (!branchSel) return;
    branchSel.innerHTML = D.BRANCHES.map(b =>
      `<option value="${b.name}">${b.name}</option>`).join("");
  }
  fillBranchSel();

  const PT_STATUS = { draft: "Draft", pending: "Awaiting approval", approved: "Approved" };

  function ptPublishedCard(po) {
    return `\
      <div class="pt-item pt-sent">
        <div class="pt-item-top">
          <span class="pt-tag">${po.kicker || "From your branch"}</span>
          <span class="pt-when">${fmtWhen(po.sentAt)}</span>
        </div>
        <div class="pt-item-title">${po.title}</div>
        <p>${po.text}</p>
        <span class="pt-sub">Sent to ${po.sendCount} subscriber${po.sendCount === 1 ? "" : "s"}</span>
      </div>`;
  }

  function renderPt() {
    if (!myDraftsEl) return;
    const drafts = S.franchiseDraftsState();

    const mine = drafts.filter(d => d.status !== "approved");
    myDraftsEl.innerHTML = mine.length
      ? mine.map(d => {
          const canSubmit = d.status === "draft";
          const canDel = d.status === "draft";
          return `\
            <div class="pt-item">
              <div class="pt-item-top">
                <span class="pt-tag">${PT_STATUS[d.status]}</span>
                <span class="pt-branch">${D.shortName({ name: d.branchId })}</span>
              </div>
              <div class="pt-item-title">${d.title}</div>
              <p>${d.text}</p>
              <div class="pt-item-actions">
                ${canSubmit ? `<button class="btn ghost sm" data-ptsubmit="${d.id}">Submit for approval</button>` : ""}
                ${canDel ? `<button class="btn ghost sm" data-ptdel="${d.id}">Discard</button>` : ""}
              </div>
            </div>`;
        }).join("")
      : `<div class="pt-empty">No drafts yet — draft an offer above.</div>`;

    const pending = drafts.filter(d => d.status === "pending");
    reviewEl.innerHTML = pending.length
      ? pending.map(d => `\
          <div class="pt-item">
            <div class="pt-item-top">
              <span class="pt-tag">${d.title}</span>
              <span class="pt-branch">${D.shortName({ name: d.branchId })}</span>
            </div>
            <p>${d.text}</p>
            <div class="pt-item-actions">
              <button class="btn accent sm" data-ptapprove="${d.id}">Approve & send</button>
              <button class="btn ghost sm" data-ptreturn="${d.id}">Return for edits</button>
            </div>
          </div>`).join("")
      : `<div class="pt-empty">Nothing awaiting approval right now.</div>`;

    const sent = S.publishedOffersState();
    sentEl.innerHTML = sent.length
      ? sent.map(ptPublishedCard).join("")
      : `<div class="pt-empty">Nothing sent yet — published offers land here.</div>`;
  }

  if (personaBox) {
    $$("[data-ptrole]", personaBox).forEach(btn => {
      btn.addEventListener("click", () => {
        const role = btn.dataset.ptrole;
        frPane.hidden = role !== "franchisee";
        adPane.hidden = role !== "admin";
        renderPt();
      });
    });
  }

  const draftForm = $id("pt-draft-form");
  draftForm && draftForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const made = S.createDraft({
      branchId: branchSel.value,
      title: $id("pt-title").value,
      text: $id("pt-text").value
    });
    if (made) { $id("pt-title").value = ""; $id("pt-text").value = ""; renderPt(); }
  });

  [myDraftsEl, reviewEl].forEach(root => root && root.addEventListener("click",
    (e) => {
      const t = e.target;
      if (t.matches("[data-ptsubmit]")) { S.submitDraft(t.dataset.ptsubmit); renderPt(); }
      else if (t.matches("[data-ptdel]")) { S.deleteDraft(t.dataset.ptdel); renderPt(); }
      else if (t.matches("[data-ptapprove]")) { S.reviewDraft(t.dataset.ptapprove, "approve"); renderPt(); syncBellAndPop(); }
      else if (t.matches("[data-ptreturn]")) { S.reviewDraft(t.dataset.ptreturn, "return"); renderPt(); }
    }));

  D.subscribe("refresh", () => renderPt());
  const partnersView = $id("view-partners");
  if (partnersView) {
    new MutationObserver(() => {
      if (partnersView.classList.contains("active")) renderPt();
    }).observe(partnersView, { attributes: true, attributeFilter: ["class"] });
  }
  renderPt();

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

  /* ---------------- Customer Service Desk (landing shared frame) ----------------
     Surfaces the same routed-intent topics as the app's Chat view, but as a
     standalone landing section — no sign-in needed. Topic edits in data.js
     repaint this frame and the app Chat view on the next refresh. */
  F.define("servicedesk", {
    topics: ["refresh"],
    render(el, D) {
      el.innerHTML = D.chatTopics().map(r => `
        <button type="button" class="ch-topic" data-topic="${r.topic}" role="button">
          <span class="ch-topic-icon" aria-hidden="true">
            ${r.icon === "sushi" ? "🍣" : r.icon === "briefcase" ? "💼"
             : r.icon === "bag" ? "🛍️" : r.icon === "delivery" ? "🛵"
             : r.icon === "menu" ? "📋" : "💬"}
          </span>
          <h4>${r.topic}</h4>
          <p>${r.prompt}</p>
          <span class="btn accent">Chat in LINE</span>
        </button>`).join("");
      el.querySelectorAll(".ch-topic").forEach(btn => {
        btn.addEventListener("click", () => {
          const route = D.CHAT_ROUTES.find(x => x.topic === btn.dataset.topic) || {};
          const prompt = route.prompt || "I have a question for the Naeki team.";
          window.open(D.INFO.lineUrl, "_blank");
        });
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
  const branchYour = $("#branch-your");   // "your branches" summary banner

  function renderBranches() {
    const q = branchSearch.value.trim().toLowerCase();
    const now = D.bangkokParts();
    branchList.innerHTML = "";
    let shown = 0;

    // summary banner: how many of these branches the user wants to hear from
    const subs = S.subscribedBranchesState();
    if (branchYour) {
      branchYour.hidden = !S.get().profile;   // sign-in-gated like the rest of app
      if (!branchYour.hidden) {
        const names = subs
          .map(n => D.BRANCHES.find(b => b.name === n))
          .filter(Boolean)
          .slice(0, 3)
          .map(b => D.shortName(b));
        branchYour.innerHTML = subs.length
          ? `Your branches — <strong>${subs.length}</strong> picked&nbsp;(${names.join(", ")}${subs.length > 3 ? "…" : ""}). Offers &amp; notifications from these arrive in the <strong>Rewards bell</strong>.`
          : `Choose the branches you visit — tap the <strong>notify</strong> toggle on a card and offers from them arrive in the <strong>Rewards bell</strong>. Nothing leaves this device.`;
      }
    }

    D.BRANCHES
      .filter(b => !q ||
        b.name.toLowerCase().includes(q) ||
        b.area.toLowerCase().includes(q) ||
        (b.where || "").toLowerCase().includes(q))
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "flagship" ? -1 : 1))
      .forEach(b => {
        const open = D.isOpenNow(b, now);
        const on = subs.includes(b.name);
        const el = document.createElement("article");
        el.className = "branch" + (on ? " subscribed" : "");
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
          ${b.note ? `<div class="b-where b-note">${b.note}</div>` : ""}
          <div class="b-sub">
            <button class="b-sub-toggle ${on ? "on" : ""}" data-sub="${b.name}" aria-pressed="${on}">
              <span class="b-sub-bell" aria-hidden="true">${on ? "🔔" : "🔕"}</span>
              <span class="b-sub-label">${on ? "Notifying me" : "Notify me"}</span>
            </button>
            <span class="b-sub-hint">${on ? "Receives offers & notifications here" : "Tap to get offers & notifications from this branch"}</span>
          </div>`;
        // the toggle stops propagation so tapping it doesn't open Maps
        const toggle = el.querySelector(".b-sub-toggle");
        toggle.addEventListener("click", e => {
          e.stopPropagation();
          S.toggleBranchSubscription(b.name);
          renderBranches();
          syncBellAndPop();
        });
        const go = () =>
          window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.name + " Bangkok")}`, "_blank");
        el.addEventListener("click", e => {
          if (e.target.closest(".b-sub-toggle")) return;
          go();
        });
        el.addEventListener("keydown", e => {
          if (e.key === "Enter") {
            if (e.target.closest(".b-sub-toggle")) return;
            go();
          }
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
    const { count } = cartTotals();
    // both cart badges: the sidebar Cart row (desktop) + the Order tab chip (phone)
    cartBadge.textContent = count;
    cartBadge.hidden = count === 0;
    const odBadge = $("#od-cart-badge");
    if (odBadge) { odBadge.textContent = count; odBadge.hidden = count === 0; }
    const tabBadge = $("#tab-cart-badge");
    if (tabBadge) { tabBadge.textContent = count; tabBadge.hidden = count === 0; }
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
      $("#cart-browse").addEventListener("click", () => goToView("menu/menu"));
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
      goToView("menu/menu");
    });
    const rw = $("#receipt-rewards");
    if (rw) rw.addEventListener("click", () => {
      renderCart();
      goToView("rewards/wallet");
    });
  }

  // landing full-menu CTAs
  $("#lmenu-open-app").addEventListener("click", e => openSignin(e));
  $("#lmenu-back").addEventListener("click", () => goToView("home"));

  /* ---------------- Offers bell + popup (ack-once, then it's gone) ----------------
     Every live offer the data layer composes "arrives" until the user
     acknowledges it: the bell dot lights and the newest unacknowledged offer
     pops in bottom-right, Marc-Lou style. Acknowledging — ✕ on the popup,
     "Got it", or engaging via "See rewards" — records the ack in the store
     and the offer never pops again (its inbox card flips to a quiet "Seen").
     The ack key pins the offer's composition (weekday|kicker|title), so the
     Monday set returns fresh next Monday and a "welcome back" nudge can
     re-fire the next time it earns itself. Nothing is synced; the ledger is
     this device's. CSP-note: arrival animation is a class swap, not inline
     styles. Declared ABOVE the Rewards section: renderRewards() paints the
     offer ledger, so the consts here must exist before its first call. */
  const offerPop = $("#offer-pop");
  // two bell mounts: the sidebar Rewards row (desktop) + the Rewards tab
  // button (phone thumb-zone). One queue, every mount shows the same state.
  const offerBells = [
    { root: $("#offer-bell"), dot: $("#offer-bell-dot") },
    { root: $("#tab-offer-bell"), dot: $("#tab-offer-bell-dot") }
  ];
  let shownOfferKey = null;              // key currently in the popup, or null

  // the composition key: weekday for weekly deals, "any" for personal matches,
  // and the published offer's uid for branch-sent offers (they fire once with
  // a fixed identity, so acking stays stable across days — unlike the weekly
  // set which returns fresh each matching weekday)
  function offerKey(o, weekday) {
    if (o.branchOffer && o.uid) return `pub|${o.uid}`;
    return `${o.personal ? "any" : weekday}|${o.kicker}|${o.title}`;
  }

  // live offers the user hasn't acknowledged yet — the bell's queue
  function pendingOffers() {
    const lo = S.loyalty();
    const weekday = D.bangkokWeekday();
    const acks = S.offerAcksState();
    const list = D.offers({
      history: lo.history, points: lo.points,
      subscribedBranches: S.subscribedBranchesState(),
      publishedOffers: S.publishedOffersState()
    })
      .filter(o => o.live)
      .map(o => ({ ...o, key: offerKey(o, weekday) }))
      .filter(o => !acks[o.key]);
    // personal matches are the hook — they lead the queue
    return list.sort((a, b) => (b.personal ? 1 : 0) - (a.personal ? 1 : 0));
  }

  function syncOfferBell(pending) {
    offerBells.forEach(({ root, dot }) => {
      if (!root) return;
      root.hidden = false;                       // bell rides the nav once signed in
      if (dot) dot.hidden = pending.length === 0;
      root.classList.toggle("has-mail", pending.length > 0);
    });
  }

  function hideOfferPop() {
    if (offerPop) {
      offerPop.classList.remove("on");           // slide-out first…
      shownOfferKey = null;
      setTimeout(() => { if (!shownOfferKey) offerPop.hidden = true; }, 220);
    }
  }

  // show (or swap to) one pending offer — the popup IS the notification
  function showOfferPop(offer) {
    if (!offerPop) return;
    const o = offer;
    offerPop.innerHTML = `
      <div class="offer-pop-card ${o.personal ? "personal" : ""}">
        <button class="offer-pop-x" data-ack="popup" aria-label="Acknowledge offer">×</button>
        <div class="offer-pop-kicker">${o.kicker}${o.personal ? " · just for you" : ""}</div>
        <div class="offer-pop-title">${o.title}</div>
        <p>${o.text}</p>
        <div class="offer-pop-actions">
          <button class="btn ghost" data-ack="popup">Got it</button>
          <button class="btn accent" data-cta="rewards">See rewards</button>
        </div>
      </div>`;
    offerPop.querySelector("[data-ack]").addEventListener("click", () => {
      S.ackOffer(o.key, "popup");
      renderRewards();                            // inbox flips to "Seen"
      hideOfferPop();
      syncBellAndPop();                           // next pending, if any
    });
    offerPop.querySelector("[data-cta]").addEventListener("click", () => {
      S.ackOffer(o.key, "cta");
      renderRewards();
      hideOfferPop();
      goToView("rewards/offers");
      syncBellAndPop();
    });
    offerPop.hidden = false;
    shownOfferKey = o.key;
    // re-trigger the arrival animation (class swap — CSP-safe)
    offerPop.classList.remove("on");
    void offerPop.offsetWidth;                    // style flush
    offerPop.classList.add("on");
    // Marc-Lou shelf-life: it tucks itself away, unacknowledged; the next
    // refresh cycle (≤30s) re-rings it until it's acknowledged
    clearTimeout(offerPop._t);
    offerPop._t = setTimeout(hideOfferPop, 14000);
  }

  // one pass: recompute the queue, sync the bell, present the head offer
  function syncBellAndPop() {
    if (!offerPop) return;                        // host not mounted
    const pending = pendingOffers();
    syncOfferBell(pending);
    if (!pending.length) {
      if (shownOfferKey) hideOfferPop();
      return;
    }
    if (shownOfferKey === pending[0].key) return; // already showing it
    showOfferPop(pending[0]);
  }

  // offer inbox: a grouped feed instead of one flat stack. Offers are
  // split into Active (still ringing the bell) and Seen (already acked),
  // grouped by source — From your branches · This week · Just for you —
  // and sorted newest-first within each group so what just landed reads
  // first. Published branch offers carry their branch + recency line.
  function renderOffersInbox() {
    const lo = S.loyalty();
    const weekday = D.bangkokWeekday();
    const acks = S.offerAcksState();
    const list = D.offers({
      history: lo.history, points: lo.points,
      subscribedBranches: S.subscribedBranchesState(),
      publishedOffers: S.publishedOffersState()
    })
      .map(o => ({ ...o, key: offerKey(o, weekday) }));
    const live = list.filter(o => o.live && !acks[o.key]);
    const total = list.length;
    const seen = total - live.length;
    rwNote.textContent = live.length
      ? `${live.length} new · ${total} total this week`
      : total ? `${total} this week — all seen` : "nothing yet";
    rwOffers.innerHTML = "";

    if (!total) {
      rwOffers.innerHTML = `<p class="rw-offers-empty">Nothing here yet. Pick a branch in the
        Branches tab to start hearing from it — offers land here as they come in.</p>`;
      return;
    }

    // group label + offers, newest first by published sentAt (branch offers)
    // then the composed set
    const group = (label, items) => {
      if (!items.length) return "";
      const cards = items.map(o => {
        const acked = !!acks[o.key];
        const state = acked ? "acked" : (o.live ? "live" : "");
        const recency = o.branchOffer && o.sentAt
          ? `<span class="rw-offer-when">${fmtAgo(o.sentAt)} ago</span>` : "";
        const sourceNote = o.branchOffer && o.branchId
          ? `<span class="rw-offer-branch">${D.branchKicker(o.branchId)}</span>` : "";
        return `
          <div class="rw-offer ${o.live ? "live" : ""} ${o.personal ? "personal" : ""}
               ${o.branchOffer ? "branch" : ""} ${state}">
            <div class="rw-offer-top">
              <div class="rw-offer-kicker">${sourceNote || o.kicker}${o.personal ? " · just for you" : ""}</div>
              ${recency}
            </div>
            <div class="rw-offer-title">${o.title}</div>
            <p>${o.text}</p>
            ${acked ? `<span class="rw-offer-seen">Seen ✓</span>`
              : o.live ? `<button class="rw-offer-ack" data-ackkey="${o.key}">✓ Got it</button>`
              : ""}
            ${o.live && !acked ? `<span class="rw-live-dot"></span>` : ""}
          </div>`;
      }).join("");
      return `<h4 class="rw-offers-group"><span class="rg-label">${label}</span><span class="rg-count">${items.length}</span></h4>
        ${cards}`;
    };

    const active = list.filter(o => o.live && !acks[o.key]);
    const seenOffers = list.filter(o => !(o.live && !acks[o.key]));

    // active: branch offers first (the newest incoming), then weekly, then personal
    const actBranch = active.filter(o => o.branchOffer)
      .sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0));
    rwOffers.insertAdjacentHTML("beforeend",
      group(`Active ${actBranch.length ? "· from your branches" : ""}`, actBranch) +
      group("This week", active.filter(o => !o.branchOffer && !o.personal)) +
      group("Just for you", active.filter(o => o.personal)) +
      group("Seen", seenOffers));
    rwOffers.querySelectorAll("[data-ackkey]").forEach(btn => {
      btn.addEventListener("click", () => {
        S.ackOffer(btn.dataset.ackkey, "inbox");
        syncBellAndPop();
        renderRewards();
      });
    });
  }

  /* ---------------- Rewards (points + tiers + offers inbox) ----------------
     Renders from the data-layer rules (TIERS, offers()) + store balances;
     re-renders on every loyalty change (checkout, redeem) and on data
     refresh so weekday deals flip live. The offers inbox is the bell's
     ledger (renderOffersInbox, above): live offers wait for an ack,
     acknowledged ones go quiet ("Seen ✓"). */
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

    // offers inbox → the bell's ledger (live = waiting for an ack; acked = Seen ✓)
    renderOffersInbox();

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
  const wlRedeemNote = $("#wl-redeem-note");
  const wlLedger = $("#wl-ledger");
  const wlPay = $("#wl-pay");

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

    renderExpressPay(w.expressPay);
  }

  /* express pay — one-time provisioning, the honest demo version of
     Add to Apple Pay / Google Wallet: while unprovisioned the card shows
     the two platform buttons; once added, they're gone for good (the card
     lives in the phone's wallet), replaced by a quiet "Added" chip. */
  function renderExpressPay(provider) {
    if (!wlPay) return;
    if (provider === "apple") {
      wlPay.innerHTML = `
        <div class="wl-added" role="status">Apple&nbsp;Pay card added
          <span class="wl-added-sub">It lives in Wallet on this device — pay at checkout with a double-click.</span>
        </div>`;
    } else if (provider === "google") {
      wlPay.innerHTML = `
        <div class="wl-added" role="status">G&nbsp;Pay card added
          <span class="wl-added-sub">It lives in Google Wallet on this device — pay at checkout in a tap.</span>
        </div>`;
    } else {
      wlPay.innerHTML = `
        <h3>One tap at checkout</h3>
        <p>Put your Naeki balance a double-click away — the card lives in the
           phone's wallet, in Safari on iPhone and on Apple&nbsp;Watch.</p>
        <div class="wl-pay-row">
          <button class="btn accent wl-pay-btn" id="wl-applepay" aria-label="Add to Apple Pay">
            <svg viewBox="0 0 27 20" class="ap-mark" aria-hidden="true"><path d="M4.3 2.1c1.9-.3 3.4.6 4.9.5 1.6 0 3.5-1 5.7-.9 2.4 0 4.1 1 5.1 2.9-3.5 2-4.3 6.1-.3 8.5-.8 1.8-2.2 3.9-3.8 3.9-1.7 0-2.2-1.1-4.2-1.1-2 0-2.6 1.1-4.2 1.1-1.7 0-3.1-2.1-3.9-4C1.6 10.2.9 6 2.2 3.4c.5-.9 1.2-1.2 2.1-1.3zm6.9-1.8c.8-1.4 2.3-2.4 3.6-2.5.2 1.5-.6 3-1.4 3.9-.8.9-2.2 1.6-3.4 1.5-.2-1.3.5-2.5 1.2-2.9z" fill="currentColor"/></svg>
            Add to Apple Pay
          </button>
          <button class="btn ghost" id="wl-gpay" aria-label="Add to Google Wallet">G&nbsp;Pay</button>
        </div>
        <p class="wl-note">One-time — once added, the card is in the phone's wallet and this prompt is done.</p>`;
      $("#wl-applepay").addEventListener("click", () => {
        if (S.setExpressPay("apple")) flash("Naeki balance added to Apple Pay");
      });
      $("#wl-gpay").addEventListener("click", () => {
        if (S.setExpressPay("google")) flash("Naeki balance added to Google Wallet");
      });
    }
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

  // loyalty changes repaint the three panes + every dish stepper; the offers
  // inbox also flips when the data layer refreshes (weekday deals). A
  // checkout can mint a brand-new personal offer — the bell rings on it
  // immediately, not on the next 30s tick.
  S.onLoyalty(() => { renderRewards(); renderWallet(); renderMilestones(); syncSessionLoyalty(); syncBellAndPop(); });
  D.subscribe("refresh", () => { renderRewards(); renderMilestones(); syncBellAndPop(); });
  renderRewards();
  renderWallet();
  syncSessionLoyalty();
  syncBellAndPop();            // bell + first pending offer on boot

  /* ---------------- Milestones & Trust (seven achievements) ----------------
     Renders the mission-of-the-week card, the seven achievement tiles, the
     referral give+get loop, and the seven-point trust pane. Repaints on every
     loyalty change and on data refresh (the weekly mission advances live).
     CSP-note: all dynamic styling goes through class swaps / CSSOM, never
     inline style attributes. */

  const MM_MISSION = $("#mm-mission");
  const MM_LIST = $("#mm-list");
  const MM_REF_CODES = $("#mm-ref-codes");
  const MM_REF_NOTE = $("#mm-ref-note");
  const MM_TRUST = $("#mm-trust");

  function renderMilestones() {
    if (!MM_LIST) return;                       // view not mounted yet
    const lo = S.loyalty();
    const ach = S.achievementState();
    const claimed = S.claimedState();
    const mission = D.weeklyMission(lo.history);

    // mission-of-the-week card
    if (MM_MISSION) {
      const pct = Math.min(100, Math.round(mission.have / mission.need * 100));
      MM_MISSION.innerHTML = `
        <div class="mm-kicker">${mission.kicker}</div>
        <h3>${mission.title}</h3>
        <p>${mission.text}</p>
        <div class="rw-tier-progress mm-progress">
          <span class="rw-progress-label">${mission.have} / ${mission.need} orders this week</span>
          <div class="rw-progress-track"><div class="rw-progress-fill mm-fill" data-pct="${pct}"></div></div>
        </div>`;
      const fill = MM_MISSION.querySelector(".mm-fill");
      if (fill) fill.style.setProperty("--rw-pct", pct + "%");
    }

    // the seven achievement tiles
    MM_LIST.innerHTML = D.MILESTONES.map(m => {
      const done = !!ach.done[m.id];
      const isClaimed = claimed.includes(m.id);
      const state = done && isClaimed ? "claimed"
                  : done            ? "earned"
                  :                   "locked";
      // progress hints for the two "measured" ones
      const prog = m.id === "breadth" ? `${ach.breadth} / ${D.MENU.length} categories`
                : m.id === "cadence"  ? `${Math.min(ach.cadence, 7)} / 7 days`
                : m.id === "week"     ? `${Math.min(ach.week, 3)} / 3 this week`
                : m.id === "lifetime" ? `${fmtBaht(Math.min(ach.lifetime, 1000))} / ฿1,000`
                :                       "";
      return `
        <div class="mm-tile ${state} ${m.id}" data-id="${m.id}">
          <div class="mm-tile-head">
            <span class="mm-tile-jp" lang="ja">${m.jp}</span>
            <span class="mm-tile-pts">+${m.pts} pts</span>
          </div>
          <div class="mm-tile-kicker">${m.kicker}</div>
          <h4>${m.title}</h4>
          <p>${m.text}</p>
          ${prog ? `<div class="mm-tile-prog">${prog}</div>` : ""}
          <button class="btn ${state === "earned" ? "accent" : "ghost"}"
                  id="mm-claim-${m.id}" ${state === "earned" ? "" : "disabled"}>
            ${state === "claimed" ? "Claimed ✓" 
              : state === "earned" ? "Claim +" + m.pts + " pts"
              : "Locked"}
          </button>
        </div>`;
    }).join("");

    // claim buttons
    D.MILESTONES.forEach(m => {
      const btn = MM_LIST.querySelector("#mm-claim-" + m.id);
      if (!btn || btn.disabled) return;
      btn.addEventListener("click", () => {
        const res = S.claimMilestone(m.id);
        if (res) flash(`Milestone complete! +${res.pts} points`);
        renderMilestones();
      });
    });

    // referral codes (the giver's list)
    if (MM_REF_CODES && S.referralCodesState().length) {
      MM_REF_CODES.innerHTML = S.referralCodesState()
        .slice(0, 3)
        .map(c => `<div class="mm-ref-row"><code>${c.code}</code><span>${fmtWhen(c.created)}</span></div>`)
        .join("");
    }

    // trust pane — seven, always
    if (MM_TRUST) {
      MM_TRUST.innerHTML = D.TRUST.map(t => `<li>${t}</li>`).join("");
    }
  }

  // referral: generate
  const mmMakeRef = $("#mm-make-ref");
  if (mmMakeRef) mmMakeRef.addEventListener("click", () => {
    const code = S.makeReferral();
    flash("Share this code: " + code);
    renderMilestones();
  });

  // referral: redeem
  const mmRefForm = $("#mm-ref-form");
  if (mmRefForm) mmRefForm.addEventListener("submit", e => {
    e.preventDefault();
    const codeVal = $("#mm-ref-code").value;
    const res = S.redeemReferral(codeVal);
    if (MM_REF_NOTE) {
      MM_REF_NOTE.textContent = res
        ? `Welcome! +${res.pts} points from ${res.code}.`
        : "Code not found, already used, or it's your own."
                            + (res === null && codeVal ? " (Codes stay on one device.)" : "");
    }
    if (res) { $("#mm-ref-code").value = ""; renderMilestones(); }
  });

  renderMilestones();

  /* ---------------- Chat → LINE OA (large orders & catering) ----------------
     The in-app chat is a thin, honest surface: it records the user's draft on
     this device only, then hands them to the LINE OA (the channel Naeki answers
     on). LINE's lin.ee links open the chat but cannot prefill text, so the
     prompt is kept here as the local thread as the user is handed off. */
  const CH_THREAD = $("#ch-thread");
  const CH_TOPICS = $("#ch-topics");
  const CH_FORM = $("#ch-form");
  const CH_INPUT = $("#ch-input");
  const CH_NOTE = $("#ch-note");

  // open the OA in the system browser (same path every external link uses)
  function openLine() {
    window.open(D.INFO.lineUrl, "_blank");
    S.chatConnect();
  }

  function chatNote(msg) {
    if (CH_NOTE) CH_NOTE.textContent = msg || "";
  }

  function renderChatThread() {
    if (!CH_THREAD) return;
    const th = S.chatState().thread;
    CH_THREAD.innerHTML = th.length
      ? th.map(m => `
          <div class="ch-bubble ${m.role}">
            ${m.role === "user" && m.topic ? `<span class="ch-bubble-topic">${m.topic}</span>` : ""}
            ${escapeHtml(m.text)}
            <span class="ch-time">${fmtWhen(m.ts)}</span>
          </div>`).join("")
      : `<div class="ch-bubble system">Hi — tap a topic or type a message. Large orders and
         party trays are handled by the Naeki team on LINE, and we'll hand you
         straight over.</div>`;
    CH_THREAD.scrollTop = CH_THREAD.scrollHeight;
  }

  // the demo escape helper (matches how other renders avoid injecting raw text)
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // topic cards + handoff handler
  function renderChatTopics() {
    if (!CH_TOPICS) return;
    CH_TOPICS.innerHTML = D.chatTopics().map(r => `
      <button type="button" class="ch-topic" data-topic="${r.topic}" role="button">
        <span class="ch-topic-icon" aria-hidden="true">
          ${r.icon === "sushi" ? "🍣" : r.icon === "briefcase" ? "💼"
           : r.icon === "bag" ? "🛍️" : r.icon === "delivery" ? "🛵"
           : r.icon === "menu" ? "📋" : "💬"}
        </span>
        <h4>${r.topic}</h4>
        <p>${r.prompt}</p>
        <span class="btn accent">Chat in LINE</span>
      </button>`).join("");
    CH_TOPICS.querySelectorAll(".ch-topic").forEach(btn => {
      btn.addEventListener("click", () => {
        const route = D.CHAT_ROUTES.find(x => x.topic === btn.dataset.topic) || {};
        const prompt = route.prompt || "I have a question for the Naeki team.";
        S.chatSend(prompt, btn.dataset.topic);         // draft — on-device only
        S.chatNote("Handing you to the Naeki team on LINE (@naekisushi) — your order and reply continue there.");
        S.chatConnect();
        renderChatThread();
        chatNote("Opening LINE…");
        openLine();
      });
    });
  }

  // composer: record the draft locally, then hand off to LINE
  if (CH_FORM) CH_FORM.addEventListener("submit", e => {
    e.preventDefault();
    const text = CH_INPUT.value.trim();
    if (!text) { chatNote("Type a message first, or tap a topic above."); return; }
    S.chatSend(text);
    S.chatConnect();
    CH_INPUT.value = "";
    renderChatThread();
    chatNote("Opening LINE to continue…");
    openLine();
  });

  renderChatThread();
  renderChatTopics();

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

  /* ---------------- Stamp card (Rewards · Stamps pane) ----------------
     The collecting card lives inside the Rewards section now; this engine
     paints its pane and wires its three actions. */
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