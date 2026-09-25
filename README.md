# Naeki Sushi — Bangkok Showcase (Electron + PWA)

An unofficial fan-showcase app for **Naeki Sushi & Go!** — Bangkok's premium grab-and-go onigiri and sushi brand (est. 2013, All Seasons Place).

One codebase, two shells:

- **Desktop** — Electron (`npm start`)
- **Mobile / web** — installable PWA. Serve `src/` over http(s), open it in Safari on an iPhone.

**Repository:** [mvvk-space/naeki-pb-app](https://github.com/mvvk-space/naeki-pb-app)

## What's here

- Electron + electron-vite app shell, with electron-builder packaging config
- `src/` — the shared app code (the PWA)
- `server/`, `db/` — server and database pieces (Drizzle ORM)
- `roadmap-board.html` — the production kanban roadmap ("Naeki · Production Kanban")
- `glitch_pulse.py` — a glitch-pulse visual effect script
- `blog/` — blog content
- Playwright + Vitest test setups

## Running it

```sh
npm install
npm start    # Electron app
```

See the full README for PWA serving, tests, and roadmap details.