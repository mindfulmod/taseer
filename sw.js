// Taseer service worker — offline-first shell, lazily-cached illustrations.
// VERSION is generated: run `node scripts/stamp-sw.mjs` after any shell change.
// Do not edit it by hand — it is a hash of SHELL_FILES, and CI fails if it's stale.
const VERSION = "taseer-ac5ddf3d71";
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

  // Artwork: cache-first, filled in as it is viewed — food heroes and thumbs,
  // plus any /assets/ui/ file not already in the shell precache above (most
  // now are; this branch still runs for all of them, but caches.match() finds
  // those instantly with no network, same as anything else already cached).
  // A miss that fails offline is fine for what's left here: food thumbs fall
  // back to the emoji underneath them, and the rest is decoration. Food
  // photography specifically is kept out of the shell bucket so a version
  // bump does not re-download megabytes of it.
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
