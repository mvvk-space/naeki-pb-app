/// <reference path="./types.d.ts" />
/* NAEKI-PB — PocketBase client. Talks to the local PocketBase spawned by
   main.js. Replaces the localStorage backing of store.js with real REST +
   real auth. The API surface matches what store.js needs so the UI code
   (app.js/frames.js) does not change. */
(() => {
  "use strict";
  const BASE = "http://127.0.0.1:8090";

  let token = null;      // auth token for a signed-in user
  let currentUser = null; // record once signed in

  async function json(url, method = "GET", body) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = token;
    const r = await fetch(BASE + url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  }

  /* ---------- auth ---------- */
  async function signIn(email, password) {
    const r = await json("/api/collections/users/auth-with-password", "POST", { identity: email, password });
    if (!r.ok) return { ok: false, error: r.data?.message || "sign in failed" };
    token = r.data.token;
    currentUser = r.data.record;
    // staff role = portal access. Drive it from the seeded `role` field
    // (franchise_owner / admin / superadmin), NOT the display name.
    const role = (currentUser?.role || "").toLowerCase();
    const isStaff = ["franchise_owner", "admin", "superadmin"].includes(role);
    return { ok: true, user: currentUser, isStaff, role };
  }

  async function signOut() {
    token = null; currentUser = null;
  }

  function me() { return currentUser; }

  /* ---------- per-user loyalty (owner-scoped) ---------- */
  async function getLoyalty() {
    if (!currentUser) return null;
    const r = await json("/api/collections/loyalty/records?filter=" + encodeURIComponent(`owner.id = "${currentUser.id}"`), "GET");
    if (!r.ok || !r.data.items?.length) return null;
    return r.data.items[0];
  }

  async function upsertLoyalty(patch) {
    if (!currentUser) return null;
    const existing = await getLoyalty();
    if (existing) {
      const r = await json("/api/collections/loyalty/records/" + existing.id, "PATCH", patch);
      return r.ok ? r.data : null;
    } else {
      const r = await json("/api/collections/loyalty/records", "POST", { owner: currentUser.id, ...patch });
      return r.ok ? r.data : null;
    }
  }

  /* ---------- generic per-user blob (the whole user-owned store) ---------- */
  async function userStateGet() {
    if (!currentUser) return null;
    const r = await json("/api/collections/user_state/records?filter=" + encodeURIComponent(`owner.id = "${currentUser.id}"`), "GET");
    if (!r.ok || !r.data.items?.length) return null;
    return r.data.items[0];
  }

  async function userStateUpsert(data) {
    if (!currentUser) return null;
    const existing = await userStateGet();
    if (existing) {
      const r = await json("/api/collections/user_state/records/" + existing.id, "PATCH", { data });
      return r.ok;
    } else {
      const r = await json("/api/collections/user_state/records", "POST", { owner: currentUser.id, data });
      return r.ok;
    }
  }

  /* ---------- notify requests (shared, cross-account) ---------- */
  async function notifyList(filter = "") {
    const parts = ["perPage=200"];
    if (filter) parts.push("filter=" + filter);
    const r = await json("/api/collections/notify_request/records?" + parts.join("&"), "GET");
    return r.ok ? r.data.items || [] : [];
  }

  async function notifyCreate(payload) {
    const r = await json("/api/collections/notify_request/records", "POST", {
      author: currentUser?.id, ...payload
    });
    return r.ok ? r.data : null;
  }

  async function notifyUpdate(id, patch) {
    const r = await json("/api/collections/notify_request/records/" + id, "PATCH", patch);
    return r.ok ? r.data : null;
  }

  /* ---------- coupons (public read; the collection is seeded in seed.mjs) ----------
     Redemption is validated client-side against the listed record: the coupon
     collection's update rule is admin-only, so usedCount is the brand's ledger
     — the app only ever reads it. */
  async function couponList(filter = "") {
    const parts = ["perPage=200"];
    if (filter) parts.push("filter=" + filter);
    const r = await json("/api/collections/coupon/records?" + parts.join("&"), "GET");
    return r.ok ? r.data.items || [] : [];
  }

  /** fetch one coupon by code (case-insensitive) — null when unknown */
  async function couponByCode(code) {
    const wanted = String(code || "").trim().toUpperCase();
    if (!wanted) return null;
    const rows = await couponList(`code='${wanted.replace(/'/g, "")}'`);
    return rows.find(c => String(c.code).toUpperCase() === wanted) || null;
  }

  /* ---------- promotions (role-gated approval workflow, seeded in seed.mjs) ---------- */
  async function promoList(filter = "") {
    const parts = ["perPage=200", "sort=-created"];
    if (filter) parts.push("filter=" + encodeURIComponent(filter));
    const r = await json("/api/collections/promotion/records?" + parts.join("&"), "GET");
    return r.ok ? r.data.items || [] : [];
  }

  async function promoCreate(payload) {
    const r = await json("/api/collections/promotion/records", "POST", {
      author: currentUser?.id, ...payload
    });
    return r.ok ? r.data : null;
  }

  async function promoUpdate(id, patch) {
    const r = await json("/api/collections/promotion/records/" + id, "PATCH", patch);
    return r.ok ? r.data : null;
  }

  window.NaekiPB = {
    BASE,
    signIn, signOut, me, getLoyalty, upsertLoyalty, userStateGet, userStateUpsert,
    notifyList, notifyCreate, notifyUpdate,
    couponList, couponByCode,
    promoList, promoCreate, promoUpdate
  };

  /* expose to app.js for auth-gated flows */
  window.NaekiPBReady = true;
})();
