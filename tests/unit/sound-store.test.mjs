/* Sound preference plumbing in store.js: DEFAULT on, setSound persists,
   only an explicit false survives a reload (load() round-trip guard). */
import { describe, it, expect } from "vitest";
import { makeSandbox } from "../helpers/sandbox.mjs";

describe("sound preference (store.js)", () => {
  it("defaults to ON", () => {
    const s = makeSandbox({ files: ["store.js"] }).window.NaekiStore;
    expect(s.get().sound).toBe(true);
  });

  it("setSound(false) persists, and the persisted value survives a reload", () => {
    const sb = makeSandbox({ files: ["store.js"] });
    const s = sb.window.NaekiStore;
    expect(s.setSound(false)).toBe(false);
    expect(s.get().sound).toBe(false);

    const saved = JSON.parse(sb.localStorage.getItem("naeki.showcase.v1"));
    expect(saved.sound).toBe(false);
    const s2 = makeSandbox({
      files: ["store.js"],
      seed: { "naeki.showcase.v1": sb.localStorage.getItem("naeki.showcase.v1") }
    }).window.NaekiStore;
    expect(s2.get().sound).toBe(false);
  });

  it("only an explicit false turns it off — corrupt value falls back to true", () => {
    const s = makeSandbox({
      files: ["store.js"],
      seed: { "naeki.showcase.v1": JSON.stringify({ sound: "no" }) }
    }).window.NaekiStore;
    expect(s.get().sound).toBe(true);
  });
});