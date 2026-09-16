/// <reference path="./types.d.ts" />
/* NAEKI-API — renderer client for server/api.mjs (Neon Postgres).
   Same surface the old PocketBase client exposed, so store.js/app.js keep
   their shape: sign-in returns the user + role, user-scoped reads/writes go
   through a Bearer token the server keeps in memory. */
(() => {
  "use strict";
  const BASE = "http://127.0.0.1:8090";

  let token = null;      // session token from /api/auth/sign-in
  let currentUser = null; // user record once signed in

  async function json(url, method = "GET", body) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;
    const r = await fetch(BASE + url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  }

  /* ---------- auth ---------- */
  async function signIn(email, password) {
    const r = await json("/api/auth/sign-in", "POST", { email, password });
    if (!r.ok) return { ok: false, error: r.data?.message || "sign in failed" };
    token = r.data.token;
    currentUser = r.data.user;
    // staff role = portal access, driven by the seeded `role` field
    // (franchise_owner / admin / superadmin), NOT the display name.
    return { ok: true, user: currentUser, isStaff: r.data.isStaff, role: r.data.role };
  }

  async function signOut() {
    if (token) { await json("/api/auth/sign-out", "POST").catch(() => {}); }
    token = null; currentUser = null;
  }

  function me() { return currentUser; }

  /* ---------- per-user loyalty (owner-scoped) ---------- */
  async function getLoyalty() {
    if (!currentUser) return null;
    const r = await json("/api/loyalty", "GET");
    return r.ok ? r.data : null;
  }

  async function upsertLoyalty(patch) {
    if (!currentUser) return null;
    const r = await json("/api/loyalty", "PUT", patch);
    return r.ok ? r.data : null;
  }

  /* ---------- generic per-user blob (the whole user-owned store) ---------- */
  async function userStateGet() {
    if (!currentUser) return null;
    const r = await json("/api/state", "GET");
    if (!r.ok) return null;
    return { data: r.data.data };
  }

  async function userStateUpsert(data) {
    if (!currentUser) return false;
    const r = await json("/api/state", "PUT", data);
    return r.ok;
  }

  /* ---------- coupons (public read; the brand's ledger) ---------- */
  async function couponList() {
    const r = await json("/api/coupons", "GET");
    return r.ok ? r.data.items || [] : [];
  }

  /** fetch one coupon by code (case-insensitive) — null when unknown */
  async function couponByCode(code) {
    const wanted = String(code || "").trim();
    if (!wanted) return null;
    const r = await json("/api/coupons/" + encodeURIComponent(wanted.toUpperCase()), "GET");
    return r.ok ? r.data : null;
  }

  /* ---------- promotions (the portal workflow) ---------- */
  /** client-side filter for the one form the app uses:
      "key='v1' || key='v2'" (the old PocketBase filter syntax, kept so
      existing call sites don't change). Unparseable filters return all. */
  function matchFilter(row, filter) {
    const conds = String(filter).split("||").map(s => s.trim());
    const parsed = conds.map(c => /^(\w+)\s*=\s*'([^']*)'$/.exec(c)).filter(Boolean);
    if (!parsed.length) return true;
    return parsed.some(m => String(row[m[1]] ?? "") === m[2]);
  }

  async function promoList(filter = "") {
    const r = await json("/api/promos", "GET");
    if (!r.ok) return [];
    const rows = r.data.items || [];
    return filter ? rows.filter(row => matchFilter(row, filter)) : rows;
  }

  async function promoCreate(payload) {
    const r = await json("/api/promos", "POST", payload);
    return r.ok ? r.data : null;
  }

  async function promoUpdate(id, patch) {
    const r = await json("/api/promos/" + encodeURIComponent(id), "PATCH", patch);
    return r.ok ? r.data : null;
  }

  window.NaekiAPI = {
    BASE,
    signIn, signOut, me, getLoyalty, upsertLoyalty, userStateGet, userStateUpsert,
    couponList, couponByCode,
    promoList, promoCreate, promoUpdate
  };

  /* expose to app.js for auth-gated flows */
  window.NaekiAPIReady = true;
})();