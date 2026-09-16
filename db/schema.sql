-- Naeki kanban, on Neon Postgres.
--
-- Design rules that matter for agent use:
--   * one row per card; agents move a card with an UPDATE, not a file rewrite
--   * every column transition lands in card_event automatically (trigger) —
--     a git diff can show a file changed, it cannot show who moved what
--   * board_index is the token-cheap projection agents read to pick work
--   * card_move() is the one-verb transition an agent calls
--
-- Apply:  psql "$(cat ~/.config/neon/naeki-sushi.dsn)" -f db/schema.sql
-- Idempotent: safe to re-run.
--
-- Four columns: inbox / prog / notnow / done.
-- The earlier 8-column HTML board folded in as:
--   triage -> inbox | icebox, backlog, ready, review, archive -> notnow
-- scripts/board-import.mjs holds that mapping and is the one-time importer.

create extension if not exists pgcrypto;

/* ---------- workflow stages as data, not hardcoded in a file ---------- */
create table if not exists board_column (
  id       text primary key,             -- inbox / prog / notnow / done
  num      text not null,                -- !! / 00 / 01 ...
  name     text not null,
  hint     text,
  position int  not null,
  wip      boolean not null default false   -- "being worked now" column
);

/* ---------- cards ---------- */
create table if not exists card (
  id         text primary key,           -- stable human key: T-1, E1-1, U-3
  title      text not null,
  col_id     text not null references board_column(id),
  pri        text not null default 'P2' check (pri in ('P0','P1','P2','P3')),
  est        text check (est in ('S','M','L')),
  state      text not null default 'reported' check (state in ('reported','probed','audited','fixed')),
  why        text,                       -- why it matters / the finding
  verified   text,                       -- the evidence that it is real
  resolves   text[] not null default '{}',
  done_steps text[] not null default '{}',
  files      text[] not null default '{}',
  deps       text[] not null default '{}',
  position   int  not null default 0,    -- order within the column
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists card_col_idx  on card (col_id, position);
create index if not exists card_pri_idx  on card (pri);

/* ---------- the audit trail ---------- */
create table if not exists card_event (
  id       bigserial primary key,
  card_id  text not null references card(id) on delete cascade,
  from_col text,
  to_col   text,
  actor    text not null default 'agent',
  note     text,
  at       timestamptz not null default now()
);

create index if not exists card_event_card_idx on card_event (card_id, at desc);

/* ---------- history written by the DB, not by the caller ---------- */
create or replace function card_touch() returns trigger as $$
declare who text;
begin
  new.updated_at := now();
  who := nullif(current_setting('app.actor', true), '');
  if new.col_id is distinct from old.col_id and who is not null then
    insert into card_event (card_id, from_col, to_col, actor)
    values (new.id, old.col_id, new.col_id, who);
  end if;
  return new;
end $$ language plpgsql;

drop trigger if exists card_touch_trg on card;
create trigger card_touch_trg before update on card
  for each row execute function card_touch();

/* ---------- the cheap projection agents read to choose work ---------- */
create or replace view board_index as
select c.id, c.col_id as col, c.pri, c.title, c.est, c.state,
       bc.position as col_position, c.position
from card c
join board_column bc on bc.id = c.col_id
order by bc.position, c.position, c.id;

/* ---------- one row per column with counts, for a fast status glance ---------- */
create or replace view board_status as
select bc.id, bc.num, bc.name, bc.position,
       count(c.id) as cards,
       count(*) filter (where c.pri = 'P0') as p0
from board_column bc
left join card c on c.col_id = bc.id
group by bc.id, bc.num, bc.name, bc.position
order by bc.position;

/* ---------- the single transition verb ---------- */
create or replace function card_move(p_id text, p_col text, p_actor text default 'agent',
                                     p_note text default null)
returns card as $$
declare r card;
begin
  if p_actor is not null then
    perform set_config('app.actor', p_actor, true);
  end if;
  update card
     set col_id = p_col,
         position = coalesce((select max(position) from card where col_id = p_col), 0) + 1
   where id = p_id
  returning * into r;
  if r.id is null then
    raise exception 'no card with id %', p_id;
  end if;
  if p_note is not null then
    insert into card_event (card_id, from_col, to_col, actor, note)
    values (r.id, r.col_id, r.col_id, p_actor, p_note);
  end if;
  return r;
end $$ language plpgsql;

/* ---------- seed the workflow (idempotent) ---------- */
insert into board_column (id, num, name, hint, position, wip) values
  ('inbox',  '01', 'Inbox',       'dumped here, needs a look',              0, false),
  ('prog',   '02', 'In progress', 'being built now',                        1, true),
  ('notnow', '03', 'Not now',     'parked — not this week, maybe later',    2, false),
  ('done',   '04', 'Done',        'probe failed to exploit — verified fixed', 3, false)
on conflict (id) do update
  set num = excluded.num, name = excluded.name,
      hint = excluded.hint, position = excluded.position, wip = excluded.wip;
