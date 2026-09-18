/// <reference path="./types.d.ts" />
/* NAEKI SHOWCASE — local persistence layer.
   Everything the user creates lives in their own browser storage; nothing
   here ever leaves the device. The shape is deliberately flat and typed so
   the same calls can later be backed by SQLite (Capacitor) or synced to a
   backend without touching any UI code. */
(() => {
  "use strict";

  const KEY = "naeki.showcase.v1";

  /* ---- default state (also documents the data model) ---- */
  const DEFAULTS = {
    // local, on-device only — switches landing/app modes; not an account
    profile: null,              // { name: string, since: epoch-ms, role?: "staff" }
    // demo stamp card — stamps are self-issued, never verified by the brand
    card: {
      size: 10,                 // stamps per reward
      stamps: [],               // [{ ts: epoch-ms, note: string }]
      redemptions: []           // [{ ts: epoch-ms, reward: string }]
    },
    // demo order cart — persists across sessions, never leaves the device;
    // lines reference menu items by name (the data-layer key)
    cart: [],                   // [{ name, price, qty, addedAt }]
    // coupon validated against the coupon table (public read)
    // and applied at checkout. One per order; cleared once used.
    coupon: null,               // { code, title, type, value, freeItem, minSpend, brand, branchId }
    // loyalty: points earned at demo checkout (1 pt / 10฿, tier + day
    // multipliers via NaekiData); lifetime totals drive the tier
    loyalty: {
      points: 0,                // spendable points
      lifetime: 0,             // never decreases — sets the tier
      history: []               // purchase records [{ ts, total, count, category, lines }]
    },
    // demo wallet: stored-value balance (TrueMoney-style top-up + gift
    // codes), all on-device — nothing is transmitted anywhere
    wallet: {
      balance: 0,               // remaining stored value (THB)
      topups: [],               // [{ ts, amount, method, ref }]
      expressPay: null,         // "apple" | "google" once provisioned (one-time, honest demo)
      useWallet: true           // opt-in to pay the wallet balance before cash (per-checkout)
    },
    // demo gift cards the user has "bought" (for themselves / to give away)
    gifts: [],                    // [{ code, amount, ts, spent }]
    // device preference: UI sounds + haptics on add-to-cart / stamps /
    // checkout (NaekiSound). Default ON; flipped via the sidebar toggle.
    sound: true,
    // milestone engine state: which achievement bonuses have been claimed
    // (atomically with the award — persists the exact claim), and how many
    // referral codes the user has redeemed (the "give + get" loop)
    claimed: [],                  // string milestone id, once each
    referralsRedeemed: 0,
    referralCodes: [],            // [{ code, created }] — codes THEY generate to share
    redeemedRefs: [],            // [code, ...] — referral codes already redeemed here
    // demo chat → LINE handoff. The in-app chat is a thin, honest surface
    // that collects intent and passes it to the LINE OA (the channel Naeki
    // actually answers on); it never carries a message beyond a local draft.
    chat: {
      thread: [],                 // [{ role:'user'|'system', text, ts }] — local transcript
      connected: false            // demo flag: user has reached the OA once
    },
    // the user's own branches — picked in the Branches pane as the source of
    // notifications & offers. Local like everything else: these are the
    // branch(es) this device wants to hear from, and the offers engine
    // derives one of its personal offers from exactly this selection.
    subscribedBranches: [],        // branch names (the data-layer key)
    // offer acknowledgements — the bell's memory. A live offer "arrives"
    // (bell dot + popup) until the user acknowledges it (✕ on the popup or
    // ✓ in the inbox); the ack key pins that exact composition, so the same
    // weekly deal returns next week and a "welcome back" nudge can re-fire
    // after it fires anew. Nothing is synced — this ledger is the device's.
    offerAcks: {},                 // { "weekday|kicker|title": { ts, via } }
    // brand-portal work: offers a franchise partner drafts for their own
    // branch, and what's been approved + published. Local and honest like
    // everything else — the portal is a demo of the send flow, and "sent to
    // N subscribers" is a seeded number (see data.js SUBSCRIBERS), because
    // there's no server-side fan-out here. A published offer reaches this
    // device's Rewards bell only if THIS device subscribes to that branch.
    franchiseDrafts: [],           // [{ id, branchId, title, text, tag, status, submittedAt }]
    publishedOffers: [],          // [{ uid, branchId, kicker, title, text, tag, sentAt, sendCount }]

    /* ---------------- pickup, check-ins, drops, tier memory ----------------
       The four habit surfaces. Each is user-visible the moment it fires:
       a chosen pickup window with a live countdown, an "I'm here" bonus that
       pays out at the counter, a once-a-day drop with a next-one countdown,
       and the tier id we last celebrated so the level-up moment shows once. */
    pickup: null,                 // { slot:"18:30", branch, placedAt, readyAt } — last chosen window
    checkins: [],                 // [{ ts, branch, pts }] — "I'm here" taps, one bonus per branch/day
    dailyDrop: { lastClaim: 0, streak: 0, total: 0 },  // once-a-day bonus (2× on Thursdays)
    tierSeen: "kome",             // tier id already celebrated — level-up fires once per tier
    statsSeen: 0                  // last visit ts the "month in sushi" card was opened
  };

  /* loyalty store events — app.js subscribes to repaint tier/offers UI */
  const listeners = [];
  function emit() { listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULTS);
      // merge so new fields added in later versions get their defaults
      const saved = JSON.parse(raw);
      const savedProfile = saved.profile || null;
      // a stale/foreign role can't flag a normal profile as staff demo staff
      const staffName = savedProfile && typeof savedProfile.name === "string" &&
        ["admin", "franchisee", "marketing"].includes(savedProfile.name.trim().toLowerCase());
      const profile = savedProfile && typeof savedProfile === "object"
        ? { ...savedProfile, role: staffName ? "staff" : null }
        : null;
      return {
        ...structuredClone(DEFAULTS), ...saved,
        profile,
        card: { ...DEFAULTS.card, ...(saved.card || {}) },
        cart: Array.isArray(saved.cart) ? saved.cart : [],
        loyalty: { ...DEFAULTS.loyalty, ...(saved.loyalty || {}) },
        wallet: {
          ...DEFAULTS.wallet, ...(saved.wallet || {}),
          // only the two known providers survive a round-trip
          expressPay: ["apple", "google"].includes(saved.wallet?.expressPay)
            ? saved.wallet.expressPay : null
        },
        gifts: Array.isArray(saved.gifts) ? saved.gifts : [],
        claimed: Array.isArray(saved.claimed) ? saved.claimed : [],
        referralsRedeemed: Number(saved.referralsRedeemed) || 0,
        referralCodes: Array.isArray(saved.referralCodes) ? saved.referralCodes : [],
        redeemedRefs: Array.isArray(saved.redeemedRefs) ? saved.redeemedRefs : [],
        // applied coupon: only a well-shaped record survives a round-trip
        coupon: (saved.coupon && typeof saved.coupon === "object" &&
                 typeof saved.coupon.code === "string" &&
                 ["percent", "fixed_baht", "free_item"].includes(saved.coupon.type))
          ? saved.coupon
          : null,
        chat: {
          thread: Array.isArray(saved.chat && saved.chat.thread) ? saved.chat.thread : [],
          connected: !!(saved.chat && saved.chat.connected)
        },
        // branch subscriptions: only names that still exist in the data layer
        // survive a round-trip (stale picks are dropped on load)
        subscribedBranches: Array.isArray(saved.subscribedBranches)
          ? saved.subscribedBranches.filter(n =>
              typeof n === "string" && window.NaekiData?.BRANCHES?.some(b => b.name === n))
          : [],
        // ack ledger: only string keys with { ts, via } survive a round-trip
        offerAcks: (saved.offerAcks && typeof saved.offerAcks === "object" &&
          !Array.isArray(saved.offerAcks))
          ? Object.fromEntries(Object.entries(saved.offerAcks)
              .filter(([k, v]) => k && v && typeof v === "object" && v.via))
          : {},
        // brand-portal drafts: branch names must still exist in the data layer
        franchiseDrafts: Array.isArray(saved.franchiseDrafts)
          ? saved.franchiseDrafts.filter(d =>
              d && typeof d.branchId === "string" &&
              window.NaekiData?.BRANCHES?.some(b => b.name === d.branchId))
          : [],
        publishedOffers: Array.isArray(saved.publishedOffers)
          ? saved.publishedOffers.filter(o =>
              o && typeof o.branchId === "string" &&
              window.NaekiData?.BRANCHES?.some(b => b.name === o.branchId))
          : [],
        // pickup window: only a well-shaped record with a real branch survives
        pickup: (saved.pickup && typeof saved.pickup === "object" &&
                 typeof saved.pickup.slot === "string" &&
                 window.NaekiData?.BRANCHES?.some(b => b.name === saved.pickup.branch))
          ? saved.pickup
          : null,
        // check-ins: only numeric stamps at branches that still exist
        checkins: Array.isArray(saved.checkins)
          ? saved.checkins.filter(c => c && Number(c.ts) > 0 &&
              window.NaekiData?.BRANCHES?.some(b => b.name === c.branch))
          : [],
        dailyDrop: {
          lastClaim: Number(saved.dailyDrop?.lastClaim) || 0,
          streak: Number(saved.dailyDrop?.streak) || 0,
          total: Number(saved.dailyDrop?.total) || 0
        },
        // tier ladder the user has already been celebrated for (unknown → base)
        tierSeen: typeof saved.tierSeen === "string" ? saved.tierSeen : "kome",
        statsSeen: Number(saved.statsSeen) || 0,
        // sound pref: only an explicit false turns it off
        sound: saved.sound !== false
      };
    } catch {
      // private browsing, disabled storage, corrupt JSON → fresh state
      return structuredClone(DEFAULTS);
    }
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      // best-effort push of the whole user-owned state to the backend, so
      // stamps/wallet/gifts/referrals/drafts all live in Neon. The profile
      // record itself stays server-side (the account), so we strip the
      // locally-derived profile out of the pushed blob.
      const API = window.NaekiAPI;
      if (API && state.profile?.email) {
        const { profile, ...owned } = state;
        schedulePush(owned);
      }
      return true;
    } catch {
      return false; // quota / blocked storage — keep working in-memory
    }
  }

  let pushTimer = null;
  function schedulePush(owned) {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => {
      window.NaekiAPI?.userStateUpsert(owned).then(ok => {
        if (!ok) console.warn("[naeki-api] user_state upsert failed");
      }).catch(() => {});
    }, 120);  // coalesce bursts (checkout, stamp taps)
  }

  window.NaekiStore = {
    /** full state (read-only use) */
    get: () => state,

    /** real backend auth (Neon). Async: returns { ok, user?, error? }.
        Sets the local profile from the authenticated record; staff/portal
        access is driven by the seeded `role` field (franchise_owner /
        admin / superadmin), not the display name. Loyalty + the whole
        user-owned store are loaded from the owner-scoped rows when present. */
    async signIn(email, password) {
      const API = window.NaekiAPI;
      if (!API) return { ok: false, error: "Backend not available" };
      const res = await API.signIn(email, password);
      if (!res.ok) return res;
      const staff = res.isStaff;
      state.profile = {
        name: res.user.name || res.user.email,
        email: res.user.email,
        since: Date.now(),
        role: staff ? "staff" : null,
        roleUser: (res.role || "").toLowerCase(),   // real pb role: franchise_owner/admin/superadmin/customer
        branchId: res.user.branch_id || ""
      };
      // pull the user's ENTIRE server-side store back (stamps, wallet, gifts,
      // referrals, drafts, loyalty…) — subsumes the old loyalty-only read.
      const us = await API.userStateGet();
      if (us && us.data && typeof us.data === "object") {
        const saved = us.data;
        state = {
          ...structuredClone(DEFAULTS),
          ...saved,
          profile: state.profile,                 // keep the fresh auth profile
          card: { ...DEFAULTS.card, ...(saved.card || {}) },
          loyalty: { ...DEFAULTS.loyalty, ...(saved.loyalty || {}) },
          wallet: { ...DEFAULTS.wallet, ...(saved.wallet || {}) },
          chat: { ...DEFAULTS.chat, ...(saved.chat || {}) }
        };
      }
      const ok = persist();
      if (ok) emit();
      return { ok: true, user: res.user, isStaff: staff };
    },

    async signOut() {
      // flush any pending server-side state before dropping the session
      const API = window.NaekiAPI;
      if (API && state.profile?.email) {
        const { profile, ...owned } = state;
        try { await API.userStateUpsert(owned); } catch {}
      }
      window.NaekiAPI?.signOut();
      state.profile = null; // stamps/history survive sign-out
      return persist();
    },
    /** is this session a staff (partner-portal) demo login? */
    isStaff() {
      return !!(state.profile && state.profile.role === "staff");
    },

    /** push loyalty to the backend (points/history) after earning/spending */
    async persistLoyalty() {
      const API = window.NaekiAPI;
      if (!API || !state.profile?.email) return;
      await API.upsertLoyalty({
        points: state.loyalty.points,
        lifetime: state.loyalty.lifetime,
        history: state.loyalty.history
      });
    },

    /** stamp card accessors */
    card: () => state.card,

    addStamp(note = "demo stamp") {
      state.card.stamps.push({ ts: Date.now(), note });
      return persist();
    },

    /** claim the reward and start a fresh card; returns the redemption, or null */
    redeem(reward = "Free drink") {
      const card = state.card;
      if (card.stamps.length < card.size) return null;
      const redemption = { ts: Date.now(), reward, stampCount: card.stamps.length };
      card.redemptions.unshift(redemption);
      card.stamps = [];
      persist();
      return redemption;
    },

    /** wipe all local data */
    reset() {
      state = structuredClone(DEFAULTS);
      persist();
    },

    /** reset only the stamp card — the profile (and with it the app/landing
        mode) is left intact, so "Reset card" can't sign the user out */
    resetCard() {
      state.card = structuredClone(DEFAULTS.card);
      return persist();
    },

    /* ---------------- demo order cart ----------------
       The cart persists on-device like everything else here. Checkout is a
       demo: it records an order id + total locally and clears the lines —
       nothing is transmitted; the real order path stays LINE OA / in-store. */

    /** live copy of the cart lines */
    cart: () => state.cart,

    /** add one of a menu item; returns the new total qty in the cart */
    addToCart(name, price) {
      const line = state.cart.find(l => l.name === name);
      if (line) line.qty++;
      else state.cart.push({ name, price: Number(price) || 0, qty: 1, addedAt: Date.now() });
      persist();
      return cartCount();
    },
    /** set exact qty (0 removes); returns the new total qty */
    setCartQty(name, qty) {
      const line = state.cart.find(l => l.name === name);
      if (!line) return cartCount();
      line.qty = qty;
      if (line.qty <= 0) state.cart = state.cart.filter(l => l.name !== name);
      persist();
      return cartCount();
    },
    /** demo checkout: totals the cart, clears it, returns the receipt.
        Loyalty earning lives here: writes a purchase record, awards points
        (1 pt / 10฿ × tier × points-day multipliers), spends wallet balance
        before "cash". Nothing is transmitted. */
    checkoutCart(category) {
      if (!state.cart.length) return null;
      const subtotal = state.cart.reduce((t, l) => t + l.price * l.qty, 0);
      // coupon re-validated against the live cart at the moment of checkout —
      // a coupon applied earlier may no longer fit (cart changed, code expired)
      const coupon = state.coupon;
      const couponDiscount = this.couponDiscount(state.cart);
      // the stamp-card treat pays here, automatically: the first unspent
      // NK-TREAT-… voucher is spent against this order, so the 10th stamp is
      // worth real baht instead of a line in a history list.
      const treat = state.gifts.find(g => !g.spent && g.treat);
      const treatDiscount = treat ? Math.min(treat.amount, subtotal - couponDiscount) : 0;
      const discount = couponDiscount + treatDiscount;
      const total = subtotal - discount;
      const couponDropped = coupon && !couponDiscount ? coupon.code : null;
      const count = cartCount();
      const walletSpent = (state.wallet.useWallet !== false)   // opt-in (default true)
        ? Math.min(state.wallet.balance, total) : 0;
      const paidByWallet = walletSpent > 0;
      state.wallet.balance -= walletSpent;

      const Data = window.NaekiData;
      const tier = Data.tierFor(state.loyalty.lifetime);
      const dayMult = Data.bangkokWeekday(Date.now()) === Data.POINTS_DAY ? 2 : 1;
      const earned = Data.pointsFor(total, Data.tierMultOf(tier), dayMult);

      const receipt = {
        id: "NK-" + Date.now().toString(36).toUpperCase(),
        total, subtotal, discount, count, ts: Date.now(), lines: state.cart.slice(),
        category: category || null,
        couponCode: couponDiscount > 0 ? coupon.code : null,
        couponDropped,
        treatCode: treatDiscount > 0 ? treat.code : null,
        treatDiscount,
        paidByWallet, walletSpent,
        pointsEarned: earned, tier: tier.name,
        newLifetime: state.loyalty.lifetime + earned
      };
      state.loyalty.points += earned;
      state.loyalty.lifetime += earned;
      state.loyalty.history.unshift({
        ts: receipt.ts, total, count, category: category || null,
        couponCode: receipt.couponCode, discount,
        lines: receipt.lines.map(l => ({ name: l.name, qty: l.qty, price: l.price }))
      });
      if (couponDiscount > 0) state.coupon = null;   // single-use per order, like real codes
      if (treatDiscount > 0) treat.spent = true;     // the treat is consumed too
      if (state.loyalty.history.length > 50) state.loyalty.history.length = 50;
      state.cart = [];
      persist();
      emit();
      // push the updated loyalty to the backend (best-effort)
      if (window.NaekiStore.persistLoyalty) window.NaekiStore.persistLoyalty();
      return receipt;
    },
    clearCart() {
      state.cart = [];
      return persist();
    },

    /* ---------------- coupon (validated against the pb collection) ----------------
       The record was already fetched + validated when applied (app.js); this
       re-checks the shape against THIS cart at checkout, because the cart may
       have changed since (dipped under minSpend, brand switched, free item
       removed). usedCount/active stay the brand's ledger — read-only. */
    couponState: () => state.coupon,

    /** remember a validated coupon for the next checkout (one at a time) */
    setCoupon(coupon) {
      if (!coupon || typeof coupon !== "object" || !coupon.code) return null;
      state.coupon = coupon;
      persist();
      return state.coupon;
    },

    clearCoupon() {
      state.coupon = null;
      persist();
      return null;
    },

    /** discount this coupon gives THIS cart (0 when not applicable). Pure —
        safe to call from renderers for the live cart preview. */
    couponDiscount(lines) {
      const c = state.coupon;
      if (!c) return 0;
      const subtotal = lines.reduce((t, l) => t + l.price * l.qty, 0);
      const usable = couponUsable(c, subtotal, lines);
      if (!usable.ok) return 0;
      if (c.type === "percent")    return Math.round(subtotal * (Number(c.value) || 0) / 100);
      if (c.type === "fixed_baht") return Math.min(Number(c.value) || 0, subtotal);
      if (c.type === "free_item") {
        const free = lines.find(l => l.name === c.freeItem);
        return free ? Number(free.price) || 0 : 0;
      }
      return 0;
    },

    /** why this coupon can't be used right now (null when it can) */
    couponProblem(lines) {
      const c = state.coupon;
      if (!c) return null;
      const subtotal = lines.reduce((t, l) => t + l.price * l.qty, 0);
      return couponUsable(c, subtotal, lines).why || null;
    },

    /* ---------------- loyalty (points + tiers) ---------------- */

    loyalty: () => state.loyalty,

    /** redeem points for baht at 1 pt = 1฿; returns the redemption or null */
    redeemPoints(pts, label = "Redeemed at checkout") {
      pts = Math.floor(Number(pts) || 0);
      if (pts <= 0 || pts > state.loyalty.points) return null;
      state.loyalty.points -= pts;
      state.wallet.balance += pts;    // becomes stored value to spend
      persist();
      emit();
      return { ts: Date.now(), points: pts, baht: pts, label };
    },

    onLoyalty(fn) {
      listeners.push(fn);
      return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    },

    /* ---------------- milestone engine (seven achievements) ---------------- */

    /** claimed ids (forfeit-proof): the bonus awarded once per milestone */
    claimedState: () => state.claimed,

    /** current achievement state computed from LIVE history — done vs claimed */
    achievementState(opts = {}) {
      return window.NaekiData.achievements(state.loyalty.history, {
        referralsRedeemed: state.referralsRedeemed, ...opts
      });
    },

    /** award a completed milestone's bonus exactly once (atomic claim);
        returns { id, pts, total } or null if nothing to claim */
    claimMilestone(id) {
      const M = window.NaekiData;
      const m = (M.MILESTONES || []).find(x => x.id === id);
      if (!m) return null;
      if (state.claimed.includes(id)) return null;      // forfeit-proof
      const ach = this.achievementState();
      if (!ach.done[id]) return null;                   // not achieved yet
      state.claimed.push(id);
      state.loyalty.points += m.pts;
      state.loyalty.lifetime += m.pts;
      persist(); emit();
      return { id, pts: m.pts, total: state.loyalty.points };
    },

    /* ---- referral code: the "give + get" loop — both sides earn ---- */

    /** generate a shareable demo referral code (the giver's side) */
    makeReferral() {
      const code = "NK-FRIEND-" + Math.random().toString(36).slice(2, 8).toUpperCase();
      state.referralCodes.unshift({ code, created: Date.now() });
      persist(); emit();
      return code;
    },
    referralCodesState: () => state.referralCodes,

    /** redeem a shared code (the friend's side): +pts to the redeemer AND
        counts a "referral redeemed" that feeds the giver's milestone */
    redeemReferral(code) {
      code = String(code || "").trim().toUpperCase();
      if (!code) return null;
      const mine = state.referralCodes.some(c => c.code === code);
      if (mine) return null;                // don't self-redeem
      if (state.redeemedRefs && state.redeemedRefs.includes(code)) return null;
      state.redeemedRefs = state.redeemedRefs || [];
      state.redeemedRefs.push(code);
      state.referralsRedeemed += 1;
      // the redeemer earns the Give+Get bonus too (100 pts), friend-side
      state.loyalty.points += 100;
      state.loyalty.lifetime += 100;
      persist(); emit();
      return { pts: 100, code };
    },

    /* ---------------- wallet (stored value) ---------------- */

    walletState: () => state.wallet,
    giftsState: () => state.gifts,

    /** opt-in/out of paying the wallet balance before cash at checkout */
    setUseWallet(on) {
      state.wallet.useWallet = on !== false;
      persist();
      return state.wallet.useWallet;
    },

    /** opt-in/out of UI sounds + haptics (device preference, like wallet
        opt-in). No emit — the checkbox owns its own state. */
    setSound(on) {
      state.sound = on !== false;
      persist();
      return state.sound;
    },

    /** provision an express-pay wallet once ("apple" | "google"); repeat
        calls are no-ops — after provisioning the card lives in the
        phone's wallet and the app has nothing more to do */
    setExpressPay(provider) {
      if (!["apple", "google"].includes(provider)) return null;
      if (state.wallet.expressPay) return null;   // already added — one-time
      state.wallet.expressPay = provider;
      persist();
      emit();
      return state.wallet.expressPay;
    },

    /** demo top-up: TrueMoney-style — adds balance, logs the method */
    topUp(amount, method = "TrueMoney") {
      amount = Math.round(Number(amount) || 0);
      if (amount <= 0) return null;
      state.wallet.balance += amount;
      const rec = {
        ts: Date.now(), amount, method,
        ref: method.slice(0, 2).toUpperCase() + "-" + Math.random().toString(36).slice(2, 8).toUpperCase()
      };
      state.wallet.topups.unshift(rec);
      persist();
      emit();
      return rec;
    },

    /** buy a gift card: balance is debited (or "paid" fresh) and a code
        is issued; the code can later be redeemed into the wallet */
    buyGift(amount, paidFromBalance = true) {
      amount = Math.round(Number(amount) || 0);
      if (amount < 50) return null;             // min ฿50 like real cards
      if (paidFromBalance) {
        if (state.wallet.balance < amount) return null;
        state.wallet.balance -= amount;
      }
      const gift = {
        code: "NK-GIFT-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
        amount, ts: Date.now(), spent: false
      };
      state.gifts.unshift(gift);
      persist();
      emit();
      return gift;
    },

    /** redeem a gift code into the wallet balance; idempotent */
    redeemGift(code) {
      const gift = state.gifts.find(g => g.code === String(code || "").trim().toUpperCase() && !g.spent);
      if (!gift) return null;
      gift.spent = true;
      state.wallet.balance += gift.amount;
      persist();
      emit();
      return gift;
    },

    /* ---------------- chat → LINE handoff ---------------- */

    chatState: () => state.chat,

    /** append a message to the local transcript. Nothing leaves the device —
        the real reply happens on the LINE OA. Returns the thread length. */
    chatSend(text, topic = "") {
      text = String(text || "").trim().slice(0, 500);
      if (!text) return null;
      state.chat.thread.push({ role: "user", text, topic: topic || null, ts: Date.now() });
      persist();
      return state.chat.thread.length;
    },

    /** append a system acknowledgement (e.g. the handoff note); persists like
        a user message but renders on the left */
    chatNote(text) {
      text = String(text || "").trim().slice(0, 500);
      if (!text) return null;
      state.chat.thread.push({ role: "system", text, ts: Date.now() });
      persist();
      return state.chat.thread.length;
    },

    /** mark that the user has reached the OA once (drives the demo badge);
        no other side effects */
    chatConnect() {
      state.chat.connected = true;
      persist();
      return state.chat.connected;
    },

    /** clear the local transcript + connected flag */
    chatReset() {
      state.chat.thread = [];
      state.chat.connected = false;
      persist();
      return state.chat;
    },

    /* ---------------- branch subscriptions ("your branches") ---------------- */
    /** live copy of the branch names this device wants notifications/offers from */
    subscribedBranchesState: () => state.subscribedBranches,

    /** true if a branch (by name) is subscribed */
    isSubscribed(branchName) {
      return state.subscribedBranches.includes(branchName);
    },

    /** toggle a branch on/off "your branches"; returns the new subscribed list.
        Names are validated against the data layer so a removed branch can't
        linger as a subscription (same guard the loader uses). */
    toggleBranchSubscription(branchName) {
      const valid = window.NaekiData?.BRANCHES?.some(b => b.name === branchName);
      if (!valid) return state.subscribedBranches.slice();
      const i = state.subscribedBranches.indexOf(branchName);
      if (i >= 0) state.subscribedBranches.splice(i, 1);
      else state.subscribedBranches.push(branchName);
      persist();
      return state.subscribedBranches.slice();
    },

    /* ---------------- offer acknowledgements (bell) ---------------- */

    offerAcksState: () => state.offerAcks,

    /** record that a live offer was acknowledged (✕ on the popup or ✓ in
        the inbox). Keying is the caller's job (weekday|kicker|title — the
        composition, not the week). Returns the stored record, or the
        existing one if already acked (idempotent). */
    ackOffer(key, via = "popup") {
      key = String(key || "");
      if (!key) return null;
      const rec = state.offerAcks[key] || { ts: Date.now(), via: via === "inbox" ? "inbox" : "popup" };
      if (!state.offerAcks[key]) state.offerAcks[key] = rec;
      persist();
      return rec;
    },

    /** wipe the ack ledger (Reset uses this) — every offer re-arrives */
    resetOfferAcks() {
      state.offerAcks = {};
      persist();
      return state.offerAcks;
    },

    /* ---------------- brand portal (franchise drafts → approval → publish) ---------------- */

    /** live copy of franchise drafts + published offers */
    franchiseDraftsState: () => state.franchiseDrafts,
    publishedOffersState: () => state.publishedOffers,

    /** franchisee drafts an offer for their branch (status: draft).
        Branch is the franchisee's own — derived here, not client-chosen,
        so a branch admin can only ever create for the branch they hold. */
    createDraft({ branchId, title, text, tag }) {
      const valid = window.NaekiData?.BRANCHES?.some(b => b.name === (branchId || ""));
      title = String(title || "").trim().slice(0, 60);
      text  = String(text  || "").trim().slice(0, 160);
      if (!valid || !title || !text) return null;
      const draft = { id: "id" + Date.now(), branchId, title, text,
        tag: tag || "deal", status: /** @type {"draft"} */ ("draft"), submittedAt: 0 };
      state.franchiseDrafts.push(draft);
      persist();
      return draft;
    },

    /** update a draft that's still in draft status (edits). */
    updateDraft(id, { title, text, tag }) {
      const d = state.franchiseDrafts.find(x => x.id === id);
      if (!d || d.status !== "draft") return null;
      if (typeof title === "string")  d.title = title.trim().slice(0, 60) || d.title;
      if (typeof text  === "string")  d.text  = text.trim().slice(0, 160) || d.text;
      if (tag) d.tag = tag;
      persist();
      return d;
    },

    /** franchisee submits a draft → pending, ready for marketing review. */
    submitDraft(id) {
      const d = state.franchiseDrafts.find(x => x.id === id);
      if (!d || d.status !== "draft") return null;
      d.status = "pending";
      d.submittedAt = Date.now();
      persist();
      return d;
    },

    /** marketing-admin review: approve → published to N (seeded) subscribers
        + merged into the offers feed; return → back to draft for rework.
        publishCount comes from the data layer (seeded demo figures). */
    reviewDraft(id, decision) {
      const d = state.franchiseDrafts.find(x => x.id === id);
      if (!d || d.status !== "pending") return null;
      if (decision === "approve") {
        const sendCount = window.NaekiData?.subscriberCountOf
          ? window.NaekiData.subscriberCountOf(d.branchId) : 1;
        const pub = {
          uid: "pub" + Date.now() + Math.floor(Math.random() * 1e4),
          branchId: d.branchId,
          kicker: window.NaekiData.branchKicker(d.branchId),
          title: d.title, text: d.text, tag: d.tag,
          sentAt: Date.now(), sendCount
        };
        state.publishedOffers.unshift(pub);
        d.status = "approved";
        persist();
        return pub;
      }
      if (decision === "return") {
        d.status = "draft";
        d.submittedAt = 0;
        persist();
        return d;
      }
      return null;
    },

    /** remove a draft (franchisee discards; nothing was sent). */
    deleteDraft(id) {
      state.franchiseDrafts = state.franchiseDrafts.filter(x => x.id !== id);
      persist();
      return state.franchiseDrafts.slice();
    },

    /* ================= habit surfaces =================
       Six user-facing loops that each pay out visibly, plus the tier
       celebration. All are computed against Bangkok time and this device's
       own history; each persists and emits so the UI repaints immediately. */

    /* ---- 1. pickup windows: choose when the order is ready ----------------
       The menu shows a slot picker; the chosen window survives sign-out and
       drives a live countdown ("ready in 12 min") plus the receipt copy. */
    pickupState: () => state.pickup,

    /** claim a pickup slot (minutes from now, rounded to a 15-min grid) */
    setPickup(slot, branch) {
      if (!slot) return null;
      state.pickup = { slot: String(slot), branch: branch || "", placedAt: Date.now() };
      persist(); emit();
      return state.pickup;
    },
    clearPickup() { state.pickup = null; persist(); emit(); return true; },

    /* ---- 2. "I'm here" check-in: earns at the counter -------------------
       One bonus per branch per Bangkok day — taps at a second branch the same
       day still count, which is what makes the branch list worth opening. */
    checkinState: () => state.checkins,

    /** is this branch already checked into today? */
    checkedInToday(branch, now = Date.now()) {
      const day = window.NaekiData.bangkokDayKey(now);
      return state.checkins.some(c => c.branch === branch &&
        window.NaekiData.bangkokDayKey(c.ts) === day);
    },

    /** tap in at a branch: +25 pts (2× Thursdays), once per branch per day */
    checkIn(branch) {
      if (!branch) return null;
      if (this.checkedInToday(branch)) return null;
      const D = window.NaekiData;
      const mult = D.bangkokWeekday(Date.now()) === D.POINTS_DAY ? 2 : 1;
      const pts = 25 * mult;
      state.checkins.unshift({ ts: Date.now(), branch, pts });
      state.loyalty.points += pts;
      state.loyalty.lifetime += pts;
      persist(); emit();
      if (window.NaekiStore.persistLoyalty) window.NaekiStore.persistLoyalty();
      return { pts, branch };
    },

    /* ---- 3. daily drop: opens once a day, counts down to the next --------
       A reason to open the app on a day you're not ordering. Streak grows on
       consecutive days and the payout scales with it; Thursdays double. */
    dailyDropState: () => state.dailyDrop,

    /** the drop's window for today (Bangkok day) + streak-aware payout */
    dailyDropInfo(now = Date.now()) {
      const D = window.NaekiData;
      const today = D.bangkokDayKey(now);
      const claimedToday = state.dailyDrop.lastClaim &&
        D.bangkokDayKey(state.dailyDrop.lastClaim) === today;
      const yesterdayKey = D.bangkokDayKey(now - 24 * 60 * 60 * 1000);
      const lastKey = state.dailyDrop.lastClaim ? D.bangkokDayKey(state.dailyDrop.lastClaim) : "";
      // streak survives only if the last claim was today or yesterday
      const streak = claimedToday || lastKey === yesterdayKey ? state.dailyDrop.streak : 0;
      const base = 30;
      const streakPts = base + Math.min(streak, 6) * 10;
      const mult = D.bangkokWeekday(now) === D.POINTS_DAY ? 2 : 1;
      // next drop opens at 00:05 Bangkok (a fresh day, not the stroke of midnight)
      const parts = D.bangkokParts(now);
      const minutesLeftToday = (24 * 60) - (parts.h * 60 + parts.m) + 5;
      return {
        claimedToday, streak, pts: streakPts * mult, mult,
        minutesToNext: minutesLeftToday,
        total: state.dailyDrop.total
      };
    },

    /** claim today's drop; returns { pts, streak } or null if already taken */
    claimDailyDrop() {
      const info = this.dailyDropInfo();
      if (info.claimedToday) return null;
      state.dailyDrop.lastClaim = Date.now();
      state.dailyDrop.streak = info.streak + 1;
      state.dailyDrop.total += info.pts;
      state.loyalty.points += info.pts;
      state.loyalty.lifetime += info.pts;
      persist(); emit();
      if (window.NaekiStore.persistLoyalty) window.NaekiStore.persistLoyalty();
      return { pts: info.pts, streak: state.dailyDrop.streak };
    },

    /* ---- 4. tier celebration: fire once per level crossed ---------------- */
    tierSeenState: () => state.tierSeen,

    /** the tier the user is on now, and whether it's a new one worth a moment */
    tierMoment() {
      const D = window.NaekiData;
      const tier = D.tierFor(state.loyalty.lifetime);
      const isNew = state.tierSeen !== tier.id &&
        D.TIERS.findIndex(t => t.id === tier.id) > D.TIERS.findIndex(t => t.id === state.tierSeen);
      return { tier, isNew, seen: state.tierSeen };
    },
    /** mark the current tier as celebrated (so the moment shows exactly once) */
    ackTier() {
      const tier = window.NaekiData.tierFor(state.loyalty.lifetime);
      state.tierSeen = tier.id;
      persist(); emit();
      return tier.id;
    },

    /* ---- 5. "your sushi month": a shareable recap of real behaviour ------ */
    /** recap computed from THIS device's history — the honest Wrapped */
    recap(now = Date.now()) {
      const D = window.NaekiData;
      const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
      const orders = (state.loyalty.history || []).filter(o => o.ts >= monthAgo);
      const spend = orders.reduce((t, o) => t + (Number(o.total) || 0), 0);
      const dishes = orders.reduce((n, o) => n + (Number(o.count) || 0), 0);
      const cats = {};
      for (const o of orders) if (o.category) cats[o.category] = (cats[o.category] || 0) + (o.count || 1);
      const topCatId = Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      const group = D.MENU.find(g => g.id === topCatId);
      const days = new Set(orders.map(o => D.bangkokDayKey(o.ts)));
      // favourite single dish across the month's recorded lines
      const dishes2 = {};
      for (const o of orders) for (const l of (o.lines || []))
        dishes2[l.name] = (dishes2[l.name] || 0) + (l.qty || 1);
      const favourite = Object.entries(dishes2).sort((a, b) => b[1] - a[1])[0] || null;
      const tier = D.tierFor(state.loyalty.lifetime);
      return {
        orders: orders.length, spend, dishes, days: days.size,
        topCat: group ? group.name : null, topCatJp: group ? group.jp : null,
        favourite: favourite ? favourite[0] : null,
        favouriteQty: favourite ? favourite[1] : 0,
        saved: orders.reduce((t, o) => t + (Number(o.discount) || 0), 0),
        points: state.loyalty.points, lifetime: state.loyalty.lifetime, tier,
        stamps: state.card.stamps.length, stampSize: state.card.size,
        checkins: (state.checkins || []).length,
        best: this.bestDay(orders)
      };
    },

    /** the single biggest-spend Bangkok day in a set of orders */
    bestDay(orders) {
      const D = window.NaekiData;
      const byDay = {};
      for (const o of orders || state.loyalty.history || []) {
        const k = D.bangkokDayKey(o.ts);
        byDay[k] = (byDay[k] || 0) + (Number(o.total) || 0);
      }
      const top = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0];
      if (!top) return null;
      const when = new Date(Number(top[0].split("-")[0]), Number(top[0].split("-")[1]) - 1, Number(top[0].split("-")[2]));
      return { key: top[0], total: top[1], label: when.toLocaleDateString("th-TH", { day: "numeric", month: "long", timeZone: "Asia/Bangkok" }) };
    },

    /* ---- 6. stamp card: bank a treat you can actually spend -------------
       Redeeming no longer just empties the card — it mints a real voucher in
       the wallet that the next checkout uses, so the 10th stamp pays out. */
    /** redeem a full card into a spendable voucher (stored in gifts) */
    redeemStampCard(reward = "Free treat") {
      const card = state.card;
      if (card.stamps.length < card.size) return null;
      const voucher = {
        code: "NK-TREAT-" + Math.random().toString(36).slice(2, 7).toUpperCase(),
        amount: 60, ts: Date.now(), spent: false, treat: reward
      };
      state.gifts.unshift(voucher);
      card.redemptions.unshift({ ts: Date.now(), reward, stampCount: card.stamps.length, voucher: voucher.code });
      card.stamps = [];
      persist(); emit();
      return voucher;
    },

    /** note that the recap card was opened (so the badge can retire) */
    ackRecap() { state.statsSeen = Date.now(); persist(); return state.statsSeen; }
  };

  function cartCount() {
    return state.cart.reduce((n, l) => n + l.qty, 0);
  }

  /* coupon applicability against a concrete cart — the single rule set both
     the apply-time check (app.js, against pb records) and checkout re-check
     share. `why` is customer-readable so the cart can explain itself. */
  function couponUsable(c, subtotal, lines) {
    const now = Date.now();
    const why = (msg) => ({ ok: false, why: msg });
    if (!c || !c.code) return why("Coupon missing.");
    if (c.active === false) return why(`Coupon ${c.code} is no longer active.`);
    if (c.startsAt && now < c.startsAt) return why(`Coupon ${c.code} hasn't started yet.`);
    if (c.expiresAt && now > c.expiresAt) return why(`Coupon ${c.code} has expired.`);
    if (Number(c.usageLimit) > 0 && Number(c.usedCount) >= Number(c.usageLimit))
      return why(`Coupon ${c.code} has been fully claimed.`);
    const min = Number(c.minSpend) || 0;
    if (subtotal < min)
      return why(`Add ${"฿" + (min - subtotal)} more — coupon ${c.code} needs a ฿${min} minimum.`);
    if (c.type === "free_item") {
      const has = lines.some(l => l.name === c.freeItem);
      if (!has) return why(`Add the ${c.freeItem || "free item"} to use coupon ${c.code}.`);
    }
    if (c.brand) {
      // the cart must actually contain something from the coupon's brand
      const Data = window.NaekiData;
      const hasBrand = (lines || []).some(l => {
        const g = Data?.MENU?.find(gr => gr.items.some(it => it.name === l.name));
        return g ? g.brand === c.brand : true;   // unknown line → don't block
      });
      if (!hasBrand)
        return why(`Coupon ${c.code} is only for ${c.brand === "go" ? "Naeki Go!" : "Naeki Sushi"} items.`);
    }
    return { ok: true, why: null };
  }
})();