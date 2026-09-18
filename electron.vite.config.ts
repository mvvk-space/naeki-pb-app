import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin } from 'vite'

/* Dev-only CSP: Vite's dev server injects inline scripts (react-refresh) and
   <style> tags, and its HMR client needs a WebSocket. The production CSP in
   src/index.html stays strict (external files only) — this plugin rewrites
   the meta tag only when a dev server is attached. */
const DEV_CSP = [
  "default-src 'self'",
  "img-src 'self' data: https://www.google.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "connect-src 'self' ws://127.0.0.1:5173 http://127.0.0.1:5173 http://127.0.0.1:8090",
  "frame-src https://www.google.com",
  "object-src 'none'",
].join('; ')

function devCsp(): Plugin {
  return {
    name: 'naeki:dev-csp',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (!ctx.server) return html
        return html.replace(
          /<meta http-equiv="Content-Security-Policy"[^>]*>/,
          `<meta http-equiv="Content-Security-Policy" content="${DEV_CSP}" />`,
        )
      },
    },
  }
}

export default defineConfig({
  /* main build produces out/main/index.js (Electron entry) AND
     out/main/api.js (the :8090 API server, spawned by the main process with
     ELECTRON_RUN_AS_NODE) — one build, no separate server toolchain. */
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          api: resolve(__dirname, 'server/api.ts'),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: 'src',
    plugins: [react(), tailwindcss(), devCsp()],
    build: {
      outDir: 'out/renderer',
      emptyOutDir: true,
    },
  },
})