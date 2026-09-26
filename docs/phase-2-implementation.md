# Phase 2 implementation

Implemented on the existing `codex/phase-1` checkout, preserving the Phase 1 changes. This is a local preview; no deployment or merge has been performed.

## Artwork

All 44 preparations have explicit reviewed mappings in `data/preparation-art.json`. Thirteen reuse an existing illustration of the finished preparation; 31 use new images produced with the built-in image-generation tool. Prompts, source type and review status are recorded in the mapping. Only hero/thumbnail paths enter the runtime data bundle.

New images follow the matte painted food family, sand ground, three-quarter view and soft light. A drink/soup/dry dish/plate calibration batch preceded the rest. All 44 heroes were inspected in contact sheets, all 44 thumbnails at 60px, and representative generated artwork in the real detail and gallery layouts. Raw generated PNGs remain in the tool output directory; optimized assets live in `assets/prep-images/` and `assets/prep-thumbs/`. The 62 new WebPs total 1,556,370 bytes (about 1.48 MiB). Heroes are 640 × 427, ≤45 KiB; thumbnails are 320 × 320, ≤24 KiB.

Reuse review rejected raw white-rice artwork, plain congee, whole fish in sauce and a whole roast chicken where the preparation calls for a different finished dish. The new assets depict those recipes instead.

## Browsing and appearance

- Added `#/preparations`, with illustrated cards and state filters. A remedy's all-preparations link preserves its state. Curated lists provides a small visual preview and a direct library link.
- Preparation details pair hero artwork with ingredients, steps, estimated prep/cook/rest times and a useful direct-link fallback. Ordinary Back follows the actual originating screen.
- Food rows use larger 60px artwork, readable wrapping and quieter borders. Remedy surfaces have a lighter tint, with warmth retained in the upper wash and semantic markers. Removed a circular CSS line-token definition. Reduced desktop header dead space.
- Thermal dots have an expandable, keyboard-accessible order/colour legend. On desktop remedy screens it sits above both columns to preserve alignment. Search results expose matched aliases. Thermal disagreements sit beside the scale; neutral/warmer variations are no longer described as unanimous agreement.
- Theme surfaces and text switch together to avoid the observed momentary low-contrast background transition.

## Navigation and content

History entries retain scroll, expanded pager counts, open disclosures and focused food/preparation links. Filters and queries continue to live in the URL; replaceState preserves the entry key. Back/Forward recreates rows before restoring position. Snapshots are bounded to 40 entries and last for the current page session; reload starts a fresh session.

Reviewed timing for all 44 records against their steps. `minutes` equals prep + cook + rest; labels are approximate. Variable cooling is stated separately. Examples: cucumber-mint water is 25 minutes including a 20-minute rest; chicken congee is 80 minutes including the sequential stock and rice stages. These are editorial estimates, not stopwatch-tested recipes. Updated blurbs that contradicted timing/ingredients or made categorical benefit/tolerance claims. Food classification values remain unchanged.

## Verification

- 15 automated regressions pass: pagination, decoding/failure handling, artwork mappings, state filtering, aliases/disagreements, exhausted-pager restoration, cache upgrades and offline preparation artwork.
- Image validator decodes all 4,062 required files and validates mapping coverage, review status, dimensions and budgets.
- Dataset, generated bundle, artwork manifest, worker stamp, palette, type and whitespace checks pass. Accessibility pattern checks cover 107 rendered screens, including all preparation details and state-filtered libraries.
- Real browser: 390 × 844 mobile and 1280 × 900 desktop, light/dark screenshots; no horizontal overflow on checked library/detail screens.
- Real browser Back from a page-two food restored 64 loaded rows, the Oi muchim button's focus and scroll position (3302.5px). Alias search retained “karela” and its expanded thermal legend. The remedy library link showed exactly 14 cooling preparations.
- Real offline reload with the local HTTP server stopped restored the preparation shell, text and previously viewed 640px generated hero. The server was restarted afterward.

The accessibility script checks structural patterns, not a full assistive-technology audit. Network stalls/failures are covered by the shared artwork regression harness and the Phase 1 browser checks; Phase 2 adds the real offline reload and new-path cache regression.
