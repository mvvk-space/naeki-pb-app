import { defineConfig } from "@playwright/test";

const APP_URL = process.env.NAEKI_APP_URL || "http://127.0.0.1:8931/index.html";
const API_URL = process.env.NAEKI_PB_URL || "http://127.0.0.1:8090/api/health";

export default defineConfig({
  globalSetup: "tests/e2e/global-setup.mjs",
  testDir: "tests/e2e",
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false, // one API server, one seeded world — keep runs serial
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    viewport: { width: 1280, height: 900 },
  },
  // static server for the browser project (the plain-HTML render target).
  // The electron project doesn't use it but the server is harmless either way.
  webServer: {
    command: "python3 -m http.server 8931 --directory src --bind 127.0.0.1",
    url: APP_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
  projects: [
    {
      // full app via Electron (Neon-API-backed flows)
      name: "electron",
      testMatch: /.*\.electron\.spec\.mjs/,
      use: { appUrl: undefined },
    },
    {
      // the same app served as plain HTML in a stock browser — proves the
      // "must still render to HTML" invariant with no Electron around
      name: "web",
      testMatch: /.*\.web\.spec\.mjs/,
      use: { baseURL: APP_URL, appUrl: undefined },
    },
  ],
  metadata: { apiHealth: API_URL },
});