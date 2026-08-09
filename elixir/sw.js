/* Elixir service worker.
   ---------------------------------------------------------------------------
   Strategy: network-first with a short timeout, falling back to cache.

   Network-first means a deploy is picked up on the next load, so a phone never
   sits on a stale build — that was the whole reason for choosing it. The
   timeout is the addition: on a slow or half-connected network the old
   behaviour was to hang waiting for a response that would never come. Three
   seconds in, we stop waiting and serve the cached copy, then quietly refresh
   the cache when the real response eventually arrives.

   Bump CACHE whenever you deploy. Old caches are deleted on activate.
   --------------------------------------------------------------------------- */

const CACHE = "elixir-v5";
const TIMEOUT = 3000;

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/tokens.css",
  "./css/app.css",
  "./data/bank.js",
  "./js/sync-config.js",
  "./js/sync.js",
  "./js/state.js",
  "./js/scheduler.js",
  "./js/plan.js",
  "./js/ui.js",
  "./js/views.js",
  "./js/drill.js",
  "./js/cards.js",
  "./js/app.js",
  "./icon.svg",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(req);

      const fromNetwork = fetch(req).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });

      /* Race the network against the clock. If the clock wins and we hold a
         cached copy, serve that — the network response still lands in the
         cache for next time. */
      if (cached) {
        const timeout = new Promise((resolve) => setTimeout(() => resolve(null), TIMEOUT));
        const winner = await Promise.race([fromNetwork.catch(() => null), timeout]);
        return winner || cached;
      }

      try {
        return await fromNetwork;
      } catch (e) {
        /* Offline, uncached, and a navigation: hand back the app shell so the
           PWA opens instead of showing a browser error page. */
        if (req.mode === "navigate") {
          const shell = await caches.match("./index.html");
          if (shell) return shell;
        }
        throw e;
      }
    })()
  );
});
