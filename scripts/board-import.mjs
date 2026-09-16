#!/usr/bin/env node
/* One-time import: roadmap-board.html CARDS -> Neon.
   The eval reads a JS object literal the repo already trusts; it is a local
   build input, not network content.
   Usage: node scripts/board-import.mjs [--dry]
*/
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DSN = process.env.NAEKI_DSN || readFileSync(join(homedir(), ".config/neon/naeki-sushi.dsn"), "utf8").trim();
const SRC = new URL("../roadmap-board.html", import.meta.url);
const html = readFileSync(SRC, "utf8");

const i = html.indexOf("const CARDS = [");
if (i < 0) throw new Error("CARDS not found in roadmap-board.html");
const j = html.indexOf("\n];", i);
const cards = eval(html.slice(i + "const CARDS = ".length, j + 2));

/* the legacy board's 8 columns folded into the four we actually use */
const COL_MAP = { triage:"inbox", icebox:"notnow", backlog:"notnow", ready:"notnow",
                  prog:"prog", review:"notnow", done:"done", archive:"notnow" };
const cols = new Set(Object.values(COL_MAP));
const arr = (a) => a && a.length ? "array[" + a.map((s) => "'" + String(s).replace(/'/g, "''") + "'").join(",") + "]" : "'{}'";
const txt = (s) => s == null || s === "" ? "null" : "'" + String(s).replace(/'/g, "''") + "'";

const rows = cards.map((c, n) => {
  const col = COL_MAP[c.col];
  if (!col) throw new Error(`card ${c.id}: unmapped column "${c.col}"`);
  return `(${[txt(c.id), txt(c.title), txt(col), txt(c.pri || "P2"), txt(c.est),
    txt(c.status), txt(c.why), txt(c.verified), arr(c.resolves), arr(c.done), arr(c.files), arr(c.deps), n].join(",")})`;
});

const data = rows.join(",\n");
const SQL = `
begin;
create temp table _imp (id text, title text, col_id text, pri text, est text,
  state text, why text, verified text, resolves text[], done_steps text[], files text[], deps text[], n int) on commit drop;
insert into _imp values ${data};

insert into card (id,title,col_id,pri,est,state,why,verified,resolves,done_steps,files,deps,position)
select id,title,col_id,pri,est,
       case when state in ('reported','probed','audited','fixed') then state else 'reported' end,
       why,verified,resolves,done_steps,files,deps,
       row_number() over (partition by col_id order by pri, n)
from _imp
on conflict (id) do update set title=excluded.title,
  col_id=excluded.col_id, pri=excluded.pri, est=excluded.est, why=excluded.why,
  verified=excluded.verified, resolves=excluded.resolves, done_steps=excluded.done_steps,
  files=excluded.files, deps=excluded.deps;
commit;
`;
if (process.argv.includes("--dry")) { console.log(`would import ${cards.length} cards`); process.exit(0); }
const r = execFileSync("psql", ["--no-psqlrc", "-v", "ON_ERROR_STOP=1", DSN, "-c", SQL], { encoding: "utf8" });
console.log(r.trim());
console.log(`imported ${cards.length} cards`);
