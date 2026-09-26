import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => null, setItem() {} };
let desktop = false;
globalThis.matchMedia = () => ({ matches: desktop });
const views = await import('../assets/js/views.js');
const { getFood, remedyList, SORTS } = await import('../assets/js/data.js');
const { resetPagers, growPager, pagedTileList, PAGE_SIZE } = await import('../assets/js/components.js');
const { artwork, startArtwork } = await import('../assets/js/artwork.js');
const rows = html => [...html.matchAll(/data-nav="\/food\/([^"]+)"/g)].map(m => m[1]);

test('mobile remedy renders just the requested tab within one total row budget', () => {
  desktop = false;
  for (const state of ['too-hot', 'too-cold', 'reactive']) {
    for (const list of ['eat', 'avoid']) {
      for (const sort of ['', ...Object.keys(SORTS)]) {
        resetPagers();
        const html = views.stateView(state, { list, sort }).html;
        assert.ok(rows(html).length <= PAGE_SIZE, `${state}/${list}/${sort}`);
        assert.ok(rows(html).length > 0);
        assert.equal((html.match(/data-col=/g) ?? []).length, 1);
        assert.ok(html.includes(`data-col="${list}"`));
        assert.ok(rows(html).every(id => remedyList(state, list, []).some(f => f.id === id)));
      }
    }
  }
});

test('desktop has both independently bounded columns; category groups share a budget', () => {
  desktop = true;
  resetPagers();
  const html = views.stateView('too-hot').html;
  assert.equal((html.match(/data-col=/g) ?? []).length, 2);
  assert.equal(rows(html).length, PAGE_SIZE * 2);
  for (const sort of Object.keys(SORTS)) {
    resetPagers();
    assert.ok(rows(views.categoryView('dish', { sort }).html).length <= PAGE_SIZE);
  }
  desktop = false;
});

test('deferred bands and subsequent pages reveal every item without duplicates', () => {
  resetPagers();
  const foods = remedyList('too-hot', 'eat', []);
  const html = pagedTileList(foods, undefined, { remaining: 0 });
  assert.equal(rows(html).length, 0);
  const id = html.match(/data-id="([^"]+)"/)[1];
  const received = [];
  let page;
  while ((page = growPager(id))) {
    assert.ok(rows(page.html).length <= PAGE_SIZE);
    received.push(...rows(page.html));
  }
  assert.deepEqual(received, foods.map(f => f.id));
  resetPagers();
  assert.equal(growPager(id), null);
});

test('Find leads with categories; source status qualifies each food headline', () => {
  const html = views.findView({}).html;
  assert.ok(html.indexOf('By category') < html.indexOf('Explore more'));
  const banana = views.foodView('banana').html;
  assert.ok(banana.includes('Differs from SIGHI · not yet reviewed'));
  assert.ok(banana.indexOf('data-act="source-detail"') < banana.indexOf('id="source-detail"'));
});

test('artwork reserves dimensions, keeps fallback decorative, and prioritizes the hero', () => {
  const food = getFood('banana');
  const thumb = artwork(food, 'tile__glyph');
  assert.match(thumb, /data-art-state="loading" aria-hidden="true"/);
  assert.match(thumb, /width="320" height="320"/);
  assert.doesNotMatch(thumb, /onerror|onload/);
  const hero = artwork(food, 'art', { hero: true, src: 'assets/food-images/banana.webp' });
  assert.match(hero, /loading="eager" decoding="async" fetchpriority="high"/);
});

test('decode controls ready/error states; cached thumbnails bridge a later hero', async () => {
  const handlers = {};
  let observer;
  globalThis.MutationObserver = class { constructor(cb) { observer = cb; } observe() {} };
  globalThis.innerHeight = 844;
  globalThis.innerWidth = 390;
  const wrapper = { dataset: { artState: 'loading' } };
  let finishDecode;
  const image = {
    matches: selector => selector === '[data-art-image]', complete: false,
    naturalWidth: 320, isConnected: true, loading: 'lazy',
    closest: () => wrapper, getAttribute: () => 'assets/food-thumbs/banana.webp',
    getClientRects: () => [{}], getBoundingClientRect: () => ({ top: 400, bottom: 450, left: 16, right: 66 }),
    decode: () => new Promise(resolve => { finishDecode = resolve; }),
  };
  const root = { addEventListener: (name, cb) => { handlers[name] = cb; }, querySelectorAll: () => [image] };
  startArtwork(root);
  assert.equal(image.loading, 'eager');
  assert.equal(wrapper.dataset.artState, 'loading');
  image.complete = true;
  handlers.load({ target: image });
  assert.equal(wrapper.dataset.artState, 'loading');
  finishDecode();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(wrapper.dataset.artState, 'ready');
  assert.match(artwork(getFood('banana'), 'art', { hero: true }), /artwork__preview/);

  const failedWrapper = { dataset: { artState: 'loading' } };
  const failed = { ...image, naturalWidth: 0, closest: () => failedWrapper };
  handlers.error({ target: failed });
  assert.equal(failedWrapper.dataset.artState, 'error');
  observer(); // repeated inspections must not regress settled images
  assert.equal(wrapper.dataset.artState, 'ready');
  let removed = false;
  handlers.error({ target: {
    matches: selector => selector === '.artwork__preview',
    getAttribute: () => 'assets/food-thumbs/banana.webp',
    remove: () => { removed = true; },
  } });
  assert.equal(removed, true);
  assert.doesNotMatch(artwork(getFood('banana'), 'art', { hero: true }), /artwork__preview/);
});
