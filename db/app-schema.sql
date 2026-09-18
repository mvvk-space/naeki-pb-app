-- Naeki app data on Neon Postgres (neondb) — moved from PocketBase (pb_data/data.db).
--
-- The kanban (board_column / card / card_event) already lives in this database;
-- these are the app's business tables. PocketBase record ids are kept as-is so
-- the data stays addressable during the cutover.
--
-- Column renames vs PocketBase (PG reserves / cleaner names):
--   milestone.order                        -> sort_order
--   promotion.'when' / notify_request.'when' -> when_note
--     (display text like 'Fri 11:30–14:00', not an epoch — despite the name)
--   branch.'where'                         -> location
--   branch.close                           -> close_time   (text in PB, kept text)
--   users.password                         -> password_hash (bcrypt; PB-compatible
--                                            auth = bcrypt(password) + token_key)
--   users.tokenKey / emailVisibility       -> token_key / email_visibility
--   coupon.branchId                        -> branch_id     (holds a branch NAME, not a PB relation id — plain text, no FK)
--
-- Millisecond epochs (PB numeric ms) are kept raw in <col>_ms and also exposed
-- as real timestamptz in <col> (0 ms -> NULL, epoch never meant "1969").
-- JSON blobs come across as jsonb.
--
-- PB system tables (_superusers, _params, _authOrigins, _mfas, ...) are NOT
-- moved: they are PocketBase-internal. pb_data/ stays in the repo as the
-- source of truth until the app is cut over to Postgres.
--
-- Apply:  psql "$(cat ~/.config/neon/naeki-sushi.dsn)" -v ON_ERROR_STOP=1 \
--           -f db/app-schema.sql -f db/app-data.sql
-- Idempotent DDL; the data file is one transaction of plain inserts.

begin;

create table if not exists users (
  id               text primary key,
  email            text not null unique,
  email_visibility boolean not null default false,
  verified         boolean not null default false,
  name             text,
  role             text not null default 'customer',
  branch_id        text,
  password_hash    text not null,
  token_key        text not null,
  created          timestamptz not null,
  updated          timestamptz not null
);

create table if not exists branch (
  id         text primary key,
  name       text not null,
  kind       text not null,                -- flagship | go
  area       text,
  location   text,
  phone      text,
  note       text,
  close_time text
);

create table if not exists menu_item (
  id       text primary key,
  name     text not null,
  group_id text not null,                -- onigiri | nigiri | don | ...
  price    numeric(10,2) not null,
  sub      text,
  story    text,
  img      text
);
create index if not exists menu_item_group_idx on menu_item (group_id);

create table if not exists milestone (
  id         text primary key,
  title      text not null,
  text       text,
  kicker     text,
  pts        numeric not null default 0,
  sort_order int not null default 0
);

create table if not exists coupon (
  id             text primary key,
  code           text not null unique,
  title          text not null,
  type           text not null,          -- percent | fixed_baht | free_item
  brand          text,
  branch_id      text,
  value          numeric not null default 0,
  min_spend      numeric not null default 0,
  usage_limit    numeric,
  used_count     numeric not null default 0,
  starts_at      timestamptz,
  starts_at_ms   bigint,
  expires_at     timestamptz,
  expires_at_ms  bigint,
  free_item      text,
  description    text,
  active         boolean not null default true
);
create index if not exists coupon_active_idx on coupon (active);

create table if not exists promotion (
  id              text primary key,
  title           text not null,
  body            text,
  type            text not null default 'offer',
  status          text not null default 'draft',   -- draft|pending|approved|returned|sent
  branch          text,
  author          text,
  approver        text,
  coupon_code     text,
  cta_label       text,
  cta_url         text,
  send_count      numeric not null default 0,
  sent_at         timestamptz,
  sent_at_ms      bigint,
  created         timestamptz default now(),
  created_ms      bigint,
  reviewed_at     timestamptz,
  reviewed_at_ms  bigint,
  review_note     text,
  when_note       text
);
create index if not exists promotion_status_idx on promotion (status);

create table if not exists notify_request (
  id          text primary key,
  title       text not null,
  body        text,
  type        text not null default 'offer',
  audience    text,
  branch      text,
  status      text not null default 'pending',
  cta_label   text,
  cta_url     text,
  created     timestamptz default now(),
  created_ms  bigint,
  when_note   text,
  author      text
);
create index if not exists notify_request_status_idx on notify_request (status);

-- converge: earlier draft of this file named the display-text columns
-- when_ts/when_ms; they hold 'Fri 11:30–14:00'-style text, not epochs.
alter table promotion drop column if exists when_ts;
alter table promotion drop column if exists when_ms;
alter table promotion add column if not exists when_note text;
alter table notify_request drop column if exists when_ts;
alter table notify_request drop column if exists when_ms;
alter table notify_request add column if not exists when_note text;

create table if not exists franchise_draft (
  id     text primary key,
  title  text not null,
  body   text,
  branch text,
  author text,
  tag    text,
  status text not null default 'draft'
);

create table if not exists loyalty (
  id       text primary key,
  owner    text not null unique references users(id),
  points   numeric not null default 0,
  lifetime numeric not null default 0,
  history  jsonb not null default '[]'::jsonb
);

create table if not exists user_state (
  id      text primary key,
  owner   text not null unique references users(id),
  data    jsonb not null default '{}'::jsonb,
  updated timestamptz not null default now()
);

-- live per-dish-per-branch counters ("2 salmon left at Asok"). Keys are the
-- app's join keys: menu_item.NAME and branch.NAME (text, no FKs — same
-- convention as coupon.branch_id). seed_qty is the restock target used by
-- POST /api/stock/restock {all:true}; db/stock-data.sql re-seeds it too.
create table if not exists dish_stock (
  dish     text not null,
  branch   text not null,
  qty      int not null default 0 check (qty >= 0),
  seed_qty int not null default 0,
  updated  timestamptz not null default now(),
  primary key (dish, branch)
);

commit;