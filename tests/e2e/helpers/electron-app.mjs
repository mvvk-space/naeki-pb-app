/* Launch the real Electron app with PocketBase running (started in globalSetup). */
import { _electron as electron } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");

export async function launchApp() {
  const app = await electron.launch({
    args: [root],                       // package.json "main" -> main.js (spawns/uses PB on :8090)
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: "0" },
  });
  const win = await app.firstWindow();
  await win.waitForLoadState("domcontentloaded");
  // splash overlays the landing for a beat; wait it out for clean clicks
  await win.waitForTimeout(2500);
  return { app, win };
}