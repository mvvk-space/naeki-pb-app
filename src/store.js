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
    profile: null,              // { name: string, since: epoch-ms }
    // demo stamp card — stamps are self-issued, never verified by the brand
    card: {
      size: 10,                 // stamps per reward
      stamps: [],               // [{ ts: epoch-ms, note: string }]
      redemptions: []           // [{ ts: epoch-ms, reward: string }]
    },
    // demo order cart — persists across sessions, never leaves the device;
    // lines reference menu items by name (the data-layer key)
    cart: [],                   // [{ name, price, qty, addedAt }]
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
      expressPay: null          // "apple" | "google" once provisioned (one-time, honest demo)
    },
    // demo gift cards the user has "bought" (for themselves / to give away)
    gifts: [],                    // [{ code, amount, ts, spent }]
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
    }
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
      return {
        ...structuredClone(DEFAULTS), ...saved,
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
        chat: {
          thread: Array.isArray(saved.chat && saved.chat.thread) ? saved.chat.thread : [],
          connected: !!(saved.chat && saved.chat.connected)
        }
      };
    } catch {
      // private browsing, disabled storage, corrupt JSON → fresh state
      return structuredClone(DEFAULTS);
    }
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      return true;
    } catch {
      return false; // quota / blocked storage — keep working in-memory
    }
  }

  window.NaekiStore = {
    /** full state (read-only use) */
    get: () => state,

    /** profile: local display name that switches landing/app modes */
    setProfile(name) {
      const trimmed = (name || "").trim().slice(0, 24);
      if (!trimmed) return false;
      state.profile = { name: trimmed, since: Date.now() };
      return persist();
    },
    signOut() {
      state.profile = null; // stamps/history survive sign-out
      return persist();
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
      const total = state.cart.reduce((t, l) => t + l.price * l.qty, 0);
      const count = cartCount();
      const walletSpent = Math.min(state.wallet.balance, total);
      const paidByWallet = walletSpent > 0;
      state.wallet.balance -= walletSpent;

      const Data = window.NaekiData;
      const tier = Data.tierFor(state.loyalty.lifetime);
      const dayMult = Data.bangkokWeekday(Date.now()) === Data.POINTS_DAY ? 2 : 1;
      const earned = Data.pointsFor(total, Data.tierMultOf(tier), dayMult);

      const receipt = {
        id: "NK-" + Date.now().toString(36).toUpperCase(),
        total, count, ts: Date.now(), lines: state.cart.slice(),
        category: category || null,
        paidByWallet, walletSpent,
        pointsEarned: earned, tier: tier.name,
        newLifetime: state.loyalty.lifetime + earned
      };
      state.loyalty.points += earned;
      state.loyalty.lifetime += earned;
      state.loyalty.history.unshift({
        ts: receipt.ts, total, count, category: category || null,
        lines: receipt.lines.map(l => ({ name: l.name, qty: l.qty, price: l.price }))
      });
      if (state.loyalty.history.length > 50) state.loyalty.history.length = 50;
      state.cart = [];
      persist();
      emit();
      return receipt;
    },
    clearCart() {
      state.cart = [];
      return persist();
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
    }
  };

  function cartCount() {
    return state.cart.reduce((n, l) => n + l.qty, 0);
  }
})();