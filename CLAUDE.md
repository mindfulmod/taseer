# Taseer — working rules

Static offline-first PWA. Vanilla HTML/CSS/JS, no framework, no backend, no runtime
dependencies. Source of truth for decisions is `specs/` + `ART.md` — those are locked;
raise a question rather than relitigating one.

## Before any commit

```bash
node scripts/validate-data.mjs   # after ANY data/foods edit
node scripts/build-data.mjs      # regenerates assets/data/foods.js
node scripts/check-palette.mjs   # enforces the ART.md palette
```

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

`sw.js` precaches the shell only (never illustrations). **Bump `VERSION` in sw.js on
any shell change** — html, css, js, or `assets/data/foods.js` — or installed clients
keep serving the old build. Icons are generated: `node scripts/build-icons.mjs`.
