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
    // demo stamp card — stamps are self-issued, never verified by the brand
    card: {
      size: 10,                 // stamps per reward
      stamps: [],               // [{ ts: epoch-ms, note: string }]
      redemptions: []           // [{ ts: epoch-ms, reward: string }]
    }
  };

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULTS);
      // merge so new fields added in later versions get their defaults
      const saved = JSON.parse(raw);
      return { ...structuredClone(DEFAULTS), ...saved, card: { ...DEFAULTS.card, ...(saved.card || {}) } };
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

    /** wipe all local data (used by "reset card") */
    reset() {
      state = structuredClone(DEFAULTS);
      persist();
    }
  };
})();