#!/usr/bin/env node
/* Naeki board — the agent CLI.
   No data lives here; Neon is the single source of truth. Every command is a
   thin psql call so there is no dependency to install and nothing to drift.

     node scripts/board.mjs ls [col]        board_index projection (cheap read)
     node scripts/board.mjs status          counts per column
     node scripts/board.mjs show <ID>       one full card
     node scripts/board.mjs move <ID> <col> transition it (writes card_event)
     node scripts/board.mjs note <ID> "..." append a note to the audit trail
     node scripts/board.mjs new <ID> <col> "<title>" [--pri P1] [--est S]
     node scripts/board.mjs history [ID]    who moved what, when

   Connection: $NAEKI_DSN, else ~/.config/neon/naeki-sushi.dsn (chmod 600).
   Actor name for the audit trail: $BOARD_ACTOR, else the OS user.
*/
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DSN_FILE = join(homedir(), ".config/neon/naeki-sushi.dsn");
function dsn() {
  if (process.env.NAEKI_DSN) return process.env.NAEKI_DSN;
  if (existsSync(DSN_FILE)) return readFileSync(DSN_FILE, "utf8").trim();
  console.error("no DSN: set $NAEKI_DSN or write " + DSN_FILE);
  process.exit(2);
}
const ACTOR = process.env.BOARD_ACTOR || process.env.USER || "agent";

/* one place that talks to Postgres — args passed as an array, never a shell string */
function sql(text) {
  const args = ["--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-A", "-F", "\t", "-t", "-q"];
  args.push(dsn(), "-c", text);
  return execFileSync("psql", args, { encoding: "utf8" });
}
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

const COLS = ["inbox","prog","notnow","done"];
const cmds = {
  /* cheap read: id / col / pri / title — the projection an agent picks work from */
  ls(col) {
    const where = col ? `where col = ${q(col)}` : "";
    const rows = sql(`select id||'\t'||col||'\t'||pri||'\t'||title from board_index ${where}`)
      .trimEnd().split("\n").filter(Boolean);
    for (const r of rows) console.log(r);
    if (!rows.length) console.log("(no cards)");
  },
  status() {
    console.log(sql(`select lpad(num,2)||'  '||rpad(name,12)||lpad(cards::text,3)||
      case when p0>0 then '   ('||p0||' P0)' else '' end
      from board_status order by position`).trimEnd());
  },
  show(id) {
    const out = sql(`select 'id:       '||id||E'\\n'||
      'title:    '||title||E'\\n'||
      'column:   '||col_id||'   priority: '||pri||'   est: '||coalesce(est,'-')||'   state: '||state||E'\\n'||
      'deps:     '||coalesce(array_to_string(deps,', '),'-')||E'\\n'||
      case when why is not null then E'\\nwhy:\\n'||why||E'\\n' end||
      case when verified is not null then E'\\nverified:\\n'||verified||E'\\n' end||
      case when array_length(done_steps,1) is not null then E'\\ndone:\\n  - '||array_to_string(done_steps, E'\\n  - ')||E'\\n' end||
      case when array_length(files,1) is not null then E'\\nfiles:\\n  - '||array_to_string(files, E'\\n  - ')||E'\\n' end
      from card where id = ${q(id)}`);
    if (!out.trim()) return console.error("no card " + id);
    console.log(out.trimEnd());
  },
  history(id) {
    const where = id ? `where card_id = ${q(id)}` : "";
    console.log(sql(`select to_char(at,'MM-DD HH24:MI')||'  '||rpad(card_id,8)||
      rpad(coalesce(from_col,'-'),10)||'-> '||rpad(coalesce(to_col,'-'),10)||actor||
      case when note is not null then '  // '||note else '' end
      from card_event ${where} order by at desc limit 40`).trimEnd() || "(no events)");
  },
  move(id, col) {
    if (!COLS.includes(col)) return console.error(`col must be one of: ${COLS.join(" ")}`);
    console.log(sql(`select id||' -> '||col_id||'  ('||pri||') '||title from card_move(${q(id)},${q(col)},${q(ACTOR)})`).trimEnd());
  },
  note(id, ...rest) {
    const text = rest.join(" ");
    if (!text) return console.error('usage: board.mjs note <ID> "text"');
    sql(`insert into card_event (card_id, from_col, to_col, actor, note)
         select id, col_id, col_id, ${q(ACTOR)}, ${q(text)} from card where id = ${q(id)}`);
    console.log(`noted on ${id}`);
  },
  new(id, col, title, flags = {}) {
    sql(`insert into card (id,title,col_id,pri,est)
         values (${q(id)}, ${q(title)}, ${q(col)}, ${q(flags.pri || "P2")}, ${q(flags.est || "M")})`);
    console.log(`created ${id} in ${col}`);
  },
  help() {
    console.log(readFileSync(new URL(import.meta.url)).toString().split("\n").slice(1, 16).join("\n").replace(/^\/? ?\*?/gm, ""));
  },
};

/* flags are pulled from anywhere in argv, so `note X "a --b"`-style text is safe */
const argv = process.argv.slice(2);
const flags = {};
const positional = [];
for (const a of argv) {
  if (a.startsWith("--")) { const [k, v] = a.slice(2).split("="); flags[k] = v ?? true; }
  else positional.push(a);
}
const [cmd, ...args] = positional;
if (!cmd || !cmds[cmd]) { cmds.help(); process.exit(cmd ? 1 : 0); }
try {
  const fn = cmds[cmd];
  /* only the commands whose signature ends in `flags` receive it */
  const takesFlags = new Set(["new"]);
  takesFlags.has(cmd) ? fn(...args, flags) : fn(...args);
} catch (e) { console.error(String(e.stderr || e.message).trim()); process.exit(1); }
