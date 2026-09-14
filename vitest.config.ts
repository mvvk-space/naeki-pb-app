import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.mjs"],
    environment: "node",
    // store.js/data.js are browser IIFEs run in a vm sandbox — no imports, no DOM
    globals: false,
  },
});