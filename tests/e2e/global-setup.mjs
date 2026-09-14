/* Global setup for Playwright runs: require a healthy PocketBase on :8090.
   The dev workflow keeps PB running (npm run pb); the e2e suite refuses to
   guess — if PB is down, the run fails fast with an explicit message. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..", "..");

export default async function globalSetup() {
  const base = process.env.NAEKI_PB_URL || "http://127.0.0.1:8090";
  let healthy = false;
  try {
    const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(3000) });
    healthy = r.ok;
  } catch {}
  if (!healthy) {
    throw new Error(
      `[naeki-e2e] PocketBase is not reachable at ${base}.\n` +
      `Start it first:  npm run pb   (or: npm run pb:init for a fresh superuser + serve)`
    );
  }
  // the seeded demo accounts the flows rely on
  const r = await fetch(`${base}/api/collections/users/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: "kate@naeki.dev", password: "Kate$12345" }),
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) {
    throw new Error(
      `[naeki-e2e] PocketBase is up but the seeded users are missing (kate login failed, HTTP ${r.status}).\n` +
      `Run: npm run seed`
    );
  }
  fs.writeFileSync(path.join(root, "tests", "e2e", ".pb-ready"), "ok");
}