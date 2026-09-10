# Naeki Sushi — Bangkok Showcase (Electron)

An unofficial fan-showcase desktop app for **Naeki Sushi & Go!** — Bangkok's premium
grab-and-go onigiri and sushi brand (est. 2013, All Seasons Place).

## Run it

```bash
npm install     # already done in this folder
npm start       # launches the Electron window
```

## What's inside

| View | Contents |
|---|---|
| **Menu** | 38 highlighted dishes across 6 categories (onigiri, nigiri, rolls, sashimi & sets, donburi & bento, drinks & sweets) with real product photography, click-for-story modal, live search, category chips, plus a strip of the other ~54 daily items |
| **Branches** | All 20 Bangkok branches with live **open/closed status** computed against Bangkok time, flagship vs GO! kiosk badges, Google Maps deep links, search |
| **Order & Info** | LINE OA, flagship counter phone, catering line, HQ address, socials |

Also: a live Bangkok clock in the sidebar, real Google-review quotes,
and the actual BTS Siam kiosk photo as the hero.

## Data provenance (researched 10 Sep 2026)

- Menu items, brand story, HQ, branch list & hours: **naeki.co** (official site)
- Photos: **naeki.co official menu photography** (38 files in `assets/`) + the
  BTS Siam kiosk photo from the branch's Google Maps listing
- Ratings, phone numbers, review quotes: Google Maps listings for the branches

Caveats: menu rotates daily and prices vary by branch (naeki.co doesn't publish
prices); hours can change — the app's open/closed status is computed from the
hours listed on naeki.co. This app is **not affiliated** with Naeki Sushi Co., Ltd.

## Stack

- Electron 44, zero runtime dependencies
- Plain HTML/CSS/JS, CSP-restricted (`default-src 'self'`), no node integration in the renderer
- All assets local (works offline)