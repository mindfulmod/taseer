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

## Preparation record schema

`data/preparations.json` — a separate id namespace (`prep-*`), referencing food
ids. 44 entries as of 2026-08-17; see the product-spec amendment for why the
lane was widened and what stayed parked.

```jsonc
{
  "id": "prep-khichdi",
  "name": "Khichdi",
  "emoji": "🍲",
  "kind": "bowl",              // drink|bowl|plate|side|sweet
  "state": "reactive",         // too-hot|too-cold|reactive — which remedy screen offers it
  "minutes": 30,
  "serves": 2,
  "blurb": "One line, the same voice as a food description.",
  "why": "Which tradition is doing the work, in the food-card register.",
  "swap": "One substitution. Optional.",
  "ingredients": ["white-rice", "mung-beans", "ghee"],  // food ids
  "steps": ["...", "...", "..."]                        // 2–4, enforced
}
```

Four rules `validate-data.mjs` enforces beyond the schema:

- **2–4 steps.** The upper bound is what keeps this a lane rather than a recipe
  site; without it the format drifts one entry at a time.
- **A `reactive` preparation may not contain a SIGHI ≥ 2 ingredient, or one
  tagged liberator / DAO-blocker / high-histamine.** Two of the original ten
  did — the "low-histamine" oat porridge carried cinnamon and the coconut-chia
  cooler carried lime — which put an ingredient from the Reactive → **Avoid**
  list inside a preparation offered on the Reactive → **Eat** screen. Same
  reasoning as the dish/ingredient SIGHI check: the reader sees the claim and
  the chips together.
- **A thermal preparation must contain at least one ingredient pulling its
  way.** Deliberately weak — it does *not* compute a verdict from ingredients
  (the product spec declines that: preparation method changes thermal nature).
  Seasoning quantities of a hot spice in a cold dish stay legal.
- **`why` is required.** A preparation that can't say which tradition puts it on
  its list doesn't belong on the list.

## Guna — Ayurveda's second axis

Separate from `thermal.ayurveda`, which carries *virya* (heating/cooling) only.
Guna is about mental effect rather than temperature.

```jsonc
"guna": { "verdict": "light", "confidence": "high", "note": "..." }
```

`verdict` is `light` | `restless` | `heavy`. Confidence uses the same three
values as thermal.

**English names lead, Sanskrit follows.** *sattva → light*, *rajas → restless*,
*tamas → heavy*. Owner brief was "it needs to be very easy to understand", and
leading with the Sanskrit is the single thing that makes most writing on this
subject unreadable — nobody arrives wanting to learn the word "tamasic", they
arrive wanting to know why they are foggy after lunch. Every section of
`/guna` answers "is this good or bad" before it explains anything.

**322 of the 496 everyday foods carry a reading; the long tail is deliberately
unmarked.** Guna is described in the sources by quality and condition far more
than by ingredient lists, so a food is tagged where the sources support it and
left alone where they do not. 78 are classically named (high confidence), 234
follow a stated principle (moderate), 10 are genuine disagreements between
schools (contested — eggs, cultured dairy).

**One rule outranks the ingredient**, and the page says so before it lists
anything: what has happened to a food matters more than what it is. Fresh dal is
light; the same dal reheated tomorrow is heavy.

**Not derived from the histamine layer.** An early draft mapped `liberator` onto
restless — that was cut, because a pharmacological tag has no Ayurvedic
correlate and using it would merge two systems into one verdict, which the
product spec refuses outright. The aged/fermented → heavy rule is kept because
both systems are describing the same observable condition of the food, not
because one is computed from the other. The overlap is noted on the page as an
observation, never as a derivation.

## Stimulant profile

On the 33 caffeine-bearing entries only.

```jsonc
"stimulant": {
  "compounds": ["caffeine", "theanine"],   // caffeine | theanine | theobromine | theophylline
  "note": "..."
}
```

**Compounds, never milligrams — and the validator enforces it.** Dose per cup
swings an order of magnitude with grind, steep and serving size, and this schema
has no portion concept to hang a number on; a note quoting `mg` fails the build.
Which molecules are present is stable, and it is the part that explains why two
equally caffeinated drinks feel nothing alike.

The axis also joins up with the histamine layer, which is the part no other
reference puts in one place: **theobromine** is the compound SIGHI names as
inhibiting DAO, so the mildest stimulant in the set has the clearest effect on
clearance; and the tea plant's catechins are why every tea carries a
`dao-blocker` tag while coffee, for all its caffeine, does not.

Six families fall out of the data: caffeine + theanine (17, the tea plant and
everything built on it), caffeine alone (10, the coffees and cola), theobromine
+ caffeine (2, cocoa), all three methylxanthines (2, mate), caffeine +
theobromine (1, energy drinks), and decaffeinated (1).

## Histamine provenance

The thermal layer has carried `confidence` and `source` per tradition since the
beginning, which is why it can show a contested reading honestly and make a
feature of disagreement. The histamine layer had neither. It cited SIGHI and
departed from it on **116 of the 187 foods SIGHI lists**, with nothing anywhere
saying so — which is how a wrong coffee mechanism reached production on
2026-08-17 and sat there for two days.

```jsonc
"histamine": {
  "sighi": 0, "tags": [], "note": "...",
  "ref": { "sighi": 2, "marks": "L", "as": "cumin (Cuminum cyminum)" },  // when SIGHI lists it
  "why": "..."                                                          // when we differ on purpose
}
```

`ref.as` carries the SIGHI row verbatim, because SIGHI lumps where Taseer splits
— "kelp, seaweed, algae" is a single row — and a loose match has to stay visible
rather than being presented to the reader as a disagreement.

`sourceState` is derived in `assets/js/data.js`, never stored:

| State | Count | Meaning |
|---|---|---|
| `verified` | 71 | SIGHI lists it, we agree on score and markers |
| `reasoned` | 5 | SIGHI lists it, we differ, `why` says why |
| `unreviewed` | 111 | SIGHI lists it, we differ, nobody has adjudicated it |
| `derived` | 1813 | SIGHI does not list it — most dishes and world foods |

**`unreviewed` is a real state and it renders as one.** The card says nobody has
worked out which reading is right. Writing 111 plausible-sounding rationales
would have looked more finished and been worth less than nothing.

Live consequence, found by this audit: **cumin** is Taseer 0 and SIGHI 2 `L`,
and it sits in two *reactive* preparations. On SIGHI's number those preparations
fail the validator's own reactive rule. The guard is only ever as good as the
data it guards.

## Histamine mechanism tags

Four, mirroring SIGHI's four markers one-for-one:

| Taseer tag | SIGHI | Means |
|---|---|---|
| `high-histamine` | H | The food arrives carrying histamine |
| `liberator` | L | Triggers release of the body's own |
| `other-amines` | A | Tyramine, putrescine, phenylethylamine — not histamine |
| `dao-blocker` | B | Inhibits diamine oxidase or another degrading enzyme |

SIGHI's `H!` (highly perishable, rapid histamine formation) has no equivalent and
is currently folded into `high-histamine`.

**The `dao-blocker` rule (set 2026-08-19):** applied where SIGHI marks B, and
inherited only through an ingredient SIGHI marks B. SIGHI's B set is alcohol,
the tea plant, mate, energy drinks, theobromine and vitamin C. **Caffeine on its
own does not confer it** — SIGHI rates coffee 1 with no marker, and the compound
it names for DAO inhibition is theobromine. Eight coffees carried a wrong
`dao-blocker` between 2026-08-17 and 2026-08-19 on the opposite assumption.

**`other-amines` is not part of the Reactive → Avoid rule.** `reactiveVerdict()`
in `assets/js/data.js` avoids on SIGHI ≥ 2, `liberator` or `dao-blocker` only,
and the preparation check in `validate-data.mjs` mirrors exactly that list.
Do not widen one without the other.

## Sources

- **Histamine:** SIGHI compatibility list (the reference allergists hand out) — scores + mechanism tags.
- **TCM / Ayurveda / Unani:** classical classifications as commonly documented; write-ups are original prose (no copied text; zero licensing exposure).
- **Nutrition:** USDA FoodData Central for raw/simple foods; manual estimates for South Asian/Arabic dishes FDC lacks, marked as estimates.

## Miss log

Search misses append `{query, timestamp}` to localStorage. A small "suggest foods you searched for" view lets the owner export/read the list to drive the next batch.
