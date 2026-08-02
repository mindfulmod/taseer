# ART.md — Taseer Art Bible

**Locked 2026-08-02** via art-direction interview, on top of the locked
`specs/03-design-system.md`. Every visual change must comply with this file. When
in doubt this file wins — amend the bible first, then build.

## 1. North star

- **References, conflict order:** Headspace (warmth) > Oura (restraint). Crouton,
  Deliveroo and MacroFactor inform specific rules below; Yuka and Cronometer are
  **anti-references**.
- **One-sentence look:** a warm spice-tin room whose colour tells you the
  temperature of everything in it.
- **Two registers, assigned by screen:**
  - *Warm register* (Headspace) — home, remedy results. Whole-tile colour, display
    type, ≥24px gaps, colour carries the feeling.
  - *Quiet register* (Oura) — food card, search, browse, category, spectrum, Me.
    Neutral surfaces, colour confined to glyph tiles / badges / hairlines, strokes ≤3px.
- **Two rules the food apps taught:**
  - Recipe and delivery apps get their warmth from *photography*. Taseer's images
    are one painted set on one backdrop (§8), not a photo library, so **colour
    still does the work** — never solve a flat screen by adding an image.
  - Delivery apps reserve hue for actions. Taseer inverts it: **hue belongs to the
    data**, so interactivity must read by shape, weight and underline instead.
- **Gut test:** the home screen should look at home next to a Headspace screenshot;
  the food card next to an Oura screenshot. If a screen looks like Yuka — white,
  grey line icons, no identity — it fails.

## 2. Palette (LOCKED — no other hexes may appear in code)

Muted & earthy, spice-tin chroma. Every temperature is a **triad**: `accent` for
marks and hairlines, `tint` for fills, `deep` for text on tint.

### Light

| Token | Accent | Tint | Deep |
|---|---|---|---|
| cold | `#26706E` | `#DCEBE9` | `#164543` |
| cool | `#57968F` | `#E7F0EE` | `#2E5E58` |
| neutral | `#B39566` | `#F3EADB` | `#6B5632` |
| warm | `#CE8A4E` | `#F8E7D4` | `#7E4C1C` |
| hot | `#B4503A` | `#F6DDD5` | `#7A2E1E` |
| calm (reactive) | `#7A6B84` | `#EDE7F0` | `#453C4D` |

Base: bg `#FAF5EC` · surface `#FFFCF6` · surface-2 `#F1E9DA` · line `#E4D9C6` ·
line-strong `#D2C2A8` · ink `#241E17` · ink-2 `#6B5F51` · ink-3 `#978A79`
SIGHI 0–3: `#3B7D53` `#8A8F3C` `#C0812C` `#A8402F` · alert `#B03A2A` / tint `#F7E0DB`

### Dark (warm charcoal)

| Token | Accent | Tint | Deep |
|---|---|---|---|
| cold | `#4FB3AE` | `#123330` | `#A6E2DE` |
| cool | `#79B8AF` | `#17322E` | `#B7DDD7` |
| neutral | `#C8A972` | `#2C2519` | `#E4CFA6` |
| warm | `#E09A5C` | `#35281A` | `#F3C79C` |
| hot | `#D96A4E` | `#33201A` | `#F0A98F` |
| calm (reactive) | `#A897B2` | `#292432` | `#D6C9DD` |

Base: bg `#17150F` · surface `#201D16` · surface-2 `#2A251C` · line `#383125` ·
line-strong `#4C4433` · ink `#EFE8DB` · ink-2 `#ABA292` · ink-3 `#7E766A`
SIGHI 0–3: `#62B27E` `#B0B457` `#E0A24E` `#E2705C` · alert `#E8705C` / tint `#38201B`

**Calm is deliberately off the thermal axis** (dusty plum) so a reactive day can
never be misread as a temperature. SIGHI's green→red is the only sanctioned second
colour family, and it may appear **only inside a histamine badge or segment pill**.

## 3. Type & space

System rounded stack — `ui-rounded, "SF Pro Rounded", -apple-system, "Segoe UI", Roboto, sans-serif`.
No bundled font: offline-first beats cross-device identity.

| Role | Size / line | Weight | Notes |
|---|---|---|---|
| Display (screen h1) | 28 / 1.15 | 800 | letter-spacing −0.02em |
| Title (h2) | 18 / 1.2 | 700 | |
| Body | 16 / 1.45 | 400–600 | |
| Meta | 13 / 1.35 | 400 | ink-2 |
| Eyebrow / band | 11 / 1.2 | 800 | uppercase, 0.09em, ink-3 |

Space scale 4px: gaps 8 / 12 / 16 / 24 / 32. Page padding 16px, max width 900px.
Radius: glyph tile 15 · row 18 · panel 20 · hero 28 · pill 999. Touch target ≥44px.

## 4. Elevation & tint recipe

- **Light:** warm shadow `0 1px 2px rgb(74 55 30 / 6%), 0 8px 24px rgb(74 55 30 / 7%)`.
- **Dark:** no lift shadows — separation comes from `--line` borders (max `0 1px 2px rgb(0 0 0 / 40%)`).
- **Food row:** neutral `--surface` fill, **1px border mixed 30% toward that food's
  accent**, and the emoji in a `--t-tint` glyph tile with a 22% accent inset hairline.
  The row itself is never washed in temperature.
- **Remedy screen:** `data-tone` shifts bg 9% / surface 6% / surface-2 11% / line 22%
  toward the tone, plus a top-and-bottom gradient wash at 30% / 16%. The tone is the
  **remedy's** temperature, never the complaint's.
- **Badge:** `--t-tint` fill, 26% accent inset hairline, dot on the shared five-stop
  gradient track. Contested adds a heavier hairline and a `?`, never a colour change.

## 5. Density & composition

- **Airy:** at 390×844, **6–7 list rows** visible. Row height 76px, gap 12px.
- A row carries at most **two** information systems: name + meta line, plus one badge cluster.
- Full badge sets (3 traditions + histamine) appear **only on the food card**, never in lists.
- Category and cuisine tiles are **neutral** — emoji + label + count, no identity hue.
- Macro rings: 4 rings max plus one text highlight; all rings take the food's accent,
  differentiated by label, never by hue.
- Horizontal rails (recently viewed) use 82px round-cornered mini tiles, ≥3 visible.

## 6. Ban-list (universal — extend, never trim)

1. No hex codes outside §2. Need a new colour? Amend the bible first.
2. No pure `#FFFFFF`, no pure `#000000`, anywhere.
3. **Hue belongs to data.** Buttons, tabs, links, focus rings and back arrows never
   take a temperature colour — they read by ink, weight, underline and shape.
4. Every temperature surface uses its full triad. A lone flat accent block is a bug.
5. Emoji never sit bare on a surface — always in a tinted glyph tile.
6. No second colour system. Categories, cuisines and navigation stay neutral. SIGHI
   is the single exception and stays inside histamine components.
7. **No rainbow data** (the Cronometer failure). Charts, lists and spectra may use
   only the five-stop thermal ramp — never a hue per item.
8. Composite heat may drive tint and ordering only. It is never rendered as a
   number, word, or verdict — the per-system badges are the only verdicts.
9. No photography, no icon font, no per-food illustration outside the §8 recipe.
   Emoji remain the glyph everywhere except the food-card hero.
10. Nothing loops or animates unprompted. Motion happens on user action only.
11. No screenshot, no opinion — no visual work is done until it has been seen in
    both light and dark.

## 7. Motion

Tone cross-fade 450ms ease · press feedback scale 0.98 / 120ms · expander 200ms ·
spectrum glide 600ms `cubic-bezier(.22,1,.36,1)`. No list entrance animation.
`prefers-reduced-motion` collapses everything to ≤10ms.

## 8. Food images (added 2026-08-02)

One painted set, one recipe, generated externally. Full generation spec and the
per-food prompt manifest: `specs/04-image-spec.md`.

- **Style:** soft painted illustration — gouache/watercolour edges, matte, no photo
  texture, no outlines. Never photoreal, never 3D-render, never flat-vector.
- **Placement:** food-card hero **only**. Lists, rails, category tiles and
  ingredient chips keep emoji glyph tiles.
- **Backdrop is neutral warm sand `#F1E7D6` for all 250** — temperature tint is
  applied by the app in CSS, never baked into the asset.
- **Frame:** 3:2 landscape, 1280×854 source → shipped 640×427 WebP q72, ≤45 KB.
  Single subject centred, occupying 60–70% of frame, soft contact shadow.
- **Camera & light:** one three-quarter view ~30° above the subject for every
  image; single soft key from upper-left, no hard speculars, no rim light.
- **Fallback is mandatory:** every image is progressive enhancement. A missing
  file must degrade silently to the emoji glyph tile — never a broken image, never
  a layout shift, never a spinner.
- **Caching:** images are lazily cached at view time, never precached. The app
  shell and dataset stay fully offline without a single image present.
- Image ban-list: no text or labels, no hands, no branding or packaging, no
  watermark, no human figures, no busy props or table scenes, no pure-white
  backgrounds, no plating for raw ingredients, no floating subjects without a
  contact shadow.

## 9. Acceptance checklist (reviews grade against THIS)

- [ ] `node scripts/check-palette.mjs` clean — only §2 hexes in source
- [ ] Screenshotted at 390×844 in **both** light and dark
- [ ] 6–7 list rows visible per phone screen; rows 76px with 12px gaps
- [ ] Every food glyph in a tinted tile; row fill neutral, row border tinted
- [ ] No temperature hue on any button, tab, link, back arrow or focus ring
- [ ] Remedy screen tone reads within a second and matches the *remedy*
- [ ] Conflict: quiet mark in lists, labelled banner on the card
- [ ] Trigger ring visible on every appearance, including ingredient chips
- [ ] Body text ≥4.5:1 and meta ≥4:1 contrast in both modes
- [ ] Gut test: home beside a Headspace shot, food card beside an Oura shot
