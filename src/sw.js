/* NAEKI SHOWCASE — service worker (PWA only; Electron never loads this).
   Cache-first app shell + runtime-cached images. The cache name tracks the
   app version — bump both together with the ?v= query in main.js. */
const VERSION = "2.15.0-motion"
const CACHE = `naeki-v${VERSION}`

const SHELL = [
  "index.html",
  "entry.js",
  "styles.css",
  "shadcn.css",
  "app.js",
  "data.js",
  "frames.js",
  "api.js",
  "store.js",
  "sound.js",
  "assets.js",
  "command-palette.js",
  "components.js",
  "journal.js",
  "manifest.webmanifest",
  "offline.html",
  "assets/icon.png"
]

/* best-effort precache: the vendored brand face, so the offline shop
   window (and the app shell) keep Prompt without network. A miss must
   not block the install. */
const FONTS = [
  "assets/fonts/prompt-400.woff2",
  "assets/fonts/prompt-700.woff2"
]

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL))
      .then((c) => Promise.allSettled(FONTS.map((f) => c.add(f))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (e) => {
  const req = e.request
  if (req.method !== "GET") return
  const url = new URL(req.url)
  const file = url.pathname.split("/").pop()

  // OFFLINE SHOP WINDOW — when the device is offline, top-level navigations
  // get the precached line-art storefront (the onigiri reacts to taps)
  // instead of a broken shell. `?tray=1` escapes to the cached app.
  if (req.mode === "navigate" && url.origin === self.location.origin &&
      !self.navigator.onLine && !url.searchParams.has("tray")) {
    e.respondWith(
      caches.match("offline.html", { ignoreSearch: true })
        .then((hit) => hit || Response.error())
    )
    return
  }

  // data.js IS the live backend feed — network-first so business-data edits
  // (hours, menu, reviews) reach installed PWAs without an app-version bump;
  // cache is the offline fallback only.
  if (file === "data.js") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          // clone synchronously, before res is handed to the page and its body
          // is consumed — cloning on a used body throws "body is already used"
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
          }
          return res
        })
        .catch(() => caches.match(req).then((hit) => hit || Response.error()))
    )
    return
  }

  // journal feed — network-first like data.js, so new posts reach installed
  // PWAs without an app-version bump; cache keeps the strip alive offline.
  if (url.pathname === "/rss.xml") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
          }
          return res
        })
        .catch(() => caches.match(req).then((hit) => hit || Response.error()))
    )
    return
  }

  // app shell: cache-first, refresh in the background. Offline, query
  // strings are ignored so the `?tray=1` escape and any `?v=` marks still
  // hit the precached entries; online, exact match keeps ?v= busting.
  if (SHELL.includes(file)) {
    e.respondWith(
      caches.match(req, { ignoreSearch: !self.navigator.onLine }).then((hit) => {
        const fetchAndPut = fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
          }
          return res
        })
        // shell miss + dead network = the worst moment: hand back the
        // shop window for navigations instead of a browser error page
        return hit || fetchAndPut.catch(() =>
          req.mode === "navigate"
            ? caches.match("offline.html", { ignoreSearch: true })
            : Response.error()
        )
      })
    )
    return
  }

  // images + vendored fonts: cache-first, no background refresh
  // (immutable in practice)
  if (req.destination === "image" || req.destination === "font") {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {})
        }
        return res
      }))
    )
  }
})
