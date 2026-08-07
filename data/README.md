# Taseer dataset — 506 foods (batch 1 + batch 2)

> **Batch 2 landed 2026-08-07: +256 foods, 250 → 506.** Plan and rationale in
> [`BATCH-2-PLAN.md`](BATCH-2-PLAN.md). Shape now: 71 fruits · 79 vegetables ·
> 38 grains · 80 spices/oils/condiments · 73 proteins · 26 dairy · 50 drinks ·
> 89 dishes. 1,536 aliases, 85 cross-tradition conflicts, 59 foods at SIGHI 3.
>
> **What changed in kind, not just count:**
> - **Cooking oils exist now.** Mustard, sesame, coconut, olive, sunflower and
>   palm. Their absence was a hole in the middle of a taseer app — sarson vs
>   coconut oil is one of the sharpest hot/cold splits in the whole set.
> - **Alcohol is in** (6 entries), at the owner's instruction. All carry the
>   `dao-blocker` tag: alcohol blocks the enzyme that clears histamine, so it
>   worsens whatever is eaten alongside it. A reactive-day list that omitted
>   wine was misleading.
> - **Cured meat and offal** as teaching negatives: salami, bacon, liver, kidney
>   and bone broth. Bone broth at SIGHI 3 is the one worth knowing — the hours
>   of simmering that make it nourishing are exactly what builds histamine.
> - **Dried-vs-fresh split out** where drying flips the reading: figs, apricots
>   and dates all move from cooling/neutral to firmly garam once dried.
> - **`contested` is now 263 of 506** — much higher than batch 1's rate, and
>   honestly so: batch 2 reaches into new-world fruit, processed condiments and
>   packaged drinks that the Chinese and Unani canons never covered. Saying so
>   beats inventing confidence.
>
> ### Verification pass (2026-08-07) — and what batch 1 actually did
>
> **Batch 1 did no external verification.** Worth recording, because it is easy to
> assume otherwise: its commit is co-authored Claude Opus 5, zero of its 250
> entries carry a per-food `source` string, and `sources.json` names only
> tradition-level bases. The `source` field in `specs/02-data-spec.md` was never
> populated. Both batches are model-knowledge classification with honest
> confidence levels — that is the method, and it should be stated rather than
> implied.
>
> Batch 2 was then spot-verified against published sources, which batch 1 was
> not. **Six corrections resulted:**
>
> | Entry | Was | Now | Why |
> |---|---|---|---|
> | `apple-cider-vinegar` | SIGHI 3 | **1** | SIGHI names cider vinegar *with distilled white* among tolerated vinegars. The original entry also contradicted batch 1's own correct `white-vinegar` note. |
> | `rice-vinegar` | SIGHI 3 | **1** | Not wine-based; commonly recommended as the substitute. |
> | `sourdough` | SIGHI 3 | **2** | SIGHI's own wording is a question, not a verdict. |
> | `rye-bread` | SIGHI 3 | **2** | Same open question. |
> | `olives` | note | note | Rating held at 2; note sharpened to SIGHI's actual distinction. |
> | `lotus-seeds` | 332 kcal / 64.5 c | **362 / 76** | USDA FoodData Central. |
>
> **Confirmed correct** on checking: amla cooling-despite-sour (the classical
> śīta vīrya / madhura vipāka exception), the durian-hot / mangosteen-cold pair
> and its king-and-queen pairing, bone broth at SIGHI 3, and the `dao-blocker`
> tag on all alcohol.
>
> **Coverage is a sample, not a census.** Roughly a dozen of the highest-risk
> claims were externally checked out of 256 entries carrying 142 high-confidence
> thermal claims and 188 non-estimate nutrition rows. One systematic caveat came
> out of it: **nutrition figures are close but not exact USDA rows** — lotus seed
> protein and fat matched to the decimal while calories and carbs were ~10% low.
> Treat every number as approximate until checked.
>
> **Repeatable method:** SIGHI ratings against the published compatibility list
> (histaminintoleranz.ch); nutrition against USDA FoodData Central; thermal
> verdicts against the tradition named in `sources.json`. Prioritise, in order:
> SIGHI 0 and 3 (they drive the reactive lists directly), `confidence: "high"`
> claims (certainty was asserted), then nutrition.
>
> **Search-collision rule learned the hard way:** a new entry may not take a
> name that an older entry holds as a *bare* alias — `atta`, `roti`, `cod` and
> `tahini` all had to be surrendered by their old owners. Batch 1's
> `alias (qualifier)` form — `besan (flour)` on chickpeas — is the opposite: a
> deliberate cross-reference that should be left alone. Re-run the collision
> audit after any batch.

---

## Batch 1 (core 250)

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
