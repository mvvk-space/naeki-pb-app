/* Drizzle schema for the Naeki app tables on Neon Postgres (neondb).
   Mirrors db/app-schema.sql — the SQL file stays the applied source of
   truth (idempotent DDL via psql) until drizzle-kit takes over migrations;
   this file exists so the ORM has typed tables and drizzle-kit can
   generate/diff going forward. */
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVisibility: boolean('email_visibility').notNull().default(false),
  verified: boolean('verified').notNull().default(false),
  name: text('name'),
  role: text('role').notNull().default('customer'),
  branchId: text('branch_id'),
  passwordHash: text('password_hash').notNull(),
  tokenKey: text('token_key').notNull(),
  created: timestamp('created', { withTimezone: true }).notNull(),
  updated: timestamp('updated', { withTimezone: true }).notNull(),
})

export const branch = pgTable('branch', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').notNull(), // flagship | go
  area: text('area'),
  location: text('location'),
  phone: text('phone'),
  note: text('note'),
  closeTime: text('close_time'), // display text, kept text from PocketBase
})

export const menuItem = pgTable(
  'menu_item',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    groupId: text('group_id').notNull(), // onigiri | nigiri | don | ...
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    sub: text('sub'),
    story: text('story'),
    img: text('img'),
  },
  (t) => [index('menu_item_group_idx').on(t.groupId)],
)

export const milestone = pgTable('milestone', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  text: text('text'),
  kicker: text('kicker'),
  pts: numeric('pts').notNull().default('0'),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const coupon = pgTable(
  'coupon',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(),
    title: text('title').notNull(),
    type: text('type').notNull(), // percent | fixed_baht | free_item
    brand: text('brand'),
    branchId: text('branch_id'), // holds a branch NAME, not a relation id
    value: numeric('value').notNull().default('0'),
    minSpend: numeric('min_spend').notNull().default('0'),
    usageLimit: numeric('usage_limit'),
    usedCount: numeric('used_count').notNull().default('0'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    startsAtMs: bigint('starts_at_ms', { mode: 'number' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    expiresAtMs: bigint('expires_at_ms', { mode: 'number' }),
    freeItem: text('free_item'),
    description: text('description'),
    active: boolean('active').notNull().default(true),
  },
  (t) => [index('coupon_active_idx').on(t.active)],
)

export const promotion = pgTable(
  'promotion',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    body: text('body'),
    type: text('type').notNull().default('offer'),
    status: text('status').notNull().default('draft'), // draft|pending|approved|returned|sent
    branch: text('branch'),
    author: text('author'),
    approver: text('approver'),
    couponCode: text('coupon_code'),
    ctaLabel: text('cta_label'),
    ctaUrl: text('cta_url'),
    sendCount: numeric('send_count').notNull().default('0'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    sentAtMs: bigint('sent_at_ms', { mode: 'number' }),
    created: timestamp('created', { withTimezone: true }).defaultNow(),
    createdMs: bigint('created_ms', { mode: 'number' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedAtMs: bigint('reviewed_at_ms', { mode: 'number' }),
    reviewNote: text('review_note'),
    whenNote: text('when_note'), // display text like 'Fri 11:30–14:00', not an epoch
  },
  (t) => [index('promotion_status_idx').on(t.status)],
)

export const notifyRequest = pgTable(
  'notify_request',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    body: text('body'),
    type: text('type').notNull().default('offer'),
    audience: text('audience'),
    branch: text('branch'),
    status: text('status').notNull().default('pending'),
    ctaLabel: text('cta_label'),
    ctaUrl: text('cta_url'),
    created: timestamp('created', { withTimezone: true }).defaultNow(),
    createdMs: bigint('created_ms', { mode: 'number' }),
    whenNote: text('when_note'),
    author: text('author'),
  },
  (t) => [index('notify_request_status_idx').on(t.status)],
)

export const franchiseDraft = pgTable('franchise_draft', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  body: text('body'),
  branch: text('branch'),
  author: text('author'),
  tag: text('tag'),
  status: text('status').notNull().default('draft'),
})

export const loyalty = pgTable('loyalty', {
  id: text('id').primaryKey(),
  owner: text('owner')
    .notNull()
    .unique()
    .references(() => users.id),
  points: numeric('points').notNull().default('0'),
  lifetime: numeric('lifetime').notNull().default('0'),
  history: jsonb('history').notNull().default([]),
})

export const userState = pgTable('user_state', {
  id: text('id').primaryKey(),
  owner: text('owner')
    .notNull()
    .unique()
    .references(() => users.id),
  data: jsonb('data').notNull().default({}),
  updated: timestamp('updated', { withTimezone: true }).notNull().defaultNow(),
})