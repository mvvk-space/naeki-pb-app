#!/usr/bin/env node
/* NAEKI-API — the app's thin HTTP API over Neon Postgres.
   Replaces the PocketBase binary on the same port (:8090), so main.js,
   the e2e suites and the renderer CSP keep working unchanged.

   Deliberately THIN (solo dev, pre-production): the UI is trusted, the
   server stores what it is sent, passwords verify against bcrypt hashes
   via pgcrypto, sessions are in-memory (restart → sign in again), and
   there is no per-role server enforcement beyond requiring a session
   for user-scoped routes.

   Connection: $NAEKI_DSN, else ~/.config/neon/naeki-sushi.dsn (chmod 600).
   Standalone: npm run api    (or: node server/api.mjs)
   Electron:   main.js spawns this file on launch (ELECTRON_RUN_AS_NODE=1). */

import http from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import pg from "pg";

const PORT = Number(process.env.NAEKI_API_PORT || 8090);
const HOST = "127.0.0.1";
const DSN_FILE = join(homedir(), ".config", "neon", "naeki-sushi.dsn");

function dsn() {
  if (process.env.NAEKI_DSN) return process.env.NAEKI_DSN;
  if (existsSync(DSN_FILE)) return readFileSync(DSN_FILE, "utf8").trim();
  return null;
}
const CONN = dsn();
if (!CONN) {
  console.error("[naeki-api] No database connection string found.");
  console.error(`  Set $NAEKI_DSN, or regenerate the Neon DSN file:

    neonctl connection-string --project-id purple-base-46144445 \\
      --database-name neondb --role-name neondb_owner > ${DSN_FILE}
    chmod 600 ${DSN_FILE}`);
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: CONN, max: 4 });
const sessions = new Map(); // token -> { id, email, name, role, branchId }
const newId = () => randomBytes(8).toString("hex");

/* ---------------- helpers ---------------- */
const num = (v) => (v == null || v === "" ? 0 : Number(v));

function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(data));
}
const fail = (res, status, message) => send(res, status, { message });

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", (c) => { buf += c; if (buf.length > 5e6) req.destroy(); });
    req.on("end", () => { try { resolve(buf ? JSON.parse(buf) : {}); } catch { resolve({}); } });
    req.on("error", reject);
  });
}

function sessionOf(req) {
  const m = /^Bearer\s+(.+)$/.exec(req.headers.authorization || "");
  return m ? sessions.get(m[1]) || null : null;
}

/* ---------------- journal (the built Astro blog under blog/dist) ----------------
   Anything not under /api is a static file from the blog build, so the
   renderer can fetch /rss.xml (and read posts) on the API origin the CSP
   already whitelists. No build step here: `npm run build` inside blog/
   produces the dist this serves; a missing dist just keeps 404ing. */

const BLOG_DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "blog", "dist");

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css",
  ".js": "text/javascript", ".mjs": "text/javascript",
  ".xml": "application/xml; charset=utf-8", ".json": "application/json",
  ".txt": "text/plain; charset=utf-8", ".webmanifest": "application/manifest+json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".woff": "font/woff", ".woff2": "font/woff2",
};

function serveBlog(res, pathname) {
  let rel = pathname;
  try { rel = decodeURIComponent(pathname); } catch { return false; }
  if (rel.endsWith("/")) rel += "index.html";
  const abs = join(BLOG_DIST, rel);
  // traversal guard: the resolved file must stay inside blog/dist
  if (!(abs === BLOG_DIST || abs.startsWith(BLOG_DIST + sep))) return false;
  if (!existsSync(abs) || !statSync(abs).isFile()) return false;
  const ext = abs.slice(abs.lastIndexOf(".")).toLowerCase();
  const immutable = abs.startsWith(BLOG_DIST + sep + "_astro" + sep); // hashed asset names
  res.writeHead(200, {
    "Content-Type": MIME[ext] || "application/octet-stream",
    "Cache-Control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(readFileSync(abs));
  return true;
}

/* ---------------- row mappers (DB snake_case -> UI camelCase) ---------------- */
const userOut = (r) => ({
  id: r.id, email: r.email, name: r.name || "",
  role: (r.role || "customer").toLowerCase(), branchId: r.branch_id || "",
});
const couponOut = (r) => ({
  id: r.id, code: r.code, title: r.title, type: r.type, brand: r.brand || "",
  branchId: r.branch_id || "", value: num(r.value), minSpend: num(r.min_spend),
  usageLimit: num(r.usage_limit), usedCount: num(r.used_count),
  freeItem: r.free_item || "", description: r.description || "",
  active: r.active, startsAt: num(r.starts_at_ms), expiresAt: num(r.expires_at_ms),
});
const promoOut = (r) => ({
  id: r.id, title: r.title, body: r.body, type: r.type, status: r.status,
  branch: r.branch, author: r.author, approver: r.approver,
  couponCode: r.coupon_code || "", ctaLabel: r.cta_label || "", ctaUrl: r.cta_url || "",
  when: r.when_note || "", sendCount: num(r.send_count), sentAt: num(r.sent_at_ms),
  created: num(r.created_ms), reviewedAt: num(r.reviewed_at_ms), reviewNote: r.review_note || "",
});

/* ---------------- routes ---------------- */
async function route(req, res) {
  const u = new URL(req.url, `http://${HOST}:${PORT}`);
  const path = u.pathname;

  if (req.method === "OPTIONS") return send(res, 204, {});

  /* health — same shape the old PB health endpoint returned */
  if (req.method === "GET" && path === "/api/health")
    return send(res, 200, { message: "API is healthy.", code: 200 });

  /* ---------- auth ---------- */
  if (req.method === "POST" && path === "/api/auth/sign-in") {
    const b = await readBody(req);
    if (!b.email || !b.password) return fail(res, 400, "Email and password are required.");
    const { rows } = await pool.query(
      `select id, email, name, role, branch_id,
              crypt($2, password_hash) = password_hash as ok
         from users
        where lower(email) = lower($1)`,
      [String(b.email), String(b.password)]);
    const row = rows[0];
    if (!row || !row.ok) return fail(res, 400, "Incorrect email or password.");
    const user = userOut(row);
    const token = randomBytes(24).toString("hex");
    sessions.set(token, user);
    return send(res, 200, {
      token, user,
      role: user.role,
      isStaff: ["franchise_owner", "admin", "superadmin"].includes(user.role),
    });
  }

  if (req.method === "POST" && path === "/api/auth/sign-out") {
    const m = /^Bearer\s+(.+)$/.exec(req.headers.authorization || "");
    if (m) sessions.delete(m[1]);
    return send(res, 200, { ok: true });
  }

  /* ---------- public reference data (menu / branches / milestones) ---------- */
  if (req.method === "GET" && path === "/api/menu") {
    const { rows } = await pool.query(
      `select id, name, group_id, price, sub, story, img from menu_item`);
    return send(res, 200, { items: rows.map(r => ({
      id: r.id, name: r.name, group_id: r.group_id, price: num(r.price),
      sub: r.sub || "", story: r.story || "", img: r.img || "",
    })) });
  }

  if (req.method === "GET" && path === "/api/branches") {
    const { rows } = await pool.query(
      `select id, name, kind, area, location as "where", phone, note,
              close_time as "close"
         from branch`);
    return send(res, 200, { items: rows.map(r => ({
      id: r.id, name: r.name, kind: r.kind, area: r.area || "",
      where: r.where || "", close: r.close || "", phone: r.phone || "", note: r.note || "",
    })) });
  }

  if (req.method === "GET" && path === "/api/milestones") {
    const { rows } = await pool.query(
      `select id, kicker, title, text, pts, sort_order as "order"
         from milestone order by sort_order`);
    return send(res, 200, { items: rows.map(r => ({
      id: r.id, kicker: r.kicker || "", title: r.title, text: r.text || "",
      pts: num(r.pts), order: num(r.order),
    })) });
  }

  /* ---------- live dish stock (public read, session-gated reserve) ----------
     Counters keyed by menu_item.name × branch.name — the app's join keys.
     Reserve is a single atomic conditional UPDATE, so two concurrent
     reserves can never both take the last unit. */
  if (req.method === "GET" && path === "/api/stock") {
    const { rows } = await pool.query(
      `select dish, branch, qty from dish_stock order by dish, branch`);
    return send(res, 200, { items: rows.map(r => ({
      dish: r.dish, branch: r.branch, qty: num(r.qty),
    })) });
  }

  if (req.method === "POST" && path === "/api/stock/reserve") {
    const s = sessionOf(req);
    if (!s) return fail(res, 401, "Sign in to reserve.");
    const b = await readBody(req);
    if (!b.dish || !b.branch) return fail(res, 400, "dish and branch are required.");
    const { rows } = await pool.query(
      `update dish_stock set qty = qty - 1, updated = now()
         where dish = $1 and branch = $2 and qty > 0
         returning qty`, [String(b.dish), String(b.branch)]);
    if (!rows.length) return fail(res, 409, "Sold out — none left at this counter.");
    return send(res, 200, { ok: true, dish: b.dish, branch: b.branch, qty: num(rows[0].qty) });
  }

  if (req.method === "POST" && path === "/api/stock/restock") {
    const s = sessionOf(req);
    if (!s) return fail(res, 401, "Sign in first.");
    if (!["franchise_owner", "admin", "superadmin"].includes(s.role))
      return fail(res, 403, "Staff only.");
    const b = await readBody(req);
    if (b.all) {                       // reset every counter to its seed qty
      await pool.query(`update dish_stock set qty = seed_qty, updated = now()`);
      return send(res, 200, { ok: true, all: true });
    }
    if (!b.dish || !b.branch) return fail(res, 400, "dish and branch (or all:true) are required.");
    const qty = Math.max(0, Math.floor(Number(b.qty) || 0));
    await pool.query(
      `insert into dish_stock (dish, branch, qty, seed_qty) values ($1, $2, $3, $3)
         on conflict (dish, branch) do update
           set qty = excluded.qty, seed_qty = excluded.seed_qty, updated = now()`,
      [String(b.dish), String(b.branch), qty]);
    return send(res, 200, { ok: true, dish: b.dish, branch: b.branch, qty });
  }

  /* ---------- coupons (public read; the brand's ledger) ---------- */
  if (req.method === "GET" && path.startsWith("/api/coupons/")) {
    const code = decodeURIComponent(path.slice("/api/coupons/".length));
    const { rows } = await pool.query(
      `select * from coupon where upper(code) = upper($1) limit 1`, [code]);
    return rows[0] ? send(res, 200, couponOut(rows[0])) : fail(res, 404, "Coupon not found.");
  }

  /* ---------- promotions (the portal workflow) ---------- */
  if (req.method === "GET" && path === "/api/promos") {
    const { rows } = await pool.query(
      `select * from promotion order by created_ms desc nulls last`);
    return send(res, 200, { items: rows.map(promoOut) });
  }

  if (req.method === "POST" && path === "/api/promos") {
    const s = sessionOf(req);
    if (!s) return fail(res, 401, "Sign in first.");
    const b = await readBody(req);
    const id = newId();
    await pool.query(
      `insert into promotion
         (id, title, body, type, status, branch, author, coupon_code,
          cta_label, cta_url, send_count, created_ms, reviewed_at_ms, when_note)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,$11,0,$12)`,
      [id, b.title || "", b.body || "", b.type || "offer", b.status || "pending",
       b.branch || "", s.id, b.couponCode || "", b.ctaLabel || "", b.ctaUrl || "",
       num(b.created) || Date.now(), b.when || ""]);
    const { rows } = await pool.query(`select * from promotion where id = $1`, [id]);
    return send(res, 200, promoOut(rows[0]));
  }

  if (req.method === "PATCH" && path.startsWith("/api/promos/")) {
    const s = sessionOf(req);
    if (!s) return fail(res, 401, "Sign in first.");
    const id = decodeURIComponent(path.slice("/api/promos/".length));
    const b = await readBody(req);
    const allowed = {
      title: "title", body: "body", type: "type", status: "status", branch: "branch",
      couponCode: "coupon_code", ctaLabel: "cta_label", ctaUrl: "cta_url",
      when: "when_note", reviewNote: "review_note", approver: "approver",
      sendCount: "send_count", sentAt: "sent_at_ms", reviewedAt: "reviewed_at_ms",
      created: "created_ms",
    };
    const sets = [], vals = [];
    for (const [k, col] of Object.entries(allowed)) {
      if (b[k] === undefined) continue;
      vals.push(col.endsWith("_ms") || col === "send_count" ? num(b[k]) : b[k]);
      sets.push(`${col} = $${vals.length}`);
    }
    if (!sets.length) return fail(res, 400, "Nothing to update.");
    vals.push(id);
    const { rowCount } = await pool.query(
      `update promotion set ${sets.join(", ")} where id = $${vals.length}`, vals);
    if (!rowCount) return fail(res, 404, "Promotion not found.");
    const { rows } = await pool.query(`select * from promotion where id = $1`, [id]);
    return send(res, 200, promoOut(rows[0]));
  }

  /* ---------- per-user state (the whole owner-scoped store blob) ---------- */
  if (path === "/api/state") {
    const s = sessionOf(req);
    if (!s) return fail(res, 401, "Sign in first.");
    if (req.method === "GET") {
      const { rows } = await pool.query(
        `select data from user_state where owner = $1`, [s.id]);
      return send(res, 200, { data: rows[0]?.data ?? null });
    }
    if (req.method === "PUT") {
      const b = await readBody(req);
      if (typeof b !== "object" || b === null) return fail(res, 400, "Body must be a JSON object.");
      await pool.query(
        `insert into user_state (id, owner, data, updated)
         values ($1, $2, $3, now())
         on conflict (owner) do update set data = excluded.data, updated = now()`,
        [newId(), s.id, b]);
      return send(res, 200, { data: b });
    }
  }

  /* ---------- per-user loyalty (points / lifetime / history) ---------- */
  if (path === "/api/loyalty") {
    const s = sessionOf(req);
    if (!s) return fail(res, 401, "Sign in first.");
    if (req.method === "GET") {
      const { rows } = await pool.query(
        `select points, lifetime, history from loyalty where owner = $1`, [s.id]);
      const r = rows[0];
      return send(res, 200, r
        ? { points: num(r.points), lifetime: num(r.lifetime),
            history: Array.isArray(r.history) ? r.history : [] }
        : { points: 0, lifetime: 0, history: [] });
    }
    if (req.method === "PUT") {
      const b = await readBody(req);
      // NB: JSON.stringify explicitly — node-postgres turns a bare JS array
      // into a Postgres array literal ("{...}"), which is NOT valid jsonb
      // (non-empty arrays 500; empty ones silently corrupt the column to {}).
      const historyJson = JSON.stringify(Array.isArray(b.history) ? b.history : []);
      await pool.query(
        `insert into loyalty (id, owner, points, lifetime, history)
         values ($1, $2, $3, $4, $5::jsonb)
         on conflict (owner) do update
           set points = excluded.points, lifetime = excluded.lifetime,
               history = excluded.history`,
        [newId(), s.id, num(b.points), num(b.lifetime), historyJson]);
      return send(res, 200, { points: num(b.points), lifetime: num(b.lifetime), history: b.history || [] });
    }
  }

  /* ---------- journal: the built blog's static files (incl. /rss.xml) ---------- */
  if (req.method === "GET" && path !== "/api" && !path.startsWith("/api/")) {
    if (serveBlog(res, path)) return;
  }

  return fail(res, 404, "Not found.");
}

http.createServer((req, res) => {
  route(req, res).catch((e) => {
    console.error("[naeki-api]", req.method, req.url, e.message);
    try { fail(res, 500, "Server error."); } catch {}
  });
}).listen(PORT, HOST, () => {
  console.log(`[naeki-api] up at http://${HOST}:${PORT} (Neon neondb)`);
});

process.on("unhandledRejection", (e) => console.error("[naeki-api] unhandled:", e));