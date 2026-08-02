// Taseer service worker — offline-first shell, lazily-cached illustrations.
// Bump VERSION on ANY shell change (html/css/js/data), or clients keep the old one.
const VERSION = "taseer-v1";
const SHELL = `${VERSION}-shell`;
const IMAGES = `${VERSION}-images`;

// Everything the app needs to run with no network at all. Illustrations are
// deliberately absent — the app must look finished without a single one.
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/app.css",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/apple-touch-icon.png",
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

  // Illustrations: cache-first, filled in as foods are viewed. A miss that fails
  // offline is fine — the card falls back to its emoji glyph.
  if (url.pathname.includes("/food-images/")) {
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
