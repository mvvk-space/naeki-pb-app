/// <reference path="./types.d.ts" />
/* NAEKI SHOWCASE — UI behaviour for the vanilla shadcn port.
   shadcn ships React primitives; this is the dependency-free equivalent:
   declarative data-s-* wiring over the .s-* recipes in shadcn.css. It is the
   same "one component, one place" contract — markup declares intent, this
   file supplies the behaviour, the CSS supplies the look.

   CSP-safe: built DOM, addEventListener only, no inline handlers. Exposes
   window.NaekiUI so app code can raise toasts programmatically. */
window.NaekiUI = (() => {
  "use strict";

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  /* ---------------- tiny icon set (lucide geometry, 24×24 stroke) ---------------- */
  const ICONS = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronRight: '<path d="m9 6 6 6-6 6"/>',
    chevronLeft: '<path d="m15 6-6 6 6 6"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  };
  /** @param {keyof typeof ICONS} name */
  function iconMarkup(name) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
  }

  /* ================= TABS ================= */
  function initTabs(root) {
    const list = $(".s-tabs-list", root);
    if (!list) return;
    const triggers = $$(".s-tabs-trigger", list);
    const panels = $$(".s-tabs-panel", root);

    function select(value, focus) {
      triggers.forEach(btn => {
        const on = btn.dataset.tab === value;
        btn.dataset.state = on ? "active" : "inactive";
        btn.setAttribute("aria-selected", String(on));
        btn.tabIndex = on ? 0 : -1;
        if (on && focus) btn.focus();
      });
      panels.forEach(panel => {
        const on = panel.dataset.tabPanel === value;
        panel.hidden = !on;
        panel.dataset.state = on ? "active" : "inactive";
      });
    }

    triggers.forEach((btn, i) => {
      btn.addEventListener("click", () => select(btn.dataset.tab, false));
      btn.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const next = triggers[(i + dir + triggers.length) % triggers.length];
        select(next.dataset.tab, true);
      });
    });

    const initial = triggers.find(t => t.dataset.state === "active") || triggers[0];
    if (initial) select(initial.dataset.tab, false);
  }

  /* ================= SWITCH ================= */
  function initSwitch(root) {
    const btn = $(".s-switch", root);
    if (!btn) return;
    const set = (on) => {
      btn.dataset.state = on ? "checked" : "unchecked";
      btn.setAttribute("aria-checked", String(on));
    };
    set(btn.dataset.state === "checked");
    btn.addEventListener("click", () => set(btn.dataset.state !== "checked"));
    btn.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); set(btn.dataset.state !== "checked"); }
    });
  }

  /* ================= ACCORDION ================= */
  function initAccordion(root) {
    $$(".s-accordion-trigger", root).forEach(btn => {
      const content = document.getElementById(btn.getAttribute("aria-controls"));
      if (!content) return;
      const set = (open) => {
        btn.setAttribute("aria-expanded", String(open));
        content.hidden = !open;
      };
      set(btn.getAttribute("aria-expanded") === "true");
      btn.addEventListener("click", () => set(btn.getAttribute("aria-expanded") !== "true"));
    });
  }

  /* ================= PROGRESS ================= */
  function initProgress(root) {
    const bar = root.classList && root.classList.contains("s-progress") ? root : $(".s-progress", root);
    if (!bar) return;
    const value = Math.max(0, Math.min(100, Number(bar.dataset.value) || 0));
    bar.setAttribute("role", "progressbar");
    bar.setAttribute("aria-valuemin", "0");
    bar.setAttribute("aria-valuemax", "100");
    bar.setAttribute("aria-valuenow", String(value));
    const indicator = $(".s-progress-indicator", bar);
    if (indicator) indicator.style.transform = `translateX(-${100 - value}%)`;
  }

  /* ================= CHECKBOX ================= */
  function initCheckbox(root) {
    $$(".s-checkbox", root).forEach(btn => {
      const set = (on) => {
        btn.dataset.state = on ? "checked" : "unchecked";
        btn.setAttribute("aria-checked", String(on));
      };
      set(btn.dataset.state === "checked");
      btn.addEventListener("click", () => {
        if (btn.disabled || btn.getAttribute("aria-disabled") === "true") return;
        set(btn.dataset.state !== "checked");
      });
      if (!btn.querySelector("svg")) {
        btn.insertAdjacentHTML("afterbegin", iconMarkup("check"));
      }
    });
  }

  /* ================= RADIO GROUP ================= */
  function initRadioGroup(root) {
    $$(".s-radio-group", root).forEach(group => {
      const radios = $$(".s-radio", group);
      const select = (active) => radios.forEach(r => {
        const on = r === active;
        r.dataset.state = on ? "checked" : "unchecked";
        r.setAttribute("aria-checked", String(on));
        r.tabIndex = on ? 0 : -1;
      });
      radios.forEach(radio => {
        radio.setAttribute("role", "radio");
        radio.addEventListener("click", () => select(radio));
        radio.addEventListener("keydown", (e) => {
          if (e.key !== "ArrowDown" && e.key !== "ArrowRight" && e.key !== "ArrowUp" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          const i = radios.indexOf(radio);
          const dir = (e.key === "ArrowDown" || e.key === "ArrowRight") ? 1 : -1;
          const next = radios[(i + dir + radios.length) % radios.length];
          select(next); next.focus();
        });
      });
      select(radios.find(r => r.dataset.state === "checked") || radios[0]);
    });
  }

  /* ================= SLIDER (native range, CSS-track) ================= */
  function initSlider(root) {
    $$(".s-slider", root).forEach(slider => {
      const input = $("input[type='range']", slider);
      if (!input) return;
      const paint = () => {
        const min = Number(input.min || 0), max = Number(input.max || 100);
        const pct = max > min ? ((Number(input.value) - min) / (max - min)) * 100 : 0;
        slider.style.setProperty("--s-slider-pct", pct + "%");
      };
      paint();
      input.addEventListener("input", paint);
    });
  }

  /* ================= TOGGLE / TOGGLE GROUP ================= */
  function initToggle(root) {
    $$(".s-toggle-group", root).forEach(group => {
      const multi = group.dataset.type === "multiple";
      $$(".s-toggle", group).forEach(btn => {
        btn.setAttribute("role", "button");
        btn.addEventListener("click", () => {
          const on = btn.dataset.state !== "on";
          if (!multi) $$(".s-toggle", group).forEach(b => b.dataset.state = "off");
          btn.dataset.state = on ? "on" : "off";
          btn.setAttribute("aria-pressed", String(on));
        });
      });
    });
    $$(".s-toggle:not(.s-toggle-group .s-toggle)", root).forEach(btn => {
      btn.setAttribute("role", "button");
      btn.setAttribute("aria-pressed", String(btn.dataset.state === "on"));
      btn.addEventListener("click", () => {
        const on = btn.dataset.state !== "on";
        btn.dataset.state = on ? "on" : "off";
        btn.setAttribute("aria-pressed", String(on));
      });
    });
  }

  /* ================= DROPDOWN MENU ================= */
  function initDropdown(root) {
    $$(".s-dropdown", root).forEach(dd => {
      const trigger = $("[data-dropdown-trigger]", dd);
      const menu = $(".s-dropdown-menu", dd);
      if (!trigger || !menu) return;
      const close = () => { menu.hidden = true; trigger.setAttribute("aria-expanded", "false"); };
      const open = () => { menu.hidden = false; trigger.setAttribute("aria-expanded", "true"); };
      trigger.setAttribute("aria-haspopup", "menu");
      trigger.setAttribute("aria-expanded", "false");
      trigger.addEventListener("click", () => menu.hidden ? open() : close());
      dd.addEventListener("keydown", (e) => { if (e.key === "Escape") { close(); trigger.focus(); } });
      $$(".s-dropdown-item", menu).forEach(item => item.addEventListener("click", close));
      document.addEventListener("click", (e) => { if (!dd.contains(e.target)) close(); });
    });
  }

  /* ================= POPOVER ================= */
  function initPopover(root) {
    $$(".s-popover", root).forEach(pop => {
      const trigger = $("[data-popover-trigger]", pop);
      const content = $(".s-popover-content", pop);
      if (!trigger || !content) return;
      const close = () => { content.hidden = true; trigger.setAttribute("aria-expanded", "false"); };
      trigger.setAttribute("aria-expanded", "false");
      trigger.addEventListener("click", () => {
        content.hidden = !content.hidden;
        trigger.setAttribute("aria-expanded", String(!content.hidden));
      });
      pop.addEventListener("keydown", (e) => { if (e.key === "Escape") { close(); trigger.focus(); } });
      document.addEventListener("click", (e) => { if (!pop.contains(e.target)) close(); });
    });
  }

  /* ================= SHEET ================= */
  function initSheet(root) {
    $$("[data-sheet]", root).forEach(sheet => {
      const open = () => { sheet.hidden = false; const f = sheet.querySelector(".s-sheet-close, button"); if (f) f.focus(); };
      const close = () => { sheet.hidden = true; };
      sheet.openSheet = open;
      $$(`[data-sheet-open="${sheet.id}"]`, document).forEach(btn => btn.addEventListener("click", open));
      $$("[data-sheet-close]", sheet).forEach(btn => btn.addEventListener("click", close));
      sheet.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    });
  }

  /* ================= DIALOG ================= */
  function initDialog(root) {
    const card = $(".s-dialog-card", root);
    function open() {
      root.hidden = false;
      const focusable = card && card.querySelector("button, [href], input, select, textarea, [tabindex]");
      if (focusable) focusable.focus();
    }
    function close() { root.hidden = true; }
    root.openDialog = open;
    root.closeDialog = close;
    $$("[data-dialog-open]", document).forEach(btn => {
      if (btn.dataset.dialogOpen === root.id) btn.addEventListener("click", open);
    });
    $$("[data-dialog-close]", root).forEach(btn => btn.addEventListener("click", close));
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
      if (e.key !== "Tab" || !card) return;
      const items = $$("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])", card);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ================= TOAST ================= */
  let toaster = null;
  function ensureToaster() {
    if (toaster && document.body.contains(toaster)) return toaster;
    toaster = document.createElement("div");
    toaster.className = "s-toaster";
    toaster.setAttribute("role", "region");
    toaster.setAttribute("aria-live", "polite");
    toaster.setAttribute("aria-label", "Notifications");
    document.body.appendChild(toaster);
    return toaster;
  }
  /** @param {{title?:string, description?:string, variant?:"default"|"destructive", duration?:number}} opts */
  function toast(opts = {}) {
    const host = ensureToaster();
    const el = document.createElement("div");
    el.className = "s-toast" + (opts.variant === "destructive" ? " s-toast-destructive" : "");
    el.setAttribute("role", opts.variant === "destructive" ? "alert" : "status");

    const body = document.createElement("div");
    body.className = "s-toast-body";
    if (opts.title) {
      const t = document.createElement("div");
      t.className = "s-toast-title";
      t.textContent = opts.title;
      body.appendChild(t);
    }
    if (opts.description) {
      const d = document.createElement("div");
      d.className = "s-toast-description";
      d.textContent = opts.description;
      body.appendChild(d);
    }
    el.appendChild(body);

    const close = document.createElement("button");
    close.className = "s-toast-close";
    close.type = "button";
    close.setAttribute("aria-label", "Dismiss");
    close.textContent = "\u00d7";

    const remove = () => {
      if (!el.isConnected) return;
      el.classList.add("s-toast-leaving");
      el.addEventListener("animationend", () => el.remove(), { once: true });
    };
    close.addEventListener("click", remove);
    el.appendChild(close);

    host.appendChild(el);
    const duration = opts.duration ?? 3800;
    if (duration > 0) setTimeout(remove, duration);
    return { dismiss: remove, el };
  }

  /* ================= data-toast triggers ================= */
  function initToastTriggers(root) {
    $$("[data-toast]", root).forEach(btn => {
      btn.addEventListener("click", () => {
        toast({
          title: btn.dataset.toastTitle || btn.dataset.toast,
          description: btn.dataset.toastDescription || "",
          variant: btn.dataset.toastVariant || "default",
        });
      });
    });
  }

  /* ================= bootstrap ================= */
  function init(root = document) {
    $$("[data-tabs]", root).forEach(initTabs);
    $$("[data-switch]", root).forEach(initSwitch);
    $$("[data-accordion]", root).forEach(initAccordion);
    $$(".s-progress", root).forEach(initProgress);
    $$("[data-dialog]", root).forEach(initDialog);
    initCheckbox(root);
    initRadioGroup(root);
    initSlider(root);
    initToggle(root);
    initDropdown(root);
    initPopover(root);
    initSheet(root);
    initToastTriggers(root);
    // demo-only anchors in the UI Kit carry data-noop so clicking them never
    // navigates the shell or jumps the scroll position
    $$("[data-noop]", root).forEach(a => a.addEventListener("click", (e) => e.preventDefault()));
    $$("[data-icon]", root).forEach(el => {
      if (el.querySelector("svg")) return;
      const svg = iconMarkup(el.dataset.icon);
      if (el.dataset.iconPosition === "end") el.insertAdjacentHTML("beforeend", svg);
      else el.insertAdjacentHTML("afterbegin", svg);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => init(), { once: true });
  } else {
    init();
  }

  return { init, toast, icons: ICONS, iconMarkup };
})();
