/* NAEKI — project-wide type surface (ambient declarations).
   Loaded via `/// <reference path>` from each script + tsconfig "include".
   Describes the three window globals the codebase communicates through —
   NaekiData (data layer), NaekiStore (persistence), NaekiAPI (HTTP client
   for server/api.mjs) — plus the record shapes as created by
   db/app-schema.sql and seeded by db/app-data.sql. Types are checked at
   development time (tsc --noEmit, see tsconfig.json) and erased at runtime;
   the browser never sees this file.

   NOTE on `@ts-ignore`: the app intentionally mutates frozen-in-place
   arrays (MENU.length = 0) so every view re-sources live data without a
   reference swap; ignore markers are scoped to those lines. */

/* ---------- record shapes (Neon tables, db/app-schema.sql) ---------- */

type PBRecord = {
  id: string;
  collectionId: string;
  collectionName: string;
  /** autodate fields exist only where the collection declares them */
  created?: string;
  updated?: string;
};

/** collection `menu_item` (pbc_3011457992) */
type MenuItemRecord = PBRecord & {
  group_id: string;   // menu group key: onigiri | nigiri | rolls | sashimi | don | drinks
  name: string;
  price: number | null;
  sub: string;
  img: string;
  story: string;
};

/** collection `branch` (pbc_2358601297) */
type BranchRecord = PBRecord & {
  name: string;
  kind: string;       // "flagship" (counter) | "go" (kiosk)
  area: string;
  close: string;      // "HH:MM" Bangkok closing time; "" = unknown/open
  phone: string;
  where: string;
  note: string;
};

/** collection `milestone` (pbc_1979069902) */
type MilestoneRecord = PBRecord & {
  id: string;
  kicker: string;
  title: string;
  text: string;
  pts: number | null;
  jp: string;
  order: number | null;
};

/** collection `loyalty` (pbc_3985927804) — per-user loyalty ledger */
type LoyaltyRecord = PBRecord & {
  owner: string;      // users record id
  points: number | null;
  lifetime: number | null;
  history: PurchaseRecord[];
};

/** collection `user_state` (pbc_3219200307) — whole user-owned blob */
type UserStateRecord = PBRecord & {
  owner: string;      // users record id
  data: OwnedState | null;
};

/** collection `coupon` (pbc_1403798092) — public read, admin-only write */
type CouponRecord = PBRecord & {
  code: string;
  title: string;
  description: string;
  type: "fixed_baht" | "percent" | "free_item" | "";
  value: number | null;
  freeItem: string;
  minSpend: number | null;
  startsAt: number | null;    // epoch-ms
  expiresAt: number | null;   // epoch-ms
  usageLimit: number | null;
  usedCount: number | null;
  branchId: string;   // branch NAME (data-layer key), not a pb relation
  brand: string;      // "go" | "sushi" | ""
  active: boolean;
};

/** collection `promotion` (pbc_2771819337) — approval workflow.
    `created` is a client-set epoch-ms number here (no autodate field). */
type PromotionRecord = Omit<PBRecord, "created"> & {
  author: string;
  branch: string;     // branch NAME (data-layer key)
  type: "offer" | "event" | "update" | "";
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  audience: "everyone" | "members" | "";
  when: string;
  status: "draft" | "pending" | "approved" | "rejected" | "sent" | "";
  approver: string;
  reviewNote: string;
  reviewedAt: number | null;
  sentAt: number | null;
  created: number | null;     // epoch-ms (set client-side at compose time)
  couponCode: string;
  sendCount: number | null;
};

/** collection `notify_request` (pbc_1044675478) — cross-account notifications */
type NotifyRequestRecord = Omit<PBRecord, "created"> & {
  author: string;
  branch: string;     // branch NAME (data-layer key)
  type: ("offer" | "event" | "update") | "";
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  audience: "everyone" | "members" | "";
  when: string;
  status: "draft" | "pending" | "approved" | "";
  created: number | null;
};

/** users auth record (role drives portal access) */
type UsersRecord = PBRecord & {
  email: string;
  name: string;
  role: string;       // "franchise_owner" | "admin" | "superadmin" | "customer"
  branch_id: string;
};

/* ---------- data-layer shapes (data.js) ---------- */

type BrandId = "sushi" | "go";

type Brand = {
  id: BrandId;
  name: string;
  short: string;
  tag: string;
  jp: string;
  desc: string;
};

type MenuItem = {
  name: string;
  price: number;
  sub: string;
  img: string;
  story?: string;
};

type MenuGroup = {
  id: string;
  brand?: BrandId;
  name: string;
  jp: string;
  desc: string;
  items: MenuItem[];
};

type Branch = {
  name: string;
  kind: "flagship" | "go";
  area: string;
  where: string;
  close: string | null;   // "HH:MM"; null = unknown → treated as open
  phone?: string;
  note?: string;
};

type Review = { text: string; src: string };

/** INFO block in data.js — brand facts + contact points */
type BrandInfo = {
  brand: string;
  tagline: string;
  founded: number;
  foundedNote: string;
  flagshipRating: string;
  flagshipReviews: string;
  line: string;
  lineUrl: string;
  instagram: string;
  tiktok: string;
  facebook: string;
  hq: string;
  hqAddress: string;
  officePhone: string;
  officeEmail: string;
  site: string;
};

type OrderCard = {
  kicker: string;
  title: string;
  text: string;
  links?: { label: string; url: string; accent: boolean }[];
  socials?: [string, string][];
};

type ChatRoute = { topic: string; icon: string; prompt: string };

type Offer = {
  kicker: string;
  title: string;
  text: string;
  tag: string;
  personal: boolean;
  live?: boolean;
  branchOffer?: boolean;
  branchId?: string;
  sentAt?: number;
  sendCount?: number;
  uid?: string;
  notifType?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  when?: string;
};

type PurchaseRecord = {
  ts: number;
  total: number;
  count: number;
  category: string | null;
  couponCode?: string | null;
  lines: { name: string; qty: number; price: number }[];
};

type Milestone = {
  id: string;
  kicker: string;
  title: string;
  text: string;
  pts: number;
  jp: string;
  order?: number;
};

type Tier = {
  id: string;
  name: string;
  jp: string;
  threshold: number;
  blurb: string;
  perk: string;
};

type BangkokTime = { h: number; m: number; s: number; mins: number; str: string };

type Stats = {
  now: BangkokTime;
  branchCount: number;
  openCount: number;
  nextClose: Branch | null;
  dishCount: number;
  categoryCount: number;
  alsoCount: number;
  lastRefreshAt: BangkokTime | null;
};

type AchievementState = {
  done: Record<"first" | "breadth" | "cadence" | "party" | "week" | "friend" | "lifetime", boolean>;
  breadth: number;
  cadence: number;
  week: number;
  lifetime: number;
};

type WeeklyMission = {
  kicker: string;
  title: string;
  text: string;
  have: number;
  need: number;
  live: boolean;
};

type FrameConfig = {
  topics?: string[];
  render: (el: HTMLElement, D: NaekiDataAPI) => void;
};

type Receipt = {
  id: string;
  total: number;
  subtotal: number;
  discount: number;
  count: number;
  ts: number;
  lines: CartLine[];
  category: string | null;
  couponCode: string | null;
  couponDropped: string | null;
  paidByWallet: boolean;
  walletSpent: number;
  pointsEarned: number;
  tier: string;
  newLifetime: number;
};

type CartLine = { name: string; price: number; qty: number; addedAt: number };

type Stamp = { ts: number; note: string };
type Redemption = { ts: number; reward: string; stampCount: number };

type AppliedCoupon = {
  code: string;
  title?: string;
  type: "percent" | "fixed_baht" | "free_item";
  value?: number | null;
  freeItem?: string;
  minSpend?: number | null;
  brand?: string;
  branchId?: string;
  active?: boolean;
  startsAt?: number | null;
  expiresAt?: number | null;
  usageLimit?: number | null;
  usedCount?: number | null;
};

type Profile = {
  name: string;
  email?: string;
  since?: number;
  role?: "staff" | null;
  roleUser?: string;
  branchId?: string;
};

type StampCard = { size: number; stamps: Stamp[]; redemptions: Redemption[] };

type WalletState = {
  balance: number;
  topups: { ts: number; amount: number; method: string; ref: string }[];
  expressPay: "apple" | "google" | null;
  useWallet: boolean;
};

type GiftCard = { code: string; amount: number; ts: number; spent: boolean };

type ChatMsg = { role: "user" | "system"; text: string; topic?: string | null; ts: number };

type FranchiseDraft = {
  id: string;
  branchId: string;
  title: string;
  text: string;
  tag: string;
  status: "draft" | "pending" | "approved";
  submittedAt: number;
};

type PublishedOffer = {
  uid: string;
  branchId: string;
  kicker: string;
  title: string;
  text: string;
  tag: string;
  sentAt: number;
  sendCount: number;
};

/** the store's DEFAULTS shape (store.js) — profile excluded from OwnedState
    (pushed blobs strip it; the profile lives in the users record). */
type OwnedState = Omit<AppState, "profile">;

type AppState = {
  profile: Profile | null;
  card: StampCard;
  cart: CartLine[];
  coupon: AppliedCoupon | null;
  loyalty: { points: number; lifetime: number; history: PurchaseRecord[] };
  wallet: WalletState;
  gifts: GiftCard[];
  claimed: string[];
  referralsRedeemed: number;
  referralCodes: { code: string; created: number }[];
  redeemedRefs: string[];
  chat: { thread: ChatMsg[]; connected: boolean };
  subscribedBranches: string[];
  offerAcks: Record<string, { ts: number; via: string }>;
  franchiseDrafts: FranchiseDraft[];
  publishedOffers: PublishedOffer[];
};

/* ---------- the three window globals ---------- */

/** window.NaekiData — data.js. Single source of truth for business data. */
type NaekiDataAPI = {
  MENU: MenuGroup[];
  ALSO: string[];
  BRANCHES: Branch[];
  REVIEWS: Review[];
  INFO: BrandInfo;
  LANDING: { featuredPool: string[]; featuredCount: number; previewBranches: number };
  BRANDS: Brand[];
  brandGroups: (id: BrandId) => MenuGroup[];
  setBrand: (id: BrandId) => void;
  getBrand: () => Brand | undefined;
  kindsForBrand: (id: BrandId) => ("go" | "flagship")[];
  branchInBrand: (b: Branch, id: BrandId) => boolean;
  subscribe: (topic: string, fn: (payload?: unknown) => void) => void;
  publish: (topic: string, payload?: unknown) => void;
  bangkokParts: () => BangkokTime;
  toMins: (hhmm: string | null) => number | null;
  isOpenNow: (branch: Branch, now?: BangkokTime) => boolean;
  shortName: (b: { name: string }) => string;
  stats: () => Stats;
  featured: (now?: number) => { item: MenuItem; group: MenuGroup }[];
  order: () => OrderCard[];
  branchKicker: (nameOrRecord: string | { name: string }) => string;
  subscriberCountOf: (branchName: string) => number;
  CHAT_ROUTES: ChatRoute[];
  chatTopics: (topicCount?: number) => ChatRoute[];
  POINTS_PER_BAHT: number;
  TIERS: Tier[];
  POINTS_DAY: number;
  POINTS_DAY_NAME: string;
  pointsFor: (total: number, tierMult?: number, dayMult?: number) => number;
  tierMultOf: (tier: { id?: string } | null | undefined) => number;
  tierFor: (points: number) => Tier;
  nextTier: (points: number) => Tier | null;
  offers: (opts?: {
    history?: PurchaseRecord[];
    now?: number;
    subscribedBranches?: string[];
    approvedRequests?: PromotionRecord[];
    publishedOffers?: PublishedOffer[];
  }) => Offer[];
  bangkokWeekday: (ts?: number) => number;
  daysSince: (ts: number, now?: number) => number;
  MILESTONES: Milestone[];
  TRUST: string[];
  streakOf: (history: PurchaseRecord[], now?: number) => { count: number; days: Set<string> };
  categoriesSeen: (history: PurchaseRecord[]) => number;
  ordersThisWeek: (history: PurchaseRecord[], now?: number) => number;
  achievements: (history: PurchaseRecord[], opts?: {
    referralsRedeemed?: number;
    now?: number;
  }) => AchievementState;
  weeklyMission: (history: PurchaseRecord[], now?: number) => WeeklyMission;
  refresh: () => void;
};

/** window.NaekiAPI — api.js. Thin client for server/api.mjs (Neon Postgres). */
type NaekiAPIAPI = {
  BASE: string;
  signIn: (email: string, password: string) => Promise<{
    ok: boolean;
    user?: UsersRecord;
    isStaff?: boolean;
    role?: string;
    error?: string;
  }>;
  signOut: () => Promise<void>;
  me: () => UsersRecord | null;
  getLoyalty: () => Promise<{ points: number; lifetime: number; history: PurchaseRecord[] } | null>;
  upsertLoyalty: (patch: { points: number; lifetime: number; history: PurchaseRecord[] }) => Promise<{ points: number; lifetime: number; history: PurchaseRecord[] } | null>;
  userStateGet: () => Promise<{ data: OwnedState | null } | null>;
  userStateUpsert: (data: OwnedState) => Promise<boolean>;
  couponList: () => Promise<CouponRecord[]>;
  couponByCode: (code: string) => Promise<CouponRecord | null>;
  promoList: (filter?: string) => Promise<PromotionRecord[]>;
  promoCreate: (payload: Partial<PromotionRecord>) => Promise<PromotionRecord | null>;
  promoUpdate: (id: string, patch: Partial<PromotionRecord>) => Promise<PromotionRecord | null>;
};

/** window.NaekiStore — store.js. Persistence + all state mutations. */
type NaekiStoreAPI = {
  get: () => AppState;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; user?: UsersRecord; isStaff?: boolean; error?: string }>;
  signOut: () => Promise<boolean>;
  isStaff: () => boolean;
  persistLoyalty: () => Promise<void>;
  card: () => StampCard;
  addStamp: (note?: string) => boolean;
  redeem: (reward?: string) => Redemption | null;
  reset: () => void;
  resetCard: () => boolean;
  cart: () => CartLine[];
  addToCart: (name: string, price: number) => number;
  setCartQty: (name: string, qty: number) => number;
  checkoutCart: (category?: string | null) => Receipt | null;
  clearCart: () => boolean;
  couponState: () => AppliedCoupon | null;
  setCoupon: (coupon: AppliedCoupon) => AppliedCoupon | null;
  clearCoupon: () => null;
  couponDiscount: (lines: CartLine[]) => number;
  couponProblem: (lines: CartLine[]) => string | null;
  loyalty: () => { points: number; lifetime: number; history: PurchaseRecord[] };
  redeemPoints: (pts: number, label?: string) => { ts: number; points: number; baht: number; label: string } | null;
  onLoyalty: (fn: () => void) => () => void;
  claimedState: () => string[];
  achievementState: (opts?: { referralsRedeemed?: number; now?: number }) => AchievementState;
  claimMilestone: (id: string) => { id: string; pts: number; total: number } | null;
  makeReferral: () => string;
  referralCodesState: () => { code: string; created: number }[];
  redeemReferral: (code: string) => { pts: number; code: string } | null;
  walletState: () => WalletState;
  giftsState: () => GiftCard[];
  setUseWallet: (on: boolean) => boolean;
  setExpressPay: (provider: "apple" | "google") => "apple" | "google" | null;
  topUp: (amount: number, method?: string) => { ts: number; amount: number; method: string; ref: string } | null;
  buyGift: (amount: number, paidFromBalance?: boolean) => GiftCard | null;
  redeemGift: (code: string) => GiftCard | null;
  chatState: () => { thread: ChatMsg[]; connected: boolean };
  chatSend: (text: string, topic?: string) => number | null;
  chatNote: (text: string) => number | null;
  chatConnect: () => boolean;
  chatReset: () => { thread: ChatMsg[]; connected: boolean };
  subscribedBranchesState: () => string[];
  isSubscribed: (branchName: string) => boolean;
  toggleBranchSubscription: (branchName: string) => string[];
  offerAcksState: () => Record<string, { ts: number; via: string }>;
  ackOffer: (key: string, via?: "popup" | "inbox" | "cta") => { ts: number; via: string } | null;
  resetOfferAcks: () => Record<string, { ts: number; via: string }>;
  franchiseDraftsState: () => FranchiseDraft[];
  publishedOffersState: () => PublishedOffer[];
  createDraft: (input: { branchId: string; title: string; text: string; tag?: string }) => FranchiseDraft | null;
  updateDraft: (id: string, patch: { title?: string; text?: string; tag?: string }) => FranchiseDraft | null;
  submitDraft: (id: string) => FranchiseDraft | null;
  reviewDraft: (id: string, decision: "approve" | "return") => PublishedOffer | FranchiseDraft | null;
  deleteDraft: (id: string) => FranchiseDraft[];
};

interface Window {
    NaekiData: NaekiDataAPI;
    NaekiStore: NaekiStoreAPI;
    NaekiAPI: NaekiAPIAPI;
    NaekiAPIReady?: boolean;
    NaekiFrames: { define: (name: string, config: FrameConfig) => void; mount: (root?: ParentNode) => void };
    NAEKI: NaekiDataAPI;   // compat alias in data.js
    /** app.js pollApproved() stash of approved/sent promotions (bell feed) */
    __approvedRequests?: PromotionRecord[];
}