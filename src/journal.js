/* NAEKI SHOWCASE — journal strip (landing home view).
   Fetches the blog's RSS feed (served by the API from blog/dist, or
   same-origin when the PWA and blog are co-hosted), renders the latest
   posts as cards, and keeps the last good feed in localStorage so the
   strip still shows something offline or while the blog isn't built.
   CSP-safe: built DOM, wired listeners, no inline handlers. Post links
   go through window.open so Electron's window handler sends them to the
   system browser instead of navigating the app shell away. */
window.NaekiJournal = (() => {
  "use strict";

  const API = "http://127.0.0.1:8090";
  const KEY = "naeki.journal.feed.v1";
  const MAX = 3;
  let feedBase = null; // rss.xml URL the live feed came from (drives "All articles")

  /* feed candidates, most specific first: same-origin /rss.xml (PWA where
     the blog is co-hosted), then the API origin (Electron, file:// pages).
     `location` is undefined in the test sandbox — fall back to the API. */
  function feedUrls() {
    try {
      return [new URL("rss.xml", window.location.href).href, `${API}/rss.xml`];
    } catch {
      return [`${API}/rss.xml`];
    }
  }

  /* extract <item> records from RSS text. The feed is our own Astro build
     (clean XML, one <item> per post), so a small extractor beats shipping
     an XML parser; malformed items are skipped, never throw. */
  function parseFeed(xml) {
    const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };
    const text = (raw) => String(raw || "")
      .replace(/<!\[CDATA\[([\s\S]*)\]\]>/, "$1")
      .replace(/&([a-z]+|#\d+);/gi, (m, e) => entities[e.toLowerCase()] ?? m)
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const items = [];
    for (const m of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const item = m[1];
      const pick = (tag) => {
        const t = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(item);
        return t ? text(t[1]) : "";
      };
      const link = pick("link");
      const title = pick("title");
      if (!link || !title) continue;
      items.push({
        title,
        url: link,
        date: pick("pubDate"),
        description: pick("description"),
      });
    }
    // newest first, capped — the feed is already sorted but cheap to enforce
    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    return items.slice(0, MAX);
  }

  /* Thai dates everywhere the journal shows — th-TH gives Thai month names
     and the Buddhist era (2025 → พ.ศ. 2568) for free. */
  function fmtDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    try {
      return d.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
    } catch {
      return d.toLocaleDateString();
    }
  }

  /* post URLs arrive with the feed's own origin baked in (the Astro `site`
     setting — a placeholder); rewrite to the origin the feed was actually
     fetched from so the strip works wherever the blog is served. */
  function rewriteToOrigin(raw, feedBase) {
    try {
      const u = new URL(raw, feedBase);
      return new URL(feedBase).origin + u.pathname;
    } catch { return raw; }
  }

  /* resolve a possibly-relative url against the page base (no-op for
     absolute ones — never rewrite those to file:// or the wrong origin) */
  function normalizeUrl(raw, base) {
    try {
      if (/^https?:\/\//i.test(raw)) return raw;
      return new URL(raw, base).href;
    } catch { return raw; }
  }

  function openPost(url) {
    // one code path for both shells: the system browser (Electron routes
    // http window.open through shell.openExternal) or a normal tab (PWA)
    window.open(url, "_blank", "noopener");
  }

  function render(items) {
    const grid = document.getElementById("journal-strip");
    if (!grid || !items.length) return;
    for (const id of ["journal-head", "journal-sub"]) {
      const el = document.getElementById(id);
      if (el) el.hidden = false;
    }
    grid.textContent = "";
    for (const item of items) {
      const url = normalizeUrl(item.url, window.location.href);
      const card = document.createElement("article");
      card.className = "journal-card";

      const meta = document.createElement("div");
      meta.className = "journal-meta";
      const time = document.createElement("time");
      time.dateTime = new Date(item.date).toISOString?.() || "";
      time.textContent = fmtDate(item.date);
      meta.appendChild(time);

      const title = document.createElement("h4");
      title.className = "journal-title";
      title.textContent = item.title;

      const desc = document.createElement("p");
      desc.className = "journal-desc";
      desc.textContent = item.description;

      const more = document.createElement("span");
      more.className = "journal-more";
      more.textContent = "อ่านต่อ →";

      const btn = document.createElement("button");
      btn.className = "journal-link";
      btn.type = "button";
      btn.setAttribute("aria-label", `${item.title} — อ่านบทความเต็ม`);
      btn.append(meta, title, desc, more);
      btn.addEventListener("click", () => openPost(url));
      card.appendChild(btn);
      grid.appendChild(card);
    }
    grid.hidden = false;
  }

  async function load() {
    // last good feed first (instant, offline-proof), then refresh live
    try {
      const cached = JSON.parse(localStorage.getItem(KEY) || "null");
      if (Array.isArray(cached) && cached.length) render(cached);
    } catch { /* corrupt cache — live fetch decides */ }

    for (const feedUrl of feedUrls()) {
      try {
        const r = await fetch(feedUrl);
        if (!r.ok) continue;
        const items = parseFeed(await r.text());
        if (!items.length) continue;
        for (const item of items) item.url = rewriteToOrigin(item.url, feedUrl);
        feedBase = feedUrl;
        render(items);
        try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* private mode */ }
        return;
      } catch { /* dead origin — try the next one */ }
    }
    // no cache, no feed: the section stays hidden (render never un-hid it)
  }

  function init() {
    load();
    const open = document.getElementById("journal-open");
    if (open) open.addEventListener("click", () => {
      // land on the same origin the feed came from; fall back to the API
      try {
        const base = feedBase || new URL("rss.xml", window.location.href).href;
        openPost(new URL("blog/", base).href);
      } catch { openPost(`${API}/blog/`); }
    });
  }

  if (typeof document !== "undefined") {
    // DOM bootstrap only in the browser — the test sandbox imports the
    // module for parseFeed/fmtDate and has no document
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => init(), { once: true });
    } else {
      init();
    }
  }

  return { load, init, parseFeed, fmtDate, rewriteToOrigin };
})();