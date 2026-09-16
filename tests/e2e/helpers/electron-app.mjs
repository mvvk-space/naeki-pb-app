/* Launch the real Electron app with the API server running (started by main.js
   or `npm run api`; globalSetup health-checks :8090 first). Uses a throwaway
   session partition so localStorage starts clean — the suite must see the
   landing shell (signed out) deterministically, run after run. */
import { _electron as electron } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..", "..");

export async function launchApp() {
  const app = await electron.launch({
    args: [root],                       // package.json "main" -> main.js (spawns/uses the API on :8090)
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: "0" },
  });
  const win = await app.firstWindow();
  await win.waitForLoadState("domcontentloaded");
  // splash overlays the landing for a beat; wait it out for clean clicks
  await win.waitForTimeout(2500);
  // belt & braces: force a signed-out landing state even if the partition
  // somehow carried state over (e.g. a reused userData dir)
  await win.evaluate(() => {
    try { localStorage.removeItem("naeki.showcase.v1"); } catch {}
  });
  await win.reload();
  await win.waitForLoadState("domcontentloaded");
  await win.waitForTimeout(1200);
  return { app, win };
}