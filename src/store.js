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
    cart: []                    // [{ name: string, price: number, qty: number, addedAt: epoch-ms }]
  };

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
        cart: Array.isArray(saved.cart) ? saved.cart : []
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
    /** demo checkout: totals the cart, clears it, returns the receipt */
    checkoutCart() {
      if (!state.cart.length) return null;
      const total = state.cart.reduce((t, l) => t + l.price * l.qty, 0);
      const count = cartCount();
      const receipt = {
        id: "NK-" + Date.now().toString(36).toUpperCase(),
        total, count, ts: Date.now(), lines: state.cart.slice()
      };
      state.cart = [];
      persist();
      return receipt;
    },
    clearCart() {
      state.cart = [];
      return persist();
    }
  };

  function cartCount() {
    return state.cart.reduce((n, l) => n + l.qty, 0);
  }
})();