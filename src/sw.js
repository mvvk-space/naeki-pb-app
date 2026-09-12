/* NAEKI SHOWCASE — service worker (PWA only; Electron never loads this).
   Cache-first app shell + runtime-cached images. The cache name tracks the
   app version — bump both together with the ?v= query in main.js. */
const VERSION = "2.9.0";
const CACHE = `naeki-v${VERSION}`;

const SHELL = [
  "index.html",
  "styles.css",
  "app.js",
  "data.js",
  "frames.js",
  "store.js",
  "manifest.webmanifest",
  "assets/icon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const file = new URL(req.url).pathname.split("/").pop();

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
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || Response.error()))
    );
    return;
  }

  // app shell: cache-first, refresh in the background
  if (SHELL.includes(file)) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const fetchAndPut = fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        });
        return hit || fetchAndPut;
      })
    );
    return;
  }

  // images: cache-first, no background refresh (immutable in practice)
  if (req.destination === "image") {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }))
    );
  }
});