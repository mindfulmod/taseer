// Taseer service worker — offline-first shell, lazily-cached illustrations.
// VERSION is generated: run `node scripts/stamp-sw.mjs` after any shell change.
// Do not edit it by hand — it is a hash of SHELL_FILES, and CI fails if it's stale.
const VERSION = "taseer-4c2653820e";
const SHELL = `${VERSION}-shell`;
const IMAGES = `${VERSION}-images`;

// Everything the app needs to run with no network at all. Illustrations are
// deliberately absent — the app must look finished without a single one.
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/app.css",
  // The tab pill is the only chrome now, so its four marks have to be here or
  // an offline launch renders a navigation bar with four gaps in it.
  "./assets/ui/icons/tab-feel.png",
  "./assets/ui/icons/tab-search.png",
  "./assets/ui/icons/tab-browse.png",
  "./assets/ui/icons/tab-me.png",
  "./assets/ui/taseer-mark.png",
  "./assets/data/foods.js",
  "./assets/js/app.js",
  "./assets/js/data.js",
  "./assets/js/store.js",
  "./assets/js/views.js",
  "./assets/js/components.js",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Artwork: cache-first, filled in as it is viewed — heroes, the row thumbs
  // that replaced the emoji glyphs, and the per-screen icons and cut-outs.
  // A miss that fails offline is fine: thumbs fall back to the emoji underneath
  // them, and the rest is decoration. Kept out of the shell bucket so a version
  // bump does not re-download megabytes of art.
  if (
    url.pathname.includes("/food-images/") ||
    url.pathname.includes("/food-thumbs/") ||
    url.pathname.includes("/assets/ui/")
  ) {
    event.respondWith(
      caches.match(request).then(
        hit =>
          hit ??
          fetch(request).then(response => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(IMAGES).then(cache => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Shell: cache-first with a background refresh, so an update lands on the next
  // launch rather than blocking this one.
  event.respondWith(
    caches.match(request).then(hit => {
      const network = fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => hit);
      return hit ?? network;
    }),
  );
});
