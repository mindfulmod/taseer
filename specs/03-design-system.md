# Taseer — Design System

**Locked 2026-08-02: "Temperature-as-color world."** Graphics carry the information; words are on demand. The explicit anti-goal: encyclopedia feel.

## The core idea

The UI speaks in warm↔cool color before any text:

- A **thermal spectrum** underpins everything: deep cool teal/ice-blue ← neutral sand → amber/ember red.
- Food cards are **tinted by their dominant thermal nature** — watermelon's card feels icy, ginger's glows warm.
- The **remedy screen shifts palette with the chosen state**: choosing "Too hot" bathes the screen in cooling tones (the answer *feels* like the remedy); "Too cold" warms it; "Reactive" uses a calm neutral with clear warning accents (never alarm-red walls).

## Verdict graphics

- **Per-tradition badges**: small labeled chips (TCM / AYUR / UNANI) each carrying a thermometer-dot on a mini warm-cool gradient — verdict legible without reading.
- **Histamine badge**: SIGHI 0–3 as a filled-segments pill (0 green → 3 red) + tiny mechanism glyphs (liberator ⚡ / high-histamine ● / DAO-blocker ⛔-style, finalized in build).
- **Conflict flag**: when traditions disagree, badges get a subtle "split" indicator instead of hiding it.
- **Trigger ring**: user-marked trigger foods get a visible warning ring on every appearance, including ingredient chips.

## Layout & feel

- Modern, rounded, generous whitespace; big touch targets; **mobile-first responsive** (single column mobile → multi-column grid desktop).
- Food imagery: **emoji-first** at v1 scale (1000 foods × custom illustration declined as a content treadmill); consistent tinted-tile treatment makes emoji feel designed, not lazy.
- Macro rings for glance nutrition (4–5 rings max).
- **Light + dark mode both** (`prefers-color-scheme` + manual toggle); thermal palette tuned per mode so warm/cool reads correctly on each base.
- Motion: small, purposeful — palette cross-fades on state choice, spectrum explorer glides. No gratuitous animation.

## Typography & copy voice

- One friendly geometric sans (system stack or single hosted font — offline-first, so bundled).
- Copy is short, warm, non-clinical. Always "traditionally classified as…" framing per safety spec. No guilt, no alarmism.

## Screens (v1)

1. **Home / remedy finder** — "How does your body feel?" + 4 state tiles; recently-viewed row; search bar accessible but secondary.
2. **Remedy results** — Eat this / Avoid this, commonness-ranked, favorites floated.
3. **Search + results** — instant-as-you-type, alias matching, miss fallback with nearest relatives.
4. **Food card** — verdicts → glance stats → expand.
5. **Browse** — category grid, curated lists (incl. 5–10 preparations), compare view, spectrum explorer.
6. **Me** — favorites, triggers, recently viewed, miss log, disclaimer/about.

An ART.md acceptance pass (/art-review) runs before v1 ships.
