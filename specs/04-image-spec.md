# Taseer — Food Image Spec

**Locked 2026-08-02.** Governs the 2,000 food illustrations generated externally
(Codex) and dropped into `assets/food-images/`. Art rules live in `ART.md` §8;
this file is the production manual.

## The one job

2,000 images generated at different times, by a model with no memory of the other
1,999, must look like **one commissioned set**. Everything below exists to remove
per-image freedom. Style, camera, light, backdrop and framing are fixed; only the
subject changes.

## Fixed recipe (never varies)

| Property | Value |
|---|---|
| Style | Soft painted illustration — gouache/watercolour, visible soft brush edges, matte |
| Backdrop | Flat warm sand `#F1E7D6`, seamless, no horizon line, no table edge |
| Camera | Three-quarter view, ~30° above the subject, subject centred |
| Light | One soft key from upper-left, gentle falloff, soft contact shadow beneath |
| Framing | 3:2 landscape, subject fills 60–70% of frame, even margins |
| Source size | 1280 × 854 PNG |
| Shipped | 640 × 427 WebP, quality 72, target ≤45 KB |

**No outlines. No photo texture. No 3D render look. No flat vector.**

## Never include

Text or labels · hands or people · branding, logos, packaging · watermarks ·
cutlery or napkins (unless the food is inherently served with it) · plates for raw
ingredients · busy table scenes or props · pure white background · steam wisps ·
drop shadows without ground contact · borders or frames · multiple camera angles
in one image.

## Naming & placement

- One file per food: `assets/food-images/<id>.webp`, where `<id>` is the food's
  `id` in `data/foods/*.json` — exactly, lowercase, hyphenated. `bitter-gourd.webp`,
  `masala-chai.webp`.
- Every food must ship a hero and a 320 × 320 WebP thumbnail in `assets/food-thumbs/`.
  CI decodes both sets and checks coverage, dimensions and file budgets (45 KiB hero,
  24 KiB thumbnail). Existing heroes may be 640 × 426 or 640 × 427.
- Loading reserves a softly tinted area with no emoji. A genuine load error shows
  a decorative emoji fallback; a previously loaded thumbnail can bridge hero loading.
  The app remains usable offline when an illustration has not been cached.
- Visible thumbnails are eager; later rows are lazy. The active hero is eager with
  high fetch priority. No whole-library preload or blocking image splash screen.
- Viewed food art uses a bounded cache of 256 files, retained across shell releases.
  `node scripts/build-artwork-manifest.mjs` versions changed image bytes separately.
  Run it before `node scripts/stamp-sw.mjs` after any artwork change.

## Workflow

```bash
node scripts/build-image-prompts.mjs   # regenerates image-prompts.md (2,000 prompts)
# generate PNGs externally, then:
node scripts/optimise-images.mjs       # PNG -> 640x427 WebP q72 into assets/food-images/
```

Generate in category batches (fruits, then vegetables, …) — same category in one
session holds style consistency best. Spot-check a batch against the previous
batch before continuing; if a batch drifts (glossier, darker, tighter crop),
regenerate that batch rather than letting two looks into the set.

## Prompt template (used by the generator)

> Soft painted gouache illustration of **{subject}**, {subject hint}. Single
> subject centred on a flat warm sand `#F1E7D6` background, three-quarter view from
> about 30 degrees above, one soft key light from the upper left, soft contact
> shadow beneath. Matte painted texture with soft brush edges, no outlines, muted
> earthy palette. 3:2 landscape, subject fills about two thirds of the frame. No
> text, no hands, no branding, no plates or cutlery, no props, no white background.

`{subject}` is the food's display name; `{subject hint}` is its one-line
description from the dataset, which keeps dishes recognisable (biryani gets
"layered spiced rice with meat", not a generic curry).

## Acceptance (per batch of ~20)

- [ ] All backdrops read as the same sand — no grey, no white, no gradient sky
- [ ] Shadow direction identical across the batch
- [ ] No image contains text, hands, branding or a plate for a raw ingredient
- [ ] Subject recognisable at 320px wide (the real display size on a phone)
- [ ] File ≤45 KB after conversion
- [ ] Filename matches a real food `id` (`node scripts/check-images.mjs`)

## Preparation artwork

`data/preparation-art.json` is the explicit 44-entry mapping. Food-art reuse must show the finished dish and appropriate ingredients. New art lives in `assets/prep-images/` (640 × 427 WebP, ≤45 KiB) and `assets/prep-thumbs/` (320 × 320 WebP, ≤24 KiB). Keep the source prompt and reviewed status in the mapping. `build-data.mjs` bundles only runtime paths; the generated content-version manifest includes both preparation folders. The image check fails for missing mappings, unreviewed art, missing or corrupt files, bad dimensions or exceeded budgets.
