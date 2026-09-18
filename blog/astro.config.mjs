// Naeki blog — isolated Astro site.
// Deliberately self-contained: its own package.json / node_modules / build
// output live under blog/, so the Electron app at the repo root is untouched.
// The app's palette is ported into src/styles/global.css; no files under
// ../src are imported or modified.
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://naeki.example.com",
  integrations: [react(), sitemap()],
  // No build-time image optimization: posts use the pre-sized brand logo, so
  // we skip the sharp dependency (which needs native build tooling).
  image: { service: { entrypoint: "astro/assets/services/noop" } },
  vite: {
    plugins: [tailwindcss()],
  },
});
