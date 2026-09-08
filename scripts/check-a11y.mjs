// Hand-run regression checks for three specific accessibility patterns found
// by hand during the scroll-reach thread's screen-reader pass (round 19) and
// its arrow-key/focus follow-up (round 20):
//   1. A skipped heading level (e.g. h1 straight to h3, no h2) on a screen.
//   2. A <button> with no accessible name (no aria-label and no visible
//      text once tags are stripped).
//   3. chip()'s trigger ring (app.css .chip--trigger) — a colour-only
//      state — losing its text/ARIA equivalent.
//
// This is NOT a general accessibility linter — it checks exactly the 2-3
// shapes of bug round 19 already found and fixed, as a cheap way to catch a
// regression, in the same spirit as check-palette.mjs. It renders every
// screen by calling the real view functions directly in Node (no browser,
// no DOM) and scans the resulting HTML strings.
//
// Not wired into anything — CLAUDE.md only lists it as one more script to
// run by hand alongside the other four.
//   node scripts/check-a11y.mjs

// views.js -> components.js -> store.js reads localStorage lazily (only
// inside toggle()/has(), never at import time) — a tiny in-memory stand-in
// is enough to let check 3 mark a food as a trigger.
globalThis.localStorage = (() => {
  const d = new Map();
  return {
    getItem: k => (d.has(k) ? d.get(k) : null),
    setItem: (k, v) => d.set(k, String(v)),
    removeItem: k => d.delete(k),
    clear: () => d.clear(),
  };
})();

const views = await import("../assets/js/views.js");
const data = await import("../assets/js/data.js");
const components = await import("../assets/js/components.js");
const { triggers } = await import("../assets/js/store.js");

const problems = [];

// ---- Render every screen ---------------------------------------------
const screens = [];
const add = (name, view) => screens.push({ name, html: view.html });

add("home", views.homeView());
add("find (bare)", views.findView({}));
add("find (query)", views.findView({ q: "ginger" }));
add("guna", views.gunaView());
add("caffeine", views.caffeineView());
add("bloating", views.bloatingView());
add("mechanism index", views.mechanismIndexView());
for (const id of data.MECHANISM_IDS) add(`mechanism/${id}`, views.mechanismView(id));
add("effect index", views.effectIndexView());
for (const id of data.EFFECT_IDS) add(`effect/${id}`, views.effectView(id));
add("lists", views.listsView());
add(`list/${data.LISTS[0].id}`, views.listView(data.LISTS[0].id));
add(`prep/${data.preparations[0].id}`, views.prepView(data.preparations[0].id));
for (const cat of data.CATEGORIES) add(`category/${cat.id}`, views.categoryView(cat.id));
add("compare (bare)", views.compareView({}));
add("spectrum (overview)", views.spectrumView({}));
for (const band of data.BANDS) add(`spectrum?band=${band.id}`, views.spectrumView({ band: band.id }));
add("me", views.meView());
for (const stateId of Object.keys(data.STATES)) {
  add(`state/${stateId} (eat)`, views.stateView(stateId, { list: "eat" }));
  add(`state/${stateId} (avoid)`, views.stateView(stateId, { list: "avoid" }));
}
add("food/ginger", views.foodView("ginger"));
add("not found", views.notFound("page"));

// ---- Check 1: heading level skip --------------------------------------
// Effective level = the aria-level override if present (see foodView/
// prepView's role="heading" aria-level="2" on their h3s), else the tag's
// own number. A jump of more than one level deeper than the previous
// heading seen (in source/DOM order) is a skip.
function checkHeadings(name, html) {
  const tagRe = /<h([1-6])\b([^>]*)>/gi;
  let m;
  let prev = 0;
  while ((m = tagRe.exec(html))) {
    const override = /aria-level="(\d)"/.exec(m[2]);
    const level = override ? Number(override[1]) : Number(m[1]);
    if (prev > 0 && level > prev + 1) {
      problems.push(`[heading skip] ${name}: h${prev} → effective h${level} (jumped ${level - prev - 1} level(s))`);
    }
    prev = level;
  }
}

// ---- Check 2: button with no accessible name ---------------------------
// Non-greedy <button>…</button> match — safe here because the app never
// nests a <button> inside another <button>.
function checkButtonNames(name, html) {
  const btnRe = /<button\b([^>]*)>([\s\S]*?)<\/button>/g;
  let m;
  while ((m = btnRe.exec(html))) {
    const [, attrs, inner] = m;
    if (/aria-label="[^"]+"/.test(attrs) || /aria-labelledby="[^"]+"/.test(attrs)) continue;
    const text = inner.replace(/<[^>]+>/g, "").replace(/&[a-z#0-9]+;/gi, " ").trim();
    if (!text) {
      const snippet = m[0].slice(0, 80).replace(/\s+/g, " ");
      problems.push(`[no accessible name] ${name}: ${snippet}…`);
    }
  }
}

for (const { name, html } of screens) {
  checkHeadings(name, html);
  checkButtonNames(name, html);
}

// ---- Check 3: chip() trigger ring keeps its text/ARIA equivalent -------
// .chip--trigger (app.css) is a pure colour ring; chip() (components.js) is
// expected to also append a `.sr` "one of your triggers" text node whenever
// that class is present, so a screen reader gets the same information a
// sighted reader gets from the ring's colour alone.
{
  const food = data.getFood("ginger");
  if (!food) {
    problems.push(`[chip trigger check] couldn't look up a sample food ("ginger") to test with`);
  } else {
    // class="…" only — components.js's own explanatory HTML comment mentions
    // "chip--trigger" by name too, so a bare substring test would match that
    // instead of the actual class attribute.
    const hasClass = html => /class="[^"]*\bchip--trigger\b[^"]*"/.test(html);

    const plain = components.chip(food);
    if (hasClass(plain)) problems.push(`[chip trigger check] "ginger" chip already marked chip--trigger before the test toggled it — test isn't isolated`);

    triggers.toggle(food.id);
    const marked = components.chip(food);
    const hasRing = hasClass(marked);
    const hasText = /one of your triggers/i.test(marked.replace(/<!--[\s\S]*?-->/g, ""));
    if (!hasRing) problems.push(`[chip trigger check] toggling a trigger didn't add .chip--trigger — test setup is broken, not a real finding`);
    else if (!hasText) problems.push(`[chip trigger check] chip--trigger (colour-only) has no text/ARIA equivalent for "${food.name}"`);

    triggers.toggle(food.id); // leave the in-memory store as found
  }
}

if (problems.length) {
  console.error(`${problems.length} a11y check failure(s):`);
  problems.forEach(p => console.error(" -", p));
  process.exit(1);
}
console.log(`a11y checks clean — ${screens.length} rendered screens, headings + button names + chip trigger text ✅`);
