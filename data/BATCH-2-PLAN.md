# Taseer dataset — Batch 2 plan (250 → 500)

Drafted 2026-08-07. Same curation model as batch 1: Claude classifies, owner
spot-checks. Every entry carries per-system confidence; thin evidence is marked
`contested` rather than guessed confidently.

## Targets

| Category | Now | Batch 2 | After | Why this size |
|---|---:|---:|---:|---|
| fruit | 41 | 30 | 71 | Chinese herbs-as-food, tropical/desi gaps, dried-vs-fresh splits |
| vegetable | 41 | 38 | 79 | The big one — remaining desi sabzis, Chinese greens/fungi |
| grain | 18 | 20 | 38 | Flours and breads are entirely absent today |
| spice | 38 | 42 | 80 | **Cooking oils are missing altogether** — a real hole for a taseer app |
| protein | 37 | 36 | 73 | Remaining dals, organ meats, more fish, cured meats |
| dairy | 11 | 15 | 26 | Thinnest category in the set by a wide margin |
| drink | 20 | 24 | 44 | Desi coolers/warmers, more teas, packaged drinks |
| dish | 44 | 45 | 89 | Arabic mezze + stews, South Indian, sweets, more Chinese/Western |
| **Total** | **250** | **250** | **500** | |

## Priority order this batch follows

From `README.md`'s batch-2 list, in order:

1. **Miss-log** — *blocked, needs the owner.* Me → Search misses → Copy, then
   paste the list. Real searches beat my guesses at what is missing.
2. Remaining desi sabzis and dals → vegetables, proteins
3. Chinese herbs-as-food (goji, red dates/jujube, white fungus) → fruits, vegetables
4. Arabic mezze and stews → dishes
5. Western processed/packaged → spices/condiments, dairy, dishes
6. Alcohol → *decision needed, see below*

Plus one gap of my own finding: **no cooking oils at all**. Mustard oil, sesame
oil, coconut oil and olive oil are strongly and consistently classified in Unani
and Ayurveda, they are what every one of these four cuisines cooks in, and a
"does this run hot or cold" app that cannot answer *sarson ka tel* has a hole in
the middle of it.

## Decisions needed before those entries can be written

**1. Alcohol.** Skipped in batch 1 as a household-mix call. It matters twice
over: classically hot/dry in Unani, and beer/wine are among the worst histamine
offenders on the SIGHI list — a reactive-day list that omits wine is misleading.
Options: include (~6 entries: beer, red wine, white wine, spirits, cider, rice
wine), omit again, or include with a note. **Default if you say nothing: omit,
matching batch 1.**

**2. Cured pork.** Batch 1 has one pork entry. Bacon, ham, salami, chorizo are
the textbook SIGHI 3 cured meats — the "why did my sandwich flare me" foods that
batch 1 deliberately included elsewhere as teaching negatives. Same question:
include, omit, or include as teaching negatives only. **Default: include salami
and bacon as teaching negatives, no more.**

**3. Organ meats.** Liver, kidney, tripe, brain, trotters are staples in desi and
Arabic kitchens and classically very hot in Unani. **Default: include liver,
kidney and bone broth; skip the rest.**

Everything else proceeds without these answers — they touch ~10 of 250 entries.

## The list

### Fruits (30)
amla · jujube-red-date · goji-berry · olives · pomelo · sweet-lime · passion-fruit
· star-fruit · durian · mangosteen · rambutan · loquat · quince · blackberry
· nectarine · plantain · black-currant · ber · phalsa · bael · soursop · kumquat
· cactus-pear · green-mango · jamun · breadfruit · cape-gooseberry · dried-figs
· dried-apricot · dried-cranberry

*Notes:* durian and mangosteen are the classic TCM heating/cooling pair and worth
having together. Green mango vs ripe mango is a genuine taseer split, not a
duplicate. Dried figs/apricots/cranberries split out from their fresh entries per
batch 1's own note — drying changes both the taseer reading and the SIGHI score.

### Vegetables (38)
drumstick · ivy-gourd · pointed-gourd · snake-gourd · ash-gourd · cluster-beans
· flat-beans · raw-banana · elephant-yam · colocasia-leaves · amaranth-greens
· bathua · dill-leaves · kachnar · green-papaya · banana-flower · bamboo-shoots
· wood-ear-mushroom · white-fungus · enoki · oyster-mushroom · seaweed-nori
· kelp · water-chestnut · daikon · burdock · garlic-chives · chayote · jicama
· brussels-sprouts · leek · fennel-bulb · artichoke · swiss-chard · arugula
· watercress · endive · sweetcorn-baby

### Grains (20)
besan · atta · maida · rice-flour · poha · puffed-rice · vermicelli · roti
· naan · pita-bread · sourdough · rye-bread · tortilla · rye · spelt · farro
· black-rice · red-rice · udon · soba

### Spices, condiments & oils (42)
**Oils (6):** mustard-oil · sesame-oil · coconut-oil · olive-oil · sunflower-oil · palm-oil
**Herbs (8):** bay-leaf · oregano · thyme · rosemary · sage · lemongrass · thai-basil · kaffir-lime-leaf
**Spices (14):** white-pepper · long-pepper · mace · allspice · paprika · caraway
· anise-seed · poppy-seed · galangal · amchur · anardana · chaat-masala · five-spice · baharat
**Condiments (14):** tahini · miso · fish-sauce · oyster-sauce · hoisin · gochujang
· harissa · ketchup · mayonnaise · apple-cider-vinegar · balsamic-vinegar
· rice-vinegar · maple-syrup · date-syrup

### Proteins (36)
**Dals (7):** chana-dal · toor-dal · masoor-whole · moth-beans · horse-gram · pinto-beans · lima-beans
**Meat (7):** turkey · quail · veal · liver · kidney · bone-broth · salami
**Fish/seafood (10):** cod · tilapia · pomfret · rohu · hilsa · anchovies · mussels · clams · oysters · scallops
**Plant protein (5):** tempeh · seitan · soy-chunks · lupini · peanut-butter
**Nuts/seeds (7):** hazelnuts · macadamia · pecans · brazil-nuts · hemp-seeds · watermelon-seeds · melon-seed-mix

### Dairy (15)
cheddar · feta · halloumi · cottage-cheese · ricotta · cream-cheese · sour-cream
· kefir · condensed-milk · evaporated-milk · khoya · malai · goat-milk
· buffalo-milk · greek-yogurt

### Drinks (24)
oolong-tea · white-tea · puerh-tea · jasmine-tea · chamomile-tea · ginger-tea
· fennel-tea · jeera-water · thandai · jaljeera · aam-panna · nimbu-pani
· badam-milk · kahwa · arabic-coffee · karak-chai · tamarind-drink · coconut-milk
· apple-juice · pomegranate-juice · mango-juice · milkshake · energy-drink · sports-drink

### Dishes (45)
**South Indian (8):** dosa · idli · sambar · rasam · upma · uttapam · vada · curd-rice
**North Indian (12):** rajma-chawal · chole-bhature · palak-paneer · matar-paneer
· baingan-bharta · bhindi-masala · kadhi · korma · rogan-josh · keema · seekh-kebab · pav-bhaji
**Desi sweets (5):** gulab-jamun · jalebi · rasgulla · barfi · kulfi
**Arabic (10):** baba-ganoush · muhammara · maqluba · koshari · molokhia · kibbeh
· manakish · harira · tagine · warak-enab
**Chinese (5):** kung-pao-chicken · sweet-sour-pork · peking-duck · spring-rolls · egg-drop-soup
**Western (5):** lasagna · risotto · scrambled-eggs · fish-and-chips · greek-salad

## Method

Same as batch 1, and the same honesty rules:

- Verdicts stay in each system's native vocabulary — no forcing onto one scale.
- `confidence: contested` wherever the classical record is thin. Expect a lot of
  it here: batch 2 reaches further into new-world foods, processed items and
  regional produce than batch 1 did, and TCM/Unani canons simply do not cover
  ketchup or energy drinks. Marking that honestly is the point.
- Processed and packaged items get their taseer read from their **dominant
  ingredients and preparation**, stated in the note, never invented from thin air.
- SIGHI scores follow the published list; fermented, cured, aged and long-cooked
  items are where the high scores legitimately cluster.
- Nutrition from USDA FDC per 100 g / 100 ml; dishes and composites are estimates
  and carry `"estimate": true`.
- Dish `ingredients` may only reference ids that exist — batch-2 dishes will lean
  on batch-2 ingredients, so ingredients land before the dishes that use them.

## Build order

1. dairy (15) — thinnest category, smallest batch, fastest quality read
2. fruits (30)
3. vegetables (38)
4. grains (20)
5. spices/oils/condiments (42)
6. proteins (36)
7. drinks (24)
8. dishes (45) — last, so every ingredient id they reference already exists

Validator after each category: `node scripts/validate-data.mjs`
