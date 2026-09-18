#!/usr/bin/env node
/* NAEKI-API — the app's thin HTTP API over Neon Postgres, now TS + Drizzle.
   Port of server/api.mjs (same routes, same wire shapes) so the renderer,
   CSP and e2e suites keep working unchanged.

   Deliberately THIN (solo dev, pre-production): the UI is trusted, the
   server stores what it is sent, passwords verify against bcrypt hashes
   via pgcrypto, sessions are in-memory (restart → sign in again), and
   there is no per-role server enforcement beyond requiring a session
   for user-scoped routes.

   Connection: $NAEKI_DSN, else ~/.config/neon/naeki-sushi.dsn (chmod 600).
   Standalone (Node ≥22.18 runs TS natively):  node server/api.ts
   Electron: main bundles this to out/main/api.js and spawns it with
             ELECTRON_RUN_AS_NODE=1 (no system Node needed when packaged). */

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import { homedir } from "node:os";
import { join } from "node:path";
import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as t from "../db/schema.ts";

const PORT = Number(process.env.NAEKI_API_PORT || 8090);
const HOST = "127.0.0.1";
const DSN_FILE = join(homedir(), ".config", "neon", "naeki-sushi.dsn");

function dsn(): string | null {
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
const db = drizzle(pool, { schema: t });
const sessions = new Map<string, { id: string; email: string; name: string; role: string; branchId: string }>(); // token -> user
const newId = () => randomBytes(8).toString("hex");

/* ---------------- helpers ---------------- */
const num = (v: unknown): number => (v == null || v === "" ? 0 : Number(v));

function send(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(data));
}
const fail = (res: http.ServerResponse, status: number, message: string) => send(res, status, { message });

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let buf = "";
    req.on("data", (c) => {
      buf += c;
      if (buf.length > 5e6) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(buf ? JSON.parse(buf) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function sessionOf(req: http.IncomingMessage) {
  const m = /^Bearer\s+(.+)$/.exec(req.headers.authorization || "");
  return m ? sessions.get(m[1]) || null : null;
}

/* ---------------- row mappers (DB -> UI camelCase) ---------------- */
const userOut = (r: { id: string; email: string; name: string | null; role: string; branchId: string | null }) => ({
  id: r.id,
  email: r.email,
  name: r.name || "",
  role: (r.role || "customer").toLowerCase(),
  branchId: r.branchId || "",
});
const couponOut = (r: typeof t.coupon.$inferSelect) => ({
  id: r.id, code: r.code, title: r.title, type: r.type, brand: r.brand || "",
  branchId: r.branchId || "", value: num(r.value), minSpend: num(r.minSpend),
  usageLimit: num(r.usageLimit), usedCount: num(r.usedCount),
  freeItem: r.freeItem || "", description: r.description || "",
  active: r.active, startsAt: num(r.startsAtMs), expiresAt: num(r.expiresAtMs),
});
const promoOut = (r: typeof t.promotion.$inferSelect) => ({
  id: r.id, title: r.title, body: r.body, type: r.type, status: r.status,
  branch: r.branch, author: r.author, approver: r.approver,
  couponCode: r.couponCode || "", ctaLabel: r.ctaLabel || "", ctaUrl: r.ctaUrl || "",
  when: r.whenNote || "", sendCount: num(r.sendCount), sentAt: num(r.sentAtMs),
  created: num(r.createdMs), reviewedAt: num(r.reviewedAtMs), reviewNote: r.reviewNote || "",
});

/* ---------------- routes ---------------- */
async function route(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const u = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  const path = u.pathname;

  if (req.method === "OPTIONS") return send(res, 204, {});

  /* health — same shape the old PB health endpoint returned */
  if (req.method === "GET" && path === "/api/health")
    return send(res, 200, { message: "API is healthy.", code: 200 });

  /* ---------- auth ---------- */
  if (req.method === "POST" && path === "/api/auth/sign-in") {
    const b = await readBody(req);
    if (!b.email || !b.password) return fail(res, 400, "Email and password are required.");
    const rows = await db
      .select({
        id: t.users.id,
        email: t.users.email,
        name: t.users.name,
        role: t.users.role,
        branchId: t.users.branchId,
        ok: sql<boolean>`crypt(${String(b.password)}, ${t.users.passwordHash}) = ${t.users.passwordHash}`,
      })
      .from(t.users)
      .where(sql`lower(${t.users.email}) = lower(${String(b.email)})`);
    const row = rows[0];
    if (!row || !row.ok) return fail(res, 400, "Incorrect email or password.");
    const user = userOut(row);
    const token = randomBytes(24).toString("hex");
    sessions.set(token, user);
    return send(res, 200, {
      token,
      user,
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
    const rows = await db.select().from(t.menuItem);
    return send(res, 200, {
      items: rows.map((r) => ({
        id: r.id, name: r.name, group_id: r.groupId, price: num(r.price),
        sub: r.sub || "", story: r.story || "", img: r.img || "",
      })),
    });
  }

  if (req.method === "GET" && path === "/api/branches") {
    const rows = await db.select().from(t.branch);
    return send(res, 200, {
      items: rows.map((r) => ({
        id: r.id, name: r.name, kind: r.kind, area: r.area || "",
        where: r.location || "", close: r.closeTime || "", phone: r.phone || "", note: r.note || "",
      })),
    });
  }

  if (req.method === "GET" && path === "/api/milestones") {
    const rows = await db.select().from(t.milestone).orderBy(t.milestone.sortOrder);
    return send(res, 200, {
      items: rows.map((r) => ({
        id: r.id, kicker: r.kicker || "", title: r.title, text: r.text || "",
        pts: num(r.pts), order: num(r.sortOrder),
      })),
    });
  }

  /* ---------- coupons (public read; the brand's ledger) ---------- */
  if (req.method === "GET" && path.startsWith("/api/coupons/")) {
    const code = decodeURIComponent(path.slice("/api/coupons/".length));
    const rows = await db
      .select()
      .from(t.coupon)
      .where(sql`upper(${t.coupon.code}) = upper(${code})`)
      .limit(1);
    return rows[0] ? send(res, 200, couponOut(rows[0])) : fail(res, 404, "Coupon not found.");
  }

  /* ---------- promotions (the portal workflow) ---------- */
  if (req.method === "GET" && path === "/api/promos") {
    const rows = await db.select().from(t.promotion).orderBy(sql`${t.promotion.createdMs} desc nulls last`);
    return send(res, 200, { items: rows.map(promoOut) });
  }

  if (req.method === "POST" && path === "/api/promos") {
    const s = sessionOf(req);
    if (!s) return fail(res, 401, "Sign in first.");
    const b = await readBody(req);
    const id = newId();
    await db.insert(t.promotion).values({
      id,
      title: b.title || "",
      body: b.body || "",
      type: b.type || "offer",
      status: b.status || "pending",
      branch: b.branch || "",
      author: s.id,
      couponCode: b.couponCode || "",
      ctaLabel: b.ctaLabel || "",
      ctaUrl: b.ctaUrl || "",
      createdMs: num(b.created) || Date.now(),
      whenNote: b.when || "",
    });
    const rows = await db.select().from(t.promotion).where(eq(t.promotion.id, id));
    return send(res, 200, promoOut(rows[0]));
  }

  if (req.method === "PATCH" && path.startsWith("/api/promos/")) {
    const s = sessionOf(req);
    if (!s) return fail(res, 401, "Sign in first.");
    const id = decodeURIComponent(path.slice("/api/promos/".length));
    const b = await readBody(req);
    // API camelCase keys -> schema props; numeric-ish fields coerce through num()
    const numeric = new Set(["sendCount", "sentAt", "reviewedAt", "created"]);
    const rename: Record<string, string> = {
      sentAt: "sentAtMs",
      reviewedAt: "reviewedAtMs",
      created: "createdMs",
      when: "whenNote",
    };
    const patch: Record<string, unknown> = {};
    for (const [k, col] of Object.entries({
      title: 1, body: 1, type: 1, status: 1, branch: 1, couponCode: 1,
      ctaLabel: 1, ctaUrl: 1, when: 1, reviewNote: 1, approver: 1,
      sendCount: 1, sentAt: 1, reviewedAt: 1, created: 1,
    })) {
      if (b[k] === undefined) continue;
      const key = rename[k] || k;
      patch[key] = numeric.has(k) ? num(b[k]) : b[k];
    }
    if (!Object.keys(patch).length) return fail(res, 400, "Nothing to update.");
    const updated = await db
      .update(t.promotion)
      .set(patch as Partial<typeof t.promotion.$inferInsert>)
      .where(eq(t.promotion.id, id))
      .returning({ id: t.promotion.id });
    if (!updated.length) return fail(res, 404, "Promotion not found.");
    const rows = await db.select().from(t.promotion).where(eq(t.promotion.id, id));
    return send(res, 200, promoOut(rows[0]));
  }

  /* ---------- per-user state (the whole owner-scoped store blob) ---------- */
  if (path === "/api/state") {
    const s = sessionOf(req);
    if (!s) return fail(res, 401, "Sign in first.");
    if (req.method === "GET") {
      const rows = await db.select({ data: t.userState.data }).from(t.userState).where(eq(t.userState.owner, s.id));
      return send(res, 200, { data: rows[0]?.data ?? null });
    }
    if (req.method === "PUT") {
      const b = await readBody(req);
      if (typeof b !== "object" || b === null) return fail(res, 400, "Body must be a JSON object.");
      await db
        .insert(t.userState)
        .values({ id: newId(), owner: s.id, data: b })
        .onConflictDoUpdate({
          target: t.userState.owner,
          set: { data: b, updated: sql`now()` },
        });
      return send(res, 200, { data: b });
    }
  }

  /* ---------- per-user loyalty (points / lifetime / history) ---------- */
  if (path === "/api/loyalty") {
    const s = sessionOf(req);
    if (!s) return fail(res, 401, "Sign in first.");
    if (req.method === "GET") {
      const rows = await db
        .select({ points: t.loyalty.points, lifetime: t.loyalty.lifetime, history: t.loyalty.history })
        .from(t.loyalty)
        .where(eq(t.loyalty.owner, s.id));
      const r = rows[0];
      return send(res, 200, r
        ? { points: num(r.points), lifetime: num(r.lifetime),
            history: Array.isArray(r.history) ? r.history : [] }
        : { points: 0, lifetime: 0, history: [] });
    }
    if (req.method === "PUT") {
      const b = await readBody(req);
      // drizzle serializes jsonb params itself, so the old node-postgres
      // bare-array pitfall ("{...}" array literal) can't happen here.
      const history = Array.isArray(b.history) ? b.history : [];
      const points = String(num(b.points));
      const lifetime = String(num(b.lifetime));
      await db
        .insert(t.loyalty)
        .values({ id: newId(), owner: s.id, points, lifetime, history })
        .onConflictDoUpdate({
          target: t.loyalty.owner,
          set: { points, lifetime, history },
        });
      return send(res, 200, { points: num(b.points), lifetime: num(b.lifetime), history: b.history || [] });
    }
  }

  return fail(res, 404, "Not found.");
}

http
  .createServer((req, res) => {
    route(req, res).catch((e) => {
      console.error("[naeki-api]", req.method, req.url, (e as Error).message);
      try {
        fail(res, 500, "Server error.");
      } catch {
        // response already gone
      }
    });
  })
  .listen(PORT, HOST, () => {
    console.log(`[naeki-api] up at http://${HOST}:${PORT} (Neon neondb)`);
  });

process.on("unhandledRejection", (e) => console.error("[naeki-api] unhandled:", e));

// silence unused imports if a route stops needing them
void and;
void desc;
void eq;