/* NaekiAPI stock surface: {ok,status,data} convention kept — stockList
   null on a dead backend, stockReserve maps 409/401 into results, nothing
   throws for HTTP errors. */
import { describe, it, expect } from "vitest";
import { makeSandbox } from "../helpers/sandbox.mjs";

function apiWith(fetchImpl) {
  const sb = makeSandbox({ files: ["api.js"] });
  sb.fetch = fetchImpl;
  return sb.window.NaekiAPI;
}

describe("stock client (api.js)", () => {
  it("stockList maps rows; a dead backend returns null (not [])", async () => {
    const up = apiWith((url) => String(url).endsWith("/api/stock")
      ? Promise.resolve({ ok: true, status: 200, json: async () => ({ items: [{ dish: "A", branch: "B", qty: 3 }] }) })
      : Promise.resolve({ ok: false, status: 404, json: async () => ({}) }));
    expect(await up.stockList()).toEqual([{ dish: "A", branch: "B", qty: 3 }]);

    const down = apiWith(() => Promise.reject(new Error("no backend")));
    expect(await down.stockList()).toBeNull();
  });

  it("stockReserve returns {ok,qty} on 200 and maps 409 to ok:false", async () => {
    const ok200 = apiWith(() => Promise.resolve({
      ok: true, status: 200,
      json: async () => ({ ok: true, dish: "A", branch: "B", qty: 2 }),
    }));
    expect(await ok200.stockReserve("A", "B")).toEqual({ ok: true, qty: 2 });

    const sold = apiWith(() => Promise.resolve({
      ok: false, status: 409,
      json: async () => ({ message: "Sold out — none left at this counter." }),
    }));
    const r = await sold.stockReserve("A", "B");
    expect(r.ok).toBe(false);
    expect(r.status).toBe(409);
    expect(r.error).toBe("Sold out — none left at this counter.");
  });

  it("stockReserve never throws on a network failure — {ok:false,status:0}", async () => {
    const down = apiWith(() => Promise.reject(new Error("offline")));
    const r = await down.stockReserve("A", "B");
    expect(r).toEqual({ ok: false, status: 0, error: "Backend not reachable" });
  });

  it("stockRestock returns null on a dead backend / non-2xx", async () => {
    const down = apiWith(() => Promise.reject(new Error("offline")));
    expect(await down.stockRestock({ all: true })).toBeNull();
    const denied = apiWith(() => Promise.resolve({
      ok: false, status: 403, json: async () => ({ message: "Staff only." }),
    }));
    expect(await denied.stockRestock({ all: true })).toBeNull();
  });
});