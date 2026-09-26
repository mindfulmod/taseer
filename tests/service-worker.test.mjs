// Execute the real worker lifecycle against an in-memory Cache API. This covers
// upgrades and offline failures without depending on a browser's persistent state.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
const worker = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const scope = 'https://example.test/taseer/';
const food = 'assets/food-thumbs/banana.webp';
const version = body => createHash('sha256').update(body).digest('hex').slice(0, 16);
const urlOf = request => typeof request === 'string' ? new URL(request, scope).href : request.url;
function storage() {
  const buckets = new Map();
  return {
    keys: async () => [...buckets.keys()],
    delete: async name => buckets.delete(name),
    open: async name => {
      if (!buckets.has(name)) buckets.set(name, new Map());
      const entries = buckets.get(name);
      return {
        keys: async () => [...entries.keys()].map(url => new Request(url)),
        match: async request => entries.get(urlOf(request))?.clone(),
        put: async (request, response) => { entries.set(urlOf(request), response.clone()); },
        delete: async request => entries.delete(urlOf(request)),
        addAll: async () => {},
      };
    },
  };
}
function boot(caches, manifest, fetcher, release) {
  const events = {};
  const context = vm.createContext({ caches, Request, Response, URL, Uint8Array, crypto: webcrypto,
    fetch: fetcher,
    self: { registration: { scope }, location: { origin: new URL(scope).origin },
      addEventListener: (name, fn) => { events[name] = fn; }, clients: { claim: async () => {} }, skipWaiting: async () => {} },
    importScripts: () => { context.ARTWORK_VERSIONS = manifest; },
  });
  vm.runInContext(release ? worker.replace(/const VERSION = "[^"]*";/, `const VERSION = "${release}";`) : worker, context);
  return {
    activate: () => { let work; events.activate({ waitUntil: promise => { work = promise; } }); return work; },
    request: path => { let result; events.fetch({ request: new Request(new URL(path, scope)), respondWith: p => { result = p; } }); return result; },
  };
}

test('shell updates preserve viewed artwork offline and leave another app cache intact', async () => {
  const caches = storage();
  await (await caches.open('another-app')).put(scope + 'other', new Response('keep'));
  const manifest = { [food]: version('painting') };
  const first = boot(caches, manifest, async () => new Response('painting'));
  assert.equal(await (await first.request(food)).text(), 'painting');
  const previousShell = 'taseer:/taseer/:taseer-0123456789-shell';
  await (await caches.open(previousShell)).put(scope, new Response('old shell'));
  const next = boot(caches, manifest, async () => { throw new Error('offline'); }, 'taseer-fedcba9876');
  await next.activate();
  assert.equal(await (await next.request(food)).text(), 'painting');
  assert.ok((await caches.keys()).includes('another-app'));
  assert.ok(!(await caches.keys()).includes(previousShell));
});

test('changed artwork invalidates the old hash and fetches the new content URL', async () => {
  const caches = storage();
  await boot(caches, { [food]: version('old') }, async () => new Response('old')).request(food);
  let fetched;
  const next = boot(caches, { [food]: version('new') }, async request => { fetched = request.url; return new Response('new'); });
  await next.activate();
  assert.equal(await (await next.request(food)).text(), 'new');
  assert.ok(fetched.endsWith(`?art=${version('new')}`));
  const art = await caches.open('taseer:/taseer/:art-v1');
  assert.equal((await art.keys()).length, 1);
});

test('legacy images migrate only if bytes match; other scope legacy caches survive', async () => {
  const caches = storage();
  const old = await caches.open('taseer-0123456789-images');
  await old.put(scope + food, new Response('painting'));
  const other = await caches.open('taseer-abcdef0123-shell');
  await other.put('https://example.test/other/index.html', new Response('other'));
  const app = boot(caches, { [food]: version('painting') }, async () => { throw new Error('offline'); });
  await app.activate();
  assert.equal(await (await app.request(food)).text(), 'painting');
  assert.ok(!(await caches.keys()).includes('taseer-0123456789-images'));
  assert.ok((await caches.keys()).includes('taseer-abcdef0123-shell'));

  const stale = storage();
  await (await stale.open('taseer-0123456789-images')).put(scope + food, new Response('wrong painting'));
  const changed = boot(stale, { [food]: version('painting') }, async () => { throw new Error('offline'); });
  await changed.activate();
  await assert.rejects(changed.request(food), /offline/);
});

test('failed responses are not cached; artwork storage remains bounded', async () => {
  const caches = storage();
  const bad = boot(caches, { [food]: version('painting') }, async () => new Response('missing', { status: 404 }));
  assert.equal((await bad.request(food)).status, 404);
  assert.equal((await (await caches.open('taseer:/taseer/:art-v1')).keys()).length, 0);
  const manifest = Object.fromEntries(Array.from({ length: 270 }, (_, i) => [`assets/food-thumbs/${i}.webp`, version(String(i))]));
  const app = boot(caches, manifest, async request => new Response(request.url));
  await Promise.all(Object.keys(manifest).map(path => app.request(path)));
  assert.equal((await (await caches.open('taseer:/taseer/:art-v1')).keys()).length, 256);
});

test('preparation heroes and thumbnails use versioned offline artwork caching', async () => {
  const paths = ['assets/prep-images/prep-cucumber-mint-water.webp', 'assets/prep-thumbs/prep-cucumber-mint-water.webp'];
  const caches = storage();
  const manifest = Object.fromEntries(paths.map(path => [path, version(path)]));
  const online = boot(caches, manifest, async request => new Response(new URL(request.url).pathname.split('/taseer/')[1]));
  for (const path of paths) assert.equal(await (await online.request(path)).text(), path);
  const offline = boot(caches, manifest, async () => { throw new Error('offline'); }, 'taseer-next');
  await offline.activate();
  for (const path of paths) assert.equal(await (await offline.request(path)).text(), path);
});
