---
title: "Why the journal lives outside the app"
description: "The showcase app stays a vanilla-JS, offline-first PWA wrapped in Electron. The blog is a separate Astro site. Here's the seam between them."
pubDate: 2026-09-18
author: Naeki Team
tags: ["meta", "engineering"]
draft: true
---

The Naeki showcase is one codebase with two shells: an Electron desktop window
and an installable PWA. Both are served from `src/` as plain HTML/CSS/JS, with a
Neon-backed API at `server/api.mjs`. It is deliberately dependency-light and
works offline.

A journal has different needs than an app. Posts are prose, not state. They want
Markdown, a feed, and a sitemap — not a service worker and a Postgres session.
So the blog is its own Astro site under `blog/`, and the two meet at a link.

## What that buys us

- **Markdown, not markup.** A post is a file. Frontmatter is validated by a
  content-collection schema, so a typo fails the build instead of shipping.
- **Static by default.** The output is HTML. No client JS ships for a post
  unless a component actually needs to be interactive.
- **React where it helps.** The interactive pieces are real shadcn/ui
  components — the same recipes the app hand-ported — so the look is shared and
  the code is borrowed, not rewritten.
- **One brand.** The palette is ported verbatim from the app's `:root`, down to
  the gold `#CC9A3D` and the orange→coral wash.

> Everything the app already does — auth, cart, loyalty, the partner portal —
> is untouched by this site. That is the point of isolating it.

## Writing a post

Drop a `.md` file in `src/content/blog/` with a title, description, and date.
The index, the post route, and the RSS feed all pick it up on the next build.

```bash
cd blog
npm install
npm run dev     # write at localhost:4321
npm run build   # static output in blog/dist/
```

That's the whole workflow.
