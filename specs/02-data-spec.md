# Taseer — Data Spec

**Locked 2026-08-02.**

## Curation model (locked — user's own words)

> "I want you to dig through and look up classification for the top 1000 most common foods that people eat across south asian households, arabic households, chinese households, and western households, and classify them yourself… I don't have the insight into classifying every single food item myself."

**Claude is the curator; the owner is a spot-checker.** Consequences (confirmed 2026-08-02):

- Every classification carries a **named source basis** (e.g. "Bensky & Gamble materia medica tradition", "classical Ayurvedic virya of cucurbits", "SIGHI list v2024") and a **confidence level** (high / moderate / contested).
- Foods where traditions genuinely conflict or sources are thin get **flagged visibly** on the card, never papered over.
- No live-AI answers in the dataset — everything is classified at build time and shipped as static data.

## Rollout (locked)

**Staged: ~250 core foods → 1000.** v1 ships at ~250 (most common across the four cuisines, spot-checked). Subsequent batches are data-only updates. Search-miss logging prioritizes additions.

### Amendment — scope widened to world kitchens (2026-08-07)

**The 1000 target was met at batch 4, and the owner then chose to widen the
scope rather than stop.** Recording it here because the original four-cuisine
framing was a locked decision and this supersedes it.

The four household cuisines are close to exhausted: at 1000 foods, 389 entries
already sit at commonness 3–4 (occasional or specialty), so perhaps 300 useful
items remained inside them. Doubling within that scope would have produced ~700
commonness-4 obscurities. Widening instead buys ~700 foods that are genuinely
everyday *somewhere*.

Cuisine ids added: `japanese`, `korean`, `southeast-asian`, `latin-american`,
`persian-turkish`, `african`, `eastern-european`. They are grouped rather than
split per country — one id per country would fragment the label on a food card
without telling the reader anything more.

**What does not change:** the per-system classification model, the confidence
levels, and the safety framing. A Thai curry is read by the same TCM / Ayurveda
/ Unani lens as a desi one, and where those traditions have no entry for a food
— which is most of the new set — the reading is marked `contested`, not
invented. Expect the contested share to rise; that is the honest outcome, not a
defect.

## Food record schema

```jsonc
{
  "id": "bitter-gourd",
  "name": "Bitter gourd",
  "aliases": ["karela", "bitter melon", "ku gua", "karella"],
  "emoji": "🥒",                    // or image ref; see design spec
  "category": "vegetable",          // fruit|vegetable|grain|spice|protein|dairy|drink|dish
  "cuisines": ["south-asian", "chinese"],
  "commonness": 2,                  // 1 = pantry staple … 4 = specialty store
  "description": "One line, plain words.",
  "thermal": {
    "tcm":      { "verdict": "cold", "confidence": "high", "note": "...", "source": "..." },
    "ayurveda": { "verdict": "cooling", "confidence": "high", "note": "...", "source": "..." },
    "unani":    { "verdict": "cold-dry", "confidence": "moderate", "note": "...", "source": "..." }
  },
  "histamine": {
    "sighi": 0,                     // 0–3
    "tags": [],                     // "liberator" | "high-histamine" | "dao-blocker"
    "note": "..."
  },
  "nutrition": { "kcal": 17, "protein": 1, "carbs": 3.7, "fat": 0.2, "highlight": "vitamin C" }, // per 100g, USDA FDC; manual for dishes FDC lacks
  "remedy": {
    "states": { "too-hot": "eat", "too-cold": "avoid" }  // absent = neutral for that state
  },
  "ingredients": ["basmati-rice", "ghee", "..."]   // dishes only; ids of typical contents
}
```

Thermal verdict vocabularies per system (kept native, not forced into one scale):
- **TCM:** cold · cool · neutral · warm · hot
- **Ayurveda:** cooling (shita virya) · heating (ushna virya)
- **Unani:** hot/cold × dry/moist degrees where classically stated, simplified to hot · cold (+ optional dry/moist)

## Sources

- **Histamine:** SIGHI compatibility list (the reference allergists hand out) — scores + mechanism tags.
- **TCM / Ayurveda / Unani:** classical classifications as commonly documented; write-ups are original prose (no copied text; zero licensing exposure).
- **Nutrition:** USDA FoodData Central for raw/simple foods; manual estimates for South Asian/Arabic dishes FDC lacks, marked as estimates.

## Miss log

Search misses append `{query, timestamp}` to localStorage. A small "suggest foods you searched for" view lets the owner export/read the list to drive the next batch.
