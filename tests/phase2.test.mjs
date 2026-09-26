import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
globalThis.localStorage = { getItem: () => null, setItem() {} };
globalThis.matchMedia = () => ({ matches: false });
const { preparations, prepsForState, getFood, remedyList } = await import('../assets/js/data.js');
const { prepView, preparationsView, findView, foodView } = await import('../assets/js/views.js');
const { resetPagers, growPager, pagedTileList, pagerSnapshot, restorePagers } = await import('../assets/js/components.js');
const mappings = JSON.parse(readFileSync(new URL('../data/preparation-art.json', import.meta.url)));

test('every preparation has reviewed, real hero and thumbnail mappings and timed steps', () => {
  assert.equal(mappings.length, preparations.length);
  assert.equal(new Set(mappings.map(a => a.id)).size, preparations.length);
  for (const prep of preparations) {
    const art = mappings.find(a => a.id === prep.id);
    assert.equal(art.review, 'reviewed');
    for (const key of ['hero', 'thumb']) {
      assert.equal(prep.art[key], art[key]);
      assert.ok(existsSync(new URL('../' + art[key], import.meta.url)), `${prep.id}/${key}`);
    }
    assert.equal(prep.minutes, prep.timing.prep + prep.timing.cook + prep.timing.rest);
    const detail = prepView(prep.id).html;
    assert.ok(detail.includes(art.hero));
    assert.ok(detail.includes('data-art-state="loading"'));
    assert.ok(detail.includes('Estimated preparation time'));
    assert.ok(detail.includes(`/preparations?state=${prep.state}`));
  }
  assert.equal(preparations.find(p => p.id === 'prep-cucumber-mint-water').minutes, 25);
  assert.equal(preparations.find(p => p.id === 'prep-chicken-congee').minutes, 80);
});

test('preparation library filters by originating state without losing direct links', () => {
  for (const state of ['too-hot', 'too-cold', 'reactive']) {
    const html = preparationsView({state}).html;
    const ids = [...html.matchAll(/data-nav="\/prep\/([^"]+)"/g)].map(m => m[1]);
    assert.deepEqual(ids, prepsForState(state).map(p => p.id));
  }
  assert.equal((preparationsView({state:'invalid'}).html.match(/class="prep-card /g) ?? []).length, 44);
});

test('alias matches and disagreements are explained alongside their readings', () => {
  assert.match(findView({q:'karela'}).html, /Also called karela/);
  assert.match(findView({q:'karela'}).html, /TCM · Ayurveda · Unani/);
  const yogurt = foodView('yogurt').html;
  assert.ok(getFood('yogurt').conflict);
  assert.ok(yogurt.indexOf('The traditions disagree here.') < yogurt.indexOf('class="verdicts"'));
});

test('exhausted pagers retain counts and restore exactly the revealed items', () => {
  const foods = remedyList('too-hot', 'eat', []).slice(0, 70);
  resetPagers();
  pagedTileList(foods);
  while (growPager('pager1')) {}
  const saved = pagerSnapshot();
  assert.equal(saved.pager1, 70);
  resetPagers();
  pagedTileList(foods);
  let appended = '', removed = false;
  const root = { querySelector: selector => selector === '#pager1' ? {
    insertAdjacentHTML: (_, html) => { appended += html; }
  } : { closest: () => ({ remove: () => { removed = true; } }) } };
  restorePagers(root, saved);
  assert.deepEqual([...appended.matchAll(/data-nav="\/food\/([^"]+)"/g)].map(m => m[1]), foods.slice(32).map(f => f.id));
  assert.ok(removed);
  assert.equal(growPager('pager1'), null);
});
