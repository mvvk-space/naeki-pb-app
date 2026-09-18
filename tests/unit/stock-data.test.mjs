/* Live stock hydration in data.js: pbHydrate() fills STOCK from
   /api/stock; stockAt() resolves by name; a dead API leaves the ledger
   alone (empty → the UI hides badges rather than faking them). */
import { describe, it, expect } from "vitest";
import { makeSandbox } from "../helpers/sandbox.mjs";

const ROWS = [
  { dish: "Salmon Nigiri", branch: "Naeki Sushi @ BTS Siam", qty: 4 },
  { dish: "Iced Matcha", branch: "Naeki Go! @ BTS Asok", qty: 0 },
];

async function hydrateWith(sandbox, responder) {
  sandbox.fetch = responder;
  await sandbox.window.NaekiData.refresh();
  await new Promise(r => setTimeout(r, 25));   // pbHydrate() is fire-and-forget
}

describe("stock hydration (data.js)", () => {
  it("fills STOCK and resolves stockAt by (dish, branch) name", async () => {
    const sb = makeSandbox({ files: ["data.js"] });
    sb.fetch = (url) => {
      if (String(url).endsWith("/api/stock"))
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ items: ROWS }) });
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ items: [] }) });
    };
    await sb.window.NaekiData.refresh();
    await new Promise(r => setTimeout(r, 25));

    const D = sb.window.NaekiData;
    expect(D.STOCK).toHaveLength(2);
    expect(D.stockAt("Salmon Nigiri", "Naeki Sushi @ BTS Siam")).toEqual({
      dish: "Salmon Nigiri", branch: "Naeki Sushi @ BTS Siam", qty: 4,
    });
    expect(D.stockAt("Salmon Nigiri", "Naeki Go! @ BTS Asok")).toBeNull();
  });

  it("coerces missing qty to 0", async () => {
    const sb = makeSandbox({ files: ["data.js"] });
    sb.fetch = (url) => String(url).endsWith("/api/stock")
      ? Promise.resolve({ ok: true, status: 200, json: async () => ({ items: [{ dish: "X", branch: "Y" }] }) })
      : Promise.resolve({ ok: true, status: 200, json: async () => ({ items: [] }) });
    await sb.window.NaekiData.refresh();
    await new Promise(r => setTimeout(r, 25));
    expect(sb.window.NaekiData.stockAt("Y", "Y")).toBeNull();   // name mismatch → no row
    expect(sb.window.NaekiData.stockAt("X", "Y").qty).toBe(0);
  });

  it("a dead API leaves STOCK empty (badges hide, nothing faked)", async () => {
    const sb = makeSandbox({ files: ["data.js"] });
    sb.fetch = () => Promise.reject(new Error("api down"));
    await sb.window.NaekiData.refresh().catch(() => {});
    await new Promise(r => setTimeout(r, 25));
    expect(sb.window.NaekiData.STOCK).toHaveLength(0);
    expect(sb.window.NaekiData.stockAt("Salmon Nigiri", "Naeki Sushi @ BTS Siam")).toBeNull();
  });
});