#!/usr/bin/env node
/* Regenerate db/board.html from Neon.
   Queries the DB and injects the rows into the template's DATA/HISTORY slots,
   so the HTML is a build artifact — never hand-edited, never a second source
   of truth.  Usage: node scripts/board-render.mjs
*/
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url);
const TEMPLATE = new URL("../db/board-template.html", import.meta.url);
const OUT = new URL("../db/board.html", import.meta.url);
const DSN = process.env.NAEKI_DSN || readFileSync(join(homedir(), ".config/neon/naeki-sushi.dsn"), "utf8").trim();

const psql = (sql) => execFileSync("psql",
  ["--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-A", "-t", DSN, "-c", sql], { encoding: "utf8" });

/* json_agg so Postgres does the serialising — no hand-rolled escaping */
const cards = JSON.parse(psql(`select coalesce(json_agg(row_to_json(t)), '[]') from (
  select id, col_id as col, pri, title, est, state, why, verified,
         resolves, done_steps, files, deps, position
  from card order by col_id, position, id) t`));

const events = JSON.parse(psql(`select coalesce(json_agg(row_to_json(t)), '[]') from (
  select card_id, from_col, to_col, actor, note, to_char(at,'YYYY-MM-DD"T"HH24:MI:SS') as at
  from card_event order by at asc) t`));

const history = {};
for (const e of events) (history[e.card_id] ||= []).push(e);

let html = readFileSync(TEMPLATE, "utf8");
html = html.replace("/*__DATA__*/", `const DATA = ${JSON.stringify(cards)};`)
           .replace("/*__HISTORY__*/", `const HISTORY = ${JSON.stringify(history)};`)
           .replace("/*__SRC__*/", `const SRC = ${JSON.stringify(`neon:${process.env.NEON_PROJECT || "naeki-sushi"} · rendered ${new Date().toISOString().slice(0,16).replace("T"," ")}`)};`);
writeFileSync(OUT, html);
console.log(`rendered db/board.html — ${cards.length} cards, ${events.length} events`);
