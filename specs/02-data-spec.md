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
