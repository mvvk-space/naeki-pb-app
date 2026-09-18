/* NAEKI SHOWCASE — service worker (PWA only; Electron never loads this).
   Built bundles are content-hashed, so this SW is hash-agnostic: it
   cache-firsts everything same-origin, network-firsts the HTML shell and
   data, and skips the API origin entirely. */
const VERSION = "2.13.0-electron-vite";
const CACHE = `naeki-v${VERSION}`;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(() => self.skipWaiting()));
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
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API + Google Maps stay live

  // HTML: network-first so deploys reach installed PWAs; cache = offline fallback
  if (req.mode === "navigate" || req.destination === "document") {
    e.respondWith(
      fetch(req)
        .then((res) => {
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

  // everything else (hashed assets, css, images): cache-first, refresh in background
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
});