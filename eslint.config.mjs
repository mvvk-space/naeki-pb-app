import houseStyle from "@37signals/eslint-config"
import globals from "globals"

// 37signals house style (basecamp/house-style), with naeki-neon overrides
// layered after it — same pattern the upstream README prescribes.
//
// House style is JS-only: TS files (src/main, src/preload, server/api.ts,
// db/schema.ts, *.config.ts) stay under `tsc` (tsconfig.node.json, strict)
// and are not linted here.
export default [
  {
    ignores: [
      "dist/**",
      "vendor/**",
      "out/**",
      "release/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "src/public/**",
      "node_modules/**"
    ]
  },

  houseStyle,

  // Renderer: browser IIFEs + the ESM entry imported by src/index.html
  {
    files: ["src/**/*.js"],
    languageOptions: { globals: globals.browser }
  },

  // Service worker
  {
    files: ["src/sw.js"],
    languageOptions: { globals: globals.serviceworker }
  },

  // Legacy CommonJS electron entry (what `npm start` runs today)
  {
    files: ["main.js"],
    languageOptions: { sourceType: "commonjs", globals: globals.node }
  },

  // Node scripts, API server, unit + e2e tests
  {
    files: ["scripts/**", "server/**/*.mjs", "tests/**"],
    languageOptions: { globals: globals.node }
  }
]