# Taseer — working rules

Static offline-first PWA. Vanilla HTML/CSS/JS, no framework, no backend, no runtime
dependencies. Source of truth for decisions is `specs/` + `ART.md` — those are locked;
raise a question rather than relitigating one.

## Before any commit

```bash
node scripts/validate-data.mjs   # after ANY data/foods edit
node scripts/build-data.mjs      # regenerates assets/data/foods.js
node scripts/stamp-sw.mjs        # after ANY shell change (html/css/js/data)
node scripts/check-palette.mjs   # enforces the ART.md palette
```

CI runs all four and fails if any generated file is stale.

## Visual work

All visual changes must comply with `ART.md`. Run `/art-review` before merging visual
work. **No agent may claim visual quality without a screenshot** — in both light and dark.

Adding a colour means amending `ART.md` §2 first; `check-palette.mjs` fails the build
otherwise.

## Data

`data/foods/*.json` is hand-maintained and authoritative; `assets/data/foods.js` is
generated — never edit it. Do not change classifications to make the UI nicer; flag
questionable ones to the owner instead.

## Images

Generated externally per `specs/04-image-spec.md`. They are always optional — the app
must work, and look finished, with zero images present.

## PWA

`sw.js` precaches the shell only (never illustrations). Its `VERSION` is a hash of
those files, stamped by `node scripts/stamp-sw.mjs` — never edit it by hand. A stale
version means installed clients keep serving the old build forever, which is
invisible in testing, so CI treats it as a build failure.

**When testing shell changes locally, the worker will serve you stale files too.**
Clear it in the console: `navigator.serviceWorker.getRegistrations().then(rs =>
rs.forEach(r => r.unregister()))` then `caches.keys().then(ks => ks.forEach(k =>
caches.delete(k)))`, and reload.

Icons are generated: `node scripts/build-icons.mjs`.
