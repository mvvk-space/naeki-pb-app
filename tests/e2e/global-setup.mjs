/* Global setup for Playwright runs: require a healthy API server on :8090.
   `npm run api` (or `npm start`, which spawns it) keeps it running; the
   e2e suite refuses to guess — if the API is down, the run fails fast. */
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
      `[naeki-e2e] The API server is not reachable at ${base}.\n` +
      `Start it first:  npm run api`
    );
  }
  // the seeded demo accounts the flows rely on
  const r = await fetch(`${base}/api/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "kate@naeki.dev", password: "Kate$12345" }),
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) {
    throw new Error(
      `[naeki-e2e] The API is up but sign-in failed (HTTP ${r.status}) — check the Neon users table.\n` +
      `DSN: ~/.config/neon/naeki-sushi.dsn  (schema: db/app-schema.sql, data: db/app-data.sql)`
    );
  }
  fs.writeFileSync(path.join(root, "tests", "e2e", ".api-ready"), "ok");
}