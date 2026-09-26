# Taseer (working repo: Foodex)

Fast, graphical, offline-first PWA answering two questions about any food: **does it run hot or cold** (TCM · Ayurveda · Unani, shown as honest per-system badges) and **is it a histamine risk** (SIGHI 0–3 + mechanism tags) — built around a remedy finder: *"my body feels hot → cooling foods I actually have, now."*

Vanilla HTML/CSS/JS. No framework, no backend, no accounts, no runtime dependencies, no network after first load.

## Run it

```bash
node scripts/dev-server.mjs
```

Then open http://localhost:4173. Nothing to install.

## Docs (source of truth)

| Doc | Covers |
|---|---|
| [specs/01-product-spec.md](specs/01-product-spec.md) | Soul, core loop, verdicts, cards, browse, personal layer, safety, v2 parking lot |
| [specs/02-data-spec.md](specs/02-data-spec.md) | Curation model (Claude classifies, owner spot-checks), schema, sources, staged 250→1000 rollout |
| [specs/03-design-system.md](specs/03-design-system.md) | Temperature-as-color identity, badges, screens, light/dark |
| [specs/04-image-spec.md](specs/04-image-spec.md) | The one recipe all 2,000 food illustrations must follow |
| [ART.md](ART.md) | Locked palette, type scale, density rules, ban-list, acceptance checklist |
| [data/README.md](data/README.md) | Dataset shape, batch-1 curation calls, spot-check guide |

## Scripts

| Command | Does |
|---|---|
| `node scripts/validate-data.mjs` | Schema, enums, unique ids, ingredient cross-refs. **Run after any data edit.** |
| `node scripts/build-data.mjs` | Merges `data/**` into the bundled `assets/data/foods.js` |
| `node scripts/stamp-sw.mjs` | Stamps the service worker version with a hash of the shell. **Run after any shell change.** |
| `node scripts/check-palette.mjs` | Fails on any hex not declared in ART.md §2 |
| `node scripts/format-data.mjs` | Canonical layout for `data/foods/*.json` (`--check` to verify) |
| `node scripts/build-icons.mjs` | Rasterises the app icon to PNG (pure Node) |
| `node scripts/build-image-prompts.mjs` | Regenerates `image-prompts.md` — one illustration prompt per food |
| `node scripts/optimise-images.mjs` | Generated PNGs → 640px WebP (needs `brew install webp`) |
| `node scripts/check-images.mjs` | Required heroes + thumbnails, pixel decoding, dimensions and size budgets |

## What's built

Remedy finder (4 body states, eat/avoid lists ranked by kitchen-commonness with favourites floated, reactive lists computed from SIGHI) · instant alias search over 3,966 aliases with miss logging · food cards with per-tradition badges, macro rings, ingredient chips and a why-classified expander · curated lists and 44 simple preparations, offered on the remedy screens and linked from every food they use · Ayurveda's guna axis on 322 everyday foods — light, restless or heavy, named in English first · a caffeine page grouping every caffeinated drink by which stimulant molecules it carries rather than by dose · a bloating page covering four mechanisms without pretending to rate foods on them · four histamine mechanism pages (liberator / high-histamine / other amines / DAO-blocker, mirroring SIGHI's own markers), reachable from the badge on any food card · compare view · spectrum explorer · Me screen · installable PWA that works with zero connection.

All 2,000 foods ship with painted heroes and square thumbnails. Artwork loads progressively, with emoji reserved for a failed or unavailable image; the app remains usable offline without downloading the whole set.

## Locked decisions at a glance (2026-08-02)

Remedy-finder-first · four body states · eat+avoid lists · per-system badges (no synthesized verdict) · SIGHI histamine layer · common-kitchen ranking · dish-level verdicts with ingredient chips · alias search + miss log · static PWA, no backend, no accounts · localStorage favorites/triggers/history · staged data rollout starting ~250 foods · traditional-info safety framing · name **Taseer**.

**Art direction (2026-08-02):** Headspace warmth on the emotional screens, Oura restraint on the data screens; muted spice-tin palette; hue belongs to the data, so buttons and links read by weight and shape instead.

**Parked to v2 (dated, deliberate):** AI live lookup · eating log · native-script names · full recipe *depth* (quantities, method prose — the preparation lane itself was widened to 44 on 2026-08-17).

## Deploying

Static — any host works. A GitHub Actions workflow ([.github/workflows/pages.yml](.github/workflows/pages.yml)) validates the data, checks the generated bundle isn't stale, enforces the palette, then publishes to GitHub Pages on every push to `main`. Enable it under **Settings → Pages → Source: GitHub Actions**.


## Artwork and UI checks

The app still has no runtime dependencies. Build-time image validation requires
Python 3 and Pillow (`python3 -m pip install Pillow==11.3.0`).

- `node scripts/build-artwork-manifest.mjs` — regenerate content versions after image edits.
- `node scripts/check-images.mjs` — decode and validate all 2,000 food pairs and 44 preparation mappings.
- `node --test tests/*.test.mjs` — loading, list budgets and cache lifecycle regressions.
- `node scripts/stamp-sw.mjs` — stamp after shell or artwork-manifest changes.

First-screen food art loads eagerly; later thumbnails load lazily. Loading surfaces
are quiet until the art is ready, and emoji appear only on failure. Viewed artwork
is retained across shell updates in a bounded 256-file cache, rather than requiring
an upfront download of the entire illustration library.

Preparation art is mapped in `data/preparation-art.json`: 13 reviewed food-art reuses and 31 generated illustrations, each with a hero and thumbnail. Generation prompts and review status live with the mappings. Preparation timings are estimates in `data/preparations.json`; `minutes` is the sum of prep, cook and rest, with additional cooling called out where variable. See `docs/phase-2-implementation.md`.
