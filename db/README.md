# Naeki board — Neon-backed kanban

The board is a **Postgres database in Neon**, not a file. Agents read a cheap
projection and move cards with a single verb; the DB writes its own audit trail.

    Neon project  naeki-sushi   (purple-base-46144445, aws-ap-southeast-1, PG 18)
    database      neondb        branch main (br-still-sea-b3m1rpp4)

## Credentials

`~/.config/neon/naeki-sushi.dsn` (chmod 600, **not** in the repo).
Override with `$NAEKI_DSN`. Regenerate with:

    neonctl connection-string --project-id purple-base-46144445 \
      --database-name neondb --role-name neondb_owner > ~/.config/neon/naeki-sushi.dsn

## Commands

    node scripts/board.mjs status            four columns + counts (glance)
    node scripts/board.mjs ls [col]          id / col / pri / title — pick work here
    node scripts/board.mjs show <ID>         one card in full
    node scripts/board.mjs move <ID> <col>   transition it (writes card_event)
    node scripts/board.mjs note <ID> "text"  append to the audit trail
    node scripts/board.mjs new <ID> <col> "<title>" --pri=P1 --est=S
    node scripts/board.mjs history [ID]      who moved what, when

Set `BOARD_ACTOR=<name>` so the audit trail names the mover (defaults to `$USER`).

## Columns (four, deliberately)

    inbox  01  dumped here, needs a look
    prog   02  being built now          (the WIP column)
    notnow 03  parked — not this week, maybe later
    done   04  verified fixed

There is no `review`, `ready`, `icebox`, `backlog`, `archive` or `triage`.
The earlier 8-column HTML board folded in as:
`triage → inbox` · `icebox, backlog, ready, review, archive → notnow`.

## Files

    db/schema.sql                 tables, trigger, views, card_move(), column seed
    db/board-template.html        the view's rendering layer (hand-edited)
    db/board.html                 GENERATED — never hand-edit
    scripts/board.mjs             the agent CLI (no data inside it)
    scripts/board-import.mjs      one-time importer from roadmap-board.html
    scripts/board-render.mjs      Neon → db/board.html

    Apply schema   psql "$(cat ~/.config/neon/naeki-sushi.dsn)" -f db/schema.sql
    Re-import      node scripts/board-import.mjs
    Republish view node scripts/board-render.mjs   (then open db/board.html)

Re-running the schema and importer is idempotent.

## Why this beats the HTML file

Measured on this board (tiktoken cl100k):

| action                     | roadmap-board.html | Neon + board.mjs |
|----------------------------|--------------------|------------------|
| glance at the board        | 18,530 (whole file)| 74               |
| pick work in a column      | 188 (grep)         | 80               |
| read one card              | 197 (byte range)   | 316              |
| move a card                | ~590 in + diff back| 6 in / 12 out    |
| who moved it, when         | nothing (git diff) | card_event row   |

The file wins on exactly one row (a single card is 197 tok vs 316) and loses
everywhere else, including the two that matter: no whole-file reads, and a real
audit trail.

## Two traps this schema already handles

* **`card_event` is written by the DB, not the caller** (trigger `card_touch`,
  fires only when `app.actor` is set — i.e. only through `card_move()`). Bulk
  imports and syncs re-position rows without polluting the history.
* **`board_index` is the projection**, not `card`. Selecting `card` pulls the
  prose columns (`why`, `verified`, arrays) and costs ~6x more.

## Not done yet (next agent)

* The board is **read-only as a UI** (`db/board.html` renders, filters and shows
  history; no drag-to-move). Moves go through `board.mjs`.
* `roadmap-board.html` still exists as the frozen legacy view. It is no longer
  the source of truth; delete it once nothing references it.
* No CI check yet that `db/board.html` is in sync with the DB.

(The PocketBase boot-blocker that used to top this list is gone — the app was
cut over to `server/api.mjs` speaking to this Neon database in Sep 2026.)
