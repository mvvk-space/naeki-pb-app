/* Shared sandbox loader for the browser IIFE modules (data.js / api.js / store.js).
   Same trick as scripts/smoke-coupon.mjs: a vm context with browser shims, no jsdom.
   The sandbox has NO network unless the test dials the real API explicitly. */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");

export function makeSandbox({ files = ["data.js", "store.js"] } = {}) {
  const mem = new Map();
  const sandbox = {
    console,
    fetch: () => Promise.resolve({ ok: false, status: 0, json: async () => ({}) }),
    setTimeout, clearTimeout, setInterval, clearInterval,
    structuredClone, Date, Math, JSON, Number, String, Boolean, Array, Object,
    performance,
    localStorage: {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    },
    navigator: { onLine: true },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const f of files) {
    vm.runInContext(fs.readFileSync(path.join(root, "src", f), "utf8"), ctx, { filename: f });
  }
  return sandbox;
}

export const S = () => makeSandbox().window.NaekiStore;
export const D = () => makeSandbox().window.NaekiData;