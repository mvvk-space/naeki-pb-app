/* Milestones + achievements: the seven-achievement engine fed by live history. */
import { describe, it, expect, beforeEach } from "vitest";
import { S, D } from "../helpers/sandbox.mjs";

let s, d;
beforeEach(() => { s = S(); d = D(); });

describe("milestone engine", () => {
  it("exposes exactly seven achievements", () => {
    const st = s.achievementState();
    expect(Object.keys(st.done).length).toBe(7);
  });

  it("nothing is done on an empty history", () => {
    const st = s.achievementState();
    expect(Object.values(st.done).every((v) => !v)).toBe(true);
  });

  it("a checkout flips the first-order achievement done", () => {
    s.topUp(1000);
    s.setUseWallet(false);
    s.addToCart("Starter", 200);
    s.checkoutCart();
    const st = s.achievementState();
    expect(st.done.first).toBe(true);
  });

  it("claim awards the bonus exactly once (forfeit-proof)", () => {
    s.topUp(1000);
    s.setUseWallet(false);
    s.addToCart("Starter", 200);
    s.checkoutCart();
    const doneIds = Object.entries(s.achievementState().done)
      .filter(([, v]) => v).map(([k]) => k);
    expect(doneIds.length).toBeGreaterThan(0);
    const id = doneIds[0];
    const ptsBefore = s.loyalty().points;
    const res = s.claimMilestone(id);
    expect(res).toBeTruthy();
    expect(s.loyalty().points).toBeGreaterThan(ptsBefore);
    // second claim is refused — no double award
    expect(s.claimMilestone(id)).toBeNull();
    expect(s.loyalty().points).toBe(res.total);
  });

  it("claiming an unachieved milestone returns null", () => {
    // 'cadence' needs a 7-day streak; nothing done on fresh state
    expect(s.claimMilestone("cadence")).toBeNull();
  });

  it("MILESTONES data ships the seven entries with kickers", () => {
    expect(d.MILESTONES.length).toBe(7);
    for (const m of d.MILESTONES) {
      expect(m.kicker).toBeTruthy();
      expect(m.title).toBeTruthy();
      expect(m.pts).toBeGreaterThan(0);
    }
  });
});