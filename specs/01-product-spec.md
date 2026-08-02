# Taseer — Product Spec

**Locked 2026-08-02** via discovery interview (20 questions, 5 rounds). Repo folder: `Foodex` (name is **Taseer** — تاثیر, the Urdu/Arabic word for a food's thermal effect on the body).

## One-liner

A fast, graphical web app that tells you whether any food runs hot or cold across the healing traditions (TCM · Ayurveda · Unani) and whether it's a histamine risk (Western/SIGHI) — built around a remedy finder: "my body feels hot → show me accessible cooling foods now."

## The soul (locked)

**Remedy finder first.** The home screen asks "How does your body feel?" — food search exists but is the secondary entry point. This is NOT a food encyclopedia; it's a fix-how-I-feel tool with a reference library attached.

## Audience & posture (locked)

- **v1 is for the owner**, shareable-by-URL later. No accounts, no backend, no user data leaves the device.
- Cultures covered by the dataset: **South Asian, Arabic, Chinese, Western** household foods.

## Core loop (locked)

1. Open app → tap body state: **Too hot · Too cold · Reactive/itchy · Balanced (browse)**
2. Get two lists: **Eat this** (helping foods) and **Avoid this** (aggravating foods)
3. Lists ranked by **common-kitchen accessibility** (pantry-commonness tag; everyday items first), with user's **Favorites floated to top**
4. Tap any food → verdict-first food card

No richer symptom picker (declined 2026-08-02: symptom-checker creep = medical-claim territory + 5x curation).

## Verdict presentation (locked)

**Per-system badges, never a synthesized score.** Each food shows: TCM · Ayurveda · Unani thermal badges + SIGHI histamine badge. Disagreement between traditions is displayed honestly as a feature. (Declined: single synthesized verdict — invents an authority no tradition endorses; declined: pick-your-tradition onboarding — hides the interesting comparison.)

## Histamine layer (locked)

SIGHI-style **0–3 compatibility score** + mechanism tags: **liberator / high-histamine / DAO-blocker**. Renders as one badge; mechanism detail in card expand.

## Food card (locked hierarchy)

1. **Top:** thermal badges per tradition + histamine badge + one-line description
2. **Middle:** 4–5 glance stats (macro rings: calories, protein, carbs, fat, key micro)
3. **Expand:** fuller nutrition, "typically contains" ingredient chips (dishes), why-classified notes with named sources + confidence level

## Cooked dishes (locked)

**Dish-level verdicts** (traditions classify dishes as wholes) + "typically contains" ingredient chip row, each chip linking to that ingredient's card. Declined: computing dish verdicts from ingredient sums (false precision — preparation method changes thermal nature).

## Search (locked)

- English display names + **romanized alias search** (bhindi/karela/bamia/bok choy all resolve)
- **Search miss** → nearest-relative suggestions + local miss log (drives next data batch priorities). Declined for v1: live AI fallback lookup.

## Browse & discovery (locked — all four)

- **Category grid** (Fruits · Vegetables · Grains · Spices · Proteins · Dairy · Drinks · Dishes-by-cuisine)
- **Curated lists** ("Top 10 cooling foods", "Everyday heating culprits", "Histamine-safe snacks") — includes **5–10 simple preparations** (cucumber-mint water etc.); full recipe lane stays out of v1
- **Compare view** (2–3 foods side by side)
- **Spectrum explorer** (coldest→hottest interactive strip; showcase of the thermal identity)

## Personal layer (locked — localStorage only)

- **Favorites** — float to top of remedy lists
- **My triggers** — warning ring everywhere the food appears, including inside dish ingredient chips
- **Recently viewed** — home screen row

## Safety posture (locked)

**Traditional-info framing.** Copy always says "traditionally classified as cooling in TCM," never "this will lower your body heat." One-time dismissible banner: informational, not medical advice; severe reactions → seek care. Histamine data cites SIGHI. No treatment claims anywhere.

## Platform (locked)

**Static PWA, offline-first.** One responsive site, installable, full dataset bundled locally (~1000 foods ≈ a few hundred KB), instant search with zero network. Free hosting (GitHub Pages or Cloudflare Pages). No backend.

## v2 parking lot (dated decisions, not omissions — parked 2026-08-02)

- AI live lookup for unknown foods (revisit after miss-log data exists)
- Eating log / tracking (a second product; needs its own interview)
- Native-script names on cards (بامية / 苦瓜) — romanized aliases only in v1
- Full recipe/preparation content lane
- Accounts / sync / any backend

## Definition of done, v1

Remedy finder (4 states), search with aliases + miss log, food cards, all four browse surfaces, personal layer, thermal design system, ~250 classified foods live, deployed to a URL that works installed on the owner's phone.
