# Taseer dataset — Batch 1 (core 250)

**Classified 2026-08-02 by Claude** per the locked curation model (Claude classifies, owner spot-checks). Validated by `scripts/validate-data.mjs` — run it after any edit:

```bash
node scripts/validate-data.mjs
```

## Contents

250 foods across `data/foods/*.json`: 41 fruits · 41 vegetables · 18 grains · 38 spices/condiments · 37 proteins · 11 dairy · 20 drinks · 44 dishes. Coverage spans South Asian, Arabic, Chinese, and Western household staples with 750 romanized aliases (bhindi/bamia/qiu kui all resolve).

## Schema notes (deltas from specs/02-data-spec.md)

- `remedy` is flattened to `{"too-hot": "eat|avoid", "too-cold": ...}` and only present where the call is clear. **Reactive-state lists are computed in-app** from histamine data (eat = SIGHI 0 non-liberator; avoid = SIGHI ≥2 or liberator/DAO-blocker) — no hand synthesis needed.
- Per-food `source` strings are omitted; each system's source basis is global, in `data/sources.json`. Notes carry food-specific reasoning.
- `nutrition.estimate: true` marks Claude estimates (all dishes + a few items USDA lacks).
- Composed drinks (masala chai, lassi, barley water, sattu) carry `ingredients` like dishes do.

## Batch-1 curation decisions (2026-08-02)

- **Alcohol skipped** despite being a top histamine offender — household-mix call; add in a later batch if the app goes broad.
- **Pork included** (1 entry, no pork dishes beyond Chinese classics that traditionally use it) — the app claims Chinese/Western coverage.
- **Dried vs fresh** handled as notes on one entry (figs, apricots) rather than separate entries — batch 2 candidates if miss-logs demand.
- Aged cheese, canned scombroid fish, soy sauce, and kombucha are deliberately present as **teaching negatives** — the "why is my safe-looking meal a flare" foods.

## Dataset shape (from validator)

- SIGHI 0/1/2/3: **105 / 92 / 35 / 18** — enough green foods for reactive-day lists, enough red to be honest.
- **43 genuine cross-tradition conflicts** (hot-vs-cold disagreement) shown, not hidden.
- **107 entries carry ≥1 `contested` confidence** — mostly TCM/Unani verdicts for foods outside those canons (new-world foods, regional items). These render with the split/conflict indicator.
- Remedy coverage: 64 foods for "too hot", 66 for "too cold".

## Spot-check guide for the owner

Highest-value 20 minutes: check the entries where I overrode or split from common desi assumptions —

1. **The famous conflicts** (each shows per-system badges): mango (TCM cool vs Unani garam) · yogurt (Ayurveda heating vs Unani thanda) · ghee (Ayurveda cooling vs desi garam) · eggplant (TCM cool vs baingan garam) · fennel (TCM warm vs saunf thanda) · pomegranate (TCM warm vs anar thanda) · raisins (Ayurveda cooling vs kishmish garam) · wheat (TCM cool vs gehun garam).
2. **Histamine surprises**: spinach 3 · tomato 3 · avocado 2 · walnuts 2 · canned tuna 3 · chicken-noodle-soup 2 (long broth) · nihari 3 (overnight simmer) · caesar salad 3.
3. **Anything tagged `contested`** you have household knowledge on — your correction beats my inference; edit the JSON and rerun the validator.

## Batch 2+ (toward 1000)

Priority order: (1) whatever the in-app miss-log collects, (2) remaining desi sabzis and dals, (3) Chinese herbs-as-food (goji, red dates/jujube, white fungus), (4) Arabic mezze and stews, (5) Western processed/packaged categories, (6) alcohol if going public.
