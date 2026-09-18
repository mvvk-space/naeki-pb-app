/* ESM entry for the renderer — imported as a module script from index.html.
   Each file below is still a classic IIFE that attaches to `window`
   (NaekiData, NaekiFrames, NaekiAPI, NaekiStore, NaekiSound, NaekiArt,
   NaekiPalette, NaekiUI), so the load-order contract and the vitest sandbox
   suites are unchanged; the only difference is that Vite now bundles them
   (and everything they grow into — React islands, TS modules) instead of
   the browser fetching seven separate scripts. Order matters: data →
   frames → api → store → sound → art → palette → components → app. */
import "./data.js"
import "./frames.js"
import "./api.js"
import "./store.js"
import "./sound.js"
import "./assets.js"
import "./command-palette.js"
import "./components.js"
import "./journal.js"
import "./app.js"
