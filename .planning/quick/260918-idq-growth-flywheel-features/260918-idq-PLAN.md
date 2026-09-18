---
quick_id: 260918-idq
status: planned
mode: quick
---

# Quick Task: Growth Flywheel Features

Business goal: the app must *demonstrate* the flywheel — wallet → notifications →
referrals → content → data signals → better offers — as working, cohesive features.

## Tasks

### 1. Command palette (⌘K / Ctrl-K) — the omarchy layer
Keyboard-first navigation + actions across the app, omarchy spirit.
- `src/command-palette.js` (new IIFE, same pattern as store.js): fuzzy search over
  actions — navigate (Menu/Cart/Rewards tabs + segments, Chat, Portal), dish search
  (jumps to menu + opens modal), branch search (jumps to branches + subscribes),
  rewards actions (add stamp, top-up chips, generate referral code), offers (open feed).
- Trigger: Ctrl/Cmd+K, Esc closes, ↑↓ navigate, Enter runs, click runs. Backdrop.
- A11y: role="dialog" aria-modal, aria-activedescendant listbox pattern.
- Register in index.html before app.js; CSP is 'self' — no inline handlers.
- Style: .cp-* block in styles.css using brand tokens (gold, ink, gradient accent).

### 2. Signals engine — honest first-party data mining (src/data.js + app.js)
- `SIGNALS` in data.js: declared (homeStation, jobField, interests, wakeWindow),
  observed (device, screenMinutes, orderHours, visitedBranches, avgTicket) + `signalsProfile(history, subs)` composer.
- "Your Naeki profile" pane in Rewards > Milestones (or own block): shows what the
  app knows, each row with a "powers X" explainer (offers timing, referral card pick,
  weekly mission difficulty), export (JSON download via blob) + wipe buttons.
- Declared signals: 3-step chip form (station picker from BRANCHES areas, job field
  chips: office/creative/tech/healthcare/student/field, interests: salmon/spicy/light/matcha).
- Feeds offers(): timing (wakeWindow → "breakfast window" offer), interests → affinity tag.

### 3. Referral share-card creator (canvas) — the content incentive
- `makeShareCard(name, code, dish)`: 1080×1350 canvas — ink bg, gold logo mark text,
  dish image, "NK-FRIEND-…" code, tagline "Grab sushi. Keep moving."
- Milestones pane: "Make your invite card" → pick dish (top 3 from history or featured),
  generate → preview + download (a[download]) + "Share to LINE/Facebook" links
  (web share intents) + copies code.
- Card image doubles as the content users post — the referral loop's fuel.

### 4. Notification "moments" — the bell becomes a story (data.js + app.js)
- `MOMENTS`: lifecycle hooks → bell entries with richer copy: welcome (first visit),
  first-order thank-you, streak save ("you haven't been in 3 days — usual on us"),
  payday Friday, birthday-month, tier-up. Composed in offers()/moments() from history+signals.
- Offer popup + offers pane: moment cards get a distinct kicker style (gold gradient dot).

## Verify
- npm run check (file validation), npm test (vitest), npm run check:mobile.
- Manual: Ctrl+K palette on landing + app; profile pane renders; card downloads;
- moment entries appear in offers feed.
