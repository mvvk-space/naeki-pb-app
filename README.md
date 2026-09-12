# Naeki Sushi — Bangkok Showcase (Electron + PWA)

An unofficial fan-showcase app for **Naeki Sushi & Go!** — Bangkok's premium
grab-and-go onigiri and sushi brand (est. 2013, All Seasons Place).

One codebase, two shells:

- **Desktop** — Electron (`npm start`)
- **Mobile / web** — installable PWA. Serve `src/` over http(s) (e.g.
  `python3 -m http.server`), open it in Safari on an iPhone, then
  **Share → Add to Home Screen**. Runs full-screen, offline, with a service
  worker for the app shell.

All UI lives in **`src/`** — the Electron main process only wraps it.

## Run it

```bash
npm install     # already done in this folder
npm start       # launches the Electron window

# or, as a website / PWA:
cd src && python3 -m http.server 8000
```

## What's inside

| View | Contents |
|---|---|
| **Menu** | 38 highlighted dishes across 6 categories (onigiri, nigiri, rolls, sashimi & sets, donburi & bento, drinks & sweets) with real product photography, click-for-story modal, live search, category chips, plus a strip of the other ~54 daily items |
| **Branches** | All 20 Bangkok branches with live **open/closed status** computed against Bangkok time, flagship vs GO! kiosk badges, Google Maps deep links, search |
| **Stamp Card** | Local demo loyalty card — collect 10 stamps, redeem a treat, history log. Self-issued; stored only on-device (`localStorage` via `src/store.js`), never sent anywhere |
| **Order & Info** | LINE OA, flagship counter phone, catering line, HQ address, socials |

Also: a live Bangkok clock in the sidebar, real Google-review quotes,
and the actual BTS Siam kiosk photo as the hero.

## Data provenance (researched 10 Sep 2026)

- Menu items, brand story, HQ, branch list & hours: **naeki.co** (official site)
- Photos: **naeki.co official menu photography** (38 files in `src/assets/`) + the
  BTS Siam kiosk photo from the branch's Google Maps listing
- Ratings, phone numbers, review quotes: Google Maps listings for the branches

Caveats: menu rotates daily and prices vary by branch (naeki.co doesn't publish
prices); hours can change — the app's open/closed status is computed from the
hours listed on naeki.co. This app is **not affiliated** with Naeki Sushi Co., Ltd.

## Stack

- Electron 44 (desktop shell only), zero runtime dependencies
- Plain HTML/CSS/JS, CSP-restricted (`default-src 'self'`), no node integration in the renderer
- PWA: `manifest.webmanifest` + service worker (cache version tracks the app version)
- All assets local (works offline); user data (stamps, history) stays on-device

## Future path (deliberately not built)

A real loyalty program — verified stamps, cross-device sync, push notifications —
needs Naeki the brand's involvement (it trades on their name and touches
stored-value/promotions rules, and real push needs a backend + APNs). The code is
shaped for it: `src/store.js` isolates persistence so it can move to
SQLite (Capacitor shell) or a synced backend without UI changes, and a Capacitor
wrapper can reuse `src/` as-is for App Store distribution.