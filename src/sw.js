/* NAEKI SHOWCASE — service worker (PWA only; Electron never loads this).
   Cache-first app shell + runtime-cached images. The cache name tracks the
   app version — bump both together with the ?v= query in main.js. */
const VERSION = "1.4.0";
const CACHE = `naeki-v${VERSION}`;

const SHELL = [
  "index.html",
  "styles.css",
  "app.js",
  "menu-data.js",
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

  // app shell: cache-first, refresh in the background
  if (SHELL.includes(new URL(req.url).pathname.split("/").pop())) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const fetchAndPut = fetch(req).then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
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
        if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone()));
        return res;
      }))
    );
  }
});