// Taseer service worker — offline-first shell, lazily-cached illustrations.
// VERSION is generated: run `node scripts/stamp-sw.mjs` after any shell change.
// Do not edit it by hand — it hashes worker logic and SHELL_FILES, and CI fails if it's stale.
const VERSION = "taseer-e0ead9efd6";
importScripts("./assets/data/artwork-manifest.js");
// Cache ownership includes the registration path; other GitHub Pages apps on
// this origin keep their own caches. Artwork outlives a shell release.
const SCOPE = self.registration.scope;
const PREFIX = `taseer:${new URL(SCOPE).pathname}:`;
const SHELL = `${PREFIX}${VERSION}-shell`;
const IMAGES = `${PREFIX}art-v1`;
const MAX_IMAGES = 256;
const artworkPath = url => url.startsWith(SCOPE) ? url.slice(SCOPE.length).split("?")[0] : "";
const artworkKey = path => new Request(new URL(`${path}?art=${ARTWORK_VERSIONS[path]}`, SCOPE));
let imageWrites = Promise.resolve();
function rememberArtwork(key, response) {
  imageWrites = imageWrites.catch(() => {}).then(async () => {
    const cache = await caches.open(IMAGES);
    await cache.put(key, response);
    const keys = await cache.keys();
    await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_IMAGES)).map(k => cache.delete(k)));
  });
  return imageWrites.catch(() => {}); // Quota errors must not hide a successful network image.
}

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
  // Same reasoning extended to the rest of the app's UI chrome (not food
  // photography): Home's four state-card icons, the eight category cut-outs
  // (Home/Find's grid and every category page's own hero), and every icon
  // Find's browseBody() other-ways-to-browse list points at (its own ways[]
  // array — the three browse-* icons plus three it borrows from the category/
  // state sets, so read the array itself, not just the obvious icon names, if
  // this list ever needs updating again). Found empirically — a real offline
  // session that reaches Home or Find before any of these happen to be
  // lazily cached (e.g. a fresh install that goes offline right away)
  // rendered these as blank gaps, the exact failure this file's own comment
  // above already describes and solved for the tab bar, just not carried
  // through to the rest of the chrome. Small, fixed-count PNGs (~1 MB total)
  // — nothing like the per-food photography this bucket is otherwise
  // deliberately keeping out of the shell.
  "./assets/ui/states/too-hot.webp",
  "./assets/ui/states/too-cold.webp",
  "./assets/ui/states/reactive.webp",
  "./assets/ui/states/browse.webp",
  "./assets/ui/icons/state-too-hot.png",
  "./assets/ui/icons/state-too-cold.png",
  "./assets/ui/icons/state-reactive.png",
  "./assets/ui/icons/state-balanced.png",
  "./assets/ui/icons/browse-curated.png",
  "./assets/ui/icons/browse-spectrum.png",
  "./assets/ui/icons/browse-compare.png",
  "./assets/ui/icons/category-spices.png",
  "./assets/ui/icons/category-vegetables.png",
  "./assets/ui/icons/category-drinks.png",
  "./assets/ui/categories/dairy.png",
  "./assets/ui/categories/dish.png",
  "./assets/ui/categories/drink.png",
  "./assets/ui/categories/fruit.png",
  "./assets/ui/categories/grain.png",
  "./assets/ui/categories/protein.png",
  "./assets/ui/categories/spice.png",
  "./assets/ui/categories/vegetable.png",
  "./assets/data/foods.js",
  "./assets/js/app.js",
  "./assets/js/data.js",
  "./assets/js/store.js",
  "./assets/js/views.js",
  "./assets/js/components.js",
  "./assets/js/artwork.js",
  "./assets/data/artwork-manifest.js",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting()),
  );
});

async function activateCaches() {
  const names = await caches.keys();
  // One-time migration from earlier releases. Verify bytes against the new
  // manifest before adopting a legacy URL, so changed paintings cannot go stale.
  for (const name of names.filter(n => /^taseer-[a-f0-9]{10}-images$/.test(n))) {
    const old = await caches.open(name);
    const candidates = (await old.keys()).filter(r => ARTWORK_VERSIONS[artworkPath(r.url)]).slice(-MAX_IMAGES);
    for (const request of candidates) {
      const path = artworkPath(request.url);
      const response = await old.match(request);
      if (!response?.ok) continue;
      const hash = await crypto.subtle.digest("SHA-256", await response.clone().arrayBuffer());
      const digest = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
      if (digest === ARTWORK_VERSIONS[path]) await rememberArtwork(artworkKey(path), response);
    }
  }
  const images = await caches.open(IMAGES);
  for (const request of await images.keys()) {
    const path = artworkPath(request.url);
    if (!ARTWORK_VERSIONS[path] || request.url !== artworkKey(path).url) await images.delete(request);
  }
  for (const name of names) {
    if (name.startsWith(PREFIX) && name !== SHELL && name !== IMAGES) await caches.delete(name);
    // Legacy names did not include scope. Delete only if every entry belongs
    // to this registration, rather than sweeping other apps on the origin.
    if (/^taseer-[a-f0-9]{10}-(shell|images)$/.test(name)) {
      const entries = await (await caches.open(name)).keys();
      if (entries.length && entries.every(r => r.url.startsWith(SCOPE))) await caches.delete(name);
    }
  }
  await self.clients.claim();
}
self.addEventListener("activate", event => event.waitUntil(activateCaches()));

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) return;

  const path = artworkPath(url.href);
  if (ARTWORK_VERSIONS[path]) {
    const key = artworkKey(path);
    event.respondWith((async () => {
      const cache = await caches.open(IMAGES);
      const hit = await cache.match(key);
      if (hit) return hit;
      // The content hash also bypasses an old HTTP cache after an artwork edit.
      const response = await fetch(key);
      if (response.ok) await rememberArtwork(key, response.clone());
      return response;
    })());
    return;
  }

  // Shell: cache-first with a background refresh, so an update lands on the next
  // launch rather than blocking this one.
  event.respondWith(
    caches.open(SHELL).then(cache => cache.match(request)).then(hit => {
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
