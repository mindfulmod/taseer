// Validates the Taseer food dataset: schema, enums, unique ids, dish ingredient refs.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "foods");
const CATEGORIES = ["fruit", "vegetable", "grain", "spice", "protein", "dairy", "drink", "dish"];
const CUISINES = ["south-asian", "arabic", "chinese", "western",
  // Batch 5 (2026-08-07): scope widened from four household cuisines to
  // world kitchens, by the owner's decision. See specs/02-data-spec.md.
  "japanese", "korean", "southeast-asian", "latin-american", "persian-turkish", "african", "eastern-european"];
const CONFIDENCE = ["high", "moderate", "contested"];
const TCM = ["cold", "cool", "neutral", "warm", "hot"];
const AYUR = ["cooling", "heating"];
const UNANI = ["cold", "cold-dry", "cold-moist", "neutral", "hot", "hot-dry", "hot-moist"];
// Mirrors SIGHI's four markers. `other-amines` is its A — tyramine, putrescine
// and phenylethylamine compete for the same degradation pathway as histamine
// without being histamine, which is why SIGHI marks dark chocolate at all.
// Without it, an A-only food either loses its mechanism or gets mislabelled as
// something it is not; chocolate was carrying `dao-blocker` for exactly that
// reason until 2026-08-19.
const TAGS = ["liberator", "high-histamine", "dao-blocker", "other-amines"];
const REMEDY_STATES = ["too-hot", "too-cold"];
const PREP_KINDS = ["drink", "bowl", "plate", "side", "sweet"];

// Mirrors data.js compositeHeat/heatClass. Duplicated rather than imported: the
// validator reads data/foods/*.json directly and must not depend on the
// generated bundle, which may legitimately be stale at the moment it runs.
const HEAT = {
  tcm: { cold: -1, cool: -0.5, neutral: 0, warm: 0.5, hot: 1 },
  ayurveda: { cooling: -0.7, heating: 0.7 },
  unani: { cold: -1, "cold-dry": -1, "cold-moist": -1, neutral: 0, hot: 1, "hot-dry": 1, "hot-moist": 1 },
};
function heatClass(food) {
  const sum = ["tcm", "ayurveda", "unani"].reduce((n, s) => n + (HEAT[s][food.thermal[s].verdict] ?? 0), 0);
  const h = Math.max(-1, Math.min(1, sum / 3 / 0.9));
  return h <= -0.7 ? "cold" : h <= -0.2 ? "cool" : h < 0.2 ? "neutral" : h < 0.7 ? "warm" : "hot";
}

const errors = [];
const all = new Map();
const byCategory = {};

for (const file of readdirSync(dir).filter(f => f.endsWith(".json"))) {
  let foods;
  try { foods = JSON.parse(readFileSync(join(dir, file), "utf8")); }
  catch (e) { errors.push(`${file}: INVALID JSON — ${e.message}`); continue; }
  for (const f of foods) {
    const where = `${file} → ${f.id ?? "??"}`;
    if (!f.id || !/^[a-z0-9-]+$/.test(f.id)) errors.push(`${where}: bad id`);
    if (all.has(f.id)) errors.push(`${where}: DUPLICATE id (also in ${all.get(f.id).file})`);
    all.set(f.id, { ...f, file });
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
    if (!CATEGORIES.includes(f.category)) errors.push(`${where}: bad category ${f.category}`);
    if (!f.name || !f.description) errors.push(`${where}: missing name/description`);
    if (!f.emoji) errors.push(`${where}: missing emoji`);
    if (!Array.isArray(f.aliases)) errors.push(`${where}: aliases not array`);
    if (!Array.isArray(f.cuisines) || !f.cuisines.every(c => CUISINES.includes(c))) errors.push(`${where}: bad cuisines`);
    if (![1, 2, 3, 4].includes(f.commonness)) errors.push(`${where}: bad commonness`);
    for (const sys of ["tcm", "ayurveda", "unani"]) {
      const t = f.thermal?.[sys];
      if (!t) { errors.push(`${where}: missing thermal.${sys}`); continue; }
      const vocab = sys === "tcm" ? TCM : sys === "ayurveda" ? AYUR : UNANI;
      if (!vocab.includes(t.verdict)) errors.push(`${where}: bad ${sys} verdict "${t.verdict}"`);
      if (!CONFIDENCE.includes(t.confidence)) errors.push(`${where}: bad ${sys} confidence`);
    }
    if (![0, 1, 2, 3].includes(f.histamine?.sighi)) errors.push(`${where}: bad sighi`);
    if (!Array.isArray(f.histamine?.tags) || !f.histamine.tags.every(t => TAGS.includes(t))) errors.push(`${where}: bad histamine tags`);
    const n = f.nutrition;
    if (!n || [n.kcal, n.protein, n.carbs, n.fat].some(v => typeof v !== "number") || !n.highlight) errors.push(`${where}: bad nutrition`);
    if (f.remedy) for (const [k, v] of Object.entries(f.remedy)) {
      if (!REMEDY_STATES.includes(k) || !["eat", "avoid"].includes(v)) errors.push(`${where}: bad remedy ${k}:${v}`);
    }
    if (f.ingredients && f.category !== "dish" && f.category !== "drink") errors.push(`${where}: ingredients on non-dish`);
  }
}

// Guna — Ayurveda's second axis, about mental effect rather than temperature.
// Separate from `thermal.ayurveda`, which carries virya (heating/cooling) only.
// Optional: it is assigned where the sources support it and left off where they
// do not, which is most of the long tail.
const GUNA = ["light", "restless", "heavy"];
for (const f of all.values()) {
  if (!f.guna) continue;
  const where = `${f.file} → ${f.id}`;
  if (!GUNA.includes(f.guna.verdict)) errors.push(`${where}: guna must be ${GUNA.join("|")}, got ${f.guna.verdict}`);
  if (!CONFIDENCE.includes(f.guna.confidence)) errors.push(`${where}: bad guna confidence ${f.guna.confidence}`);
}

// Stimulant profile — which molecules, never how many milligrams. Dose per cup
// swings an order of magnitude with grind, steep and serving size, and the
// schema has no portion concept to hang a number on; the compounds present are
// stable and are what actually explains why two equally caffeinated drinks feel
// nothing alike.
const COMPOUNDS = ["caffeine", "theanine", "theobromine", "theophylline"];
for (const f of all.values()) {
  const st = f.stimulant;
  if (!st) continue;
  const where = `${f.file} → ${f.id}`;
  if (!Array.isArray(st.compounds)) errors.push(`${where}: stimulant.compounds must be an array`);
  else for (const c of st.compounds) {
    if (!COMPOUNDS.includes(c)) errors.push(`${where}: unknown stimulant compound "${c}"`);
  }
  if (!st.note) errors.push(`${where}: stimulant needs a note — the compound list alone tells the reader nothing`);
  if (/\b\d+\s?mg\b/i.test(st.note)) errors.push(`${where}: stimulant note quotes a milligram dose; this schema has no portion to hang it on`);
}

// Effects — documented traditional/anecdotal food-level effects (chamomile's
// calming reputation, ginger's anti-nausea one). Optional and rare by design:
// present only where a specific tradition or folk-medicine source documents an
// effect for THIS food by name, never assigned as a default. Reuses the same
// high/moderate/contested confidence vocabulary as thermal and guna, rather
// than histamine's verified/reasoned/unreviewed states — those exist to audit
// a reading against a named external list (SIGHI), and there is no equivalent
// single reference list for anecdotal effects to check against.
const EFFECTS = ["calming", "sedative", "stimulating", "digestive", "anti-nausea", "carminative", "diuretic",
  // Batch (2026-09-03): four new tags researched against clinical evidence —
  // see the readout cited in that commit. focus (theanine+caffeine teas),
  // sleep-aid (tart/sour cherry), energizing (ginseng), mood-lifting (saffron).
  "focus", "sleep-aid", "energizing", "mood-lifting",
  // Batch (2026-09-03, second pass): AM asked specifically about foods that
  // make it hard to pay attention — the negative side of "focus" that the
  // first pass of this batch shipped only the positive half of. `impairing`
  // answers that, restricted to actual alcoholic drinks (strong, universally
  // accepted pharmacology at typical drinking doses) rather than to meal
  // composition, which the bloating amendment already ruled out as a shape
  // effects can't take — every drink genuinely drunk as alcohol got it (18
  // in all, via a sweep of every histamine dao-blocker entry, filtered down
  // to the ones where the mechanism is actually alcohol rather than tea's
  // catechins or energy drinks' theobromine); wine/rice-wine used only as a
  // cooking ingredient (mirin, shaoxing wine, hours-long braises) did not,
  // since the dose eaten is small and/or the alcohol is substantially cooked
  // off. Three more from an open-ended deepen-the-vocab pass: `laxative`
  // (prunes, kiwi, figs, flaxseed, coffee — bowel-motility RCTs, several
  // beating psyllium or lactulose head to head; kiwi keeps its sleep-aid tag
  // too, same precedent as ginseng carrying one note into two dishes),
  // `blood-sugar-moderating` (all seven vinegars for acetic acid, fenugreek
  // seed for its galactomannan fibre, cinnamon with a coumarin-safety flag
  // in its own note — all pharmacological actions the food itself performs
  // on a meal, the same shape as the already-shipped digestive/carminative
  // tags, not the meal's own composition acting on itself the way the
  // declined sugar-crash claim was), `analgesic` (ginger for dysmenorrhea
  // specifically, matched against mefenamic acid and ibuprofen in RCTs —
  // turmeric's curcumin has real trial evidence too, but only at supplement
  // doses far past what bioavailability lets a spoonful of powder deliver,
  // so anti-inflammatory as a category stays out; see commit for the full
  // trail, including green tea/appetite-suppression, also excluded).
  "impairing", "laxative", "blood-sugar-moderating", "analgesic",
  // Batch (2026-09-03, pass 5): open-ended sweep for genuinely new,
  // well-evidenced categories beyond the 11 shipped so far. Three cleared the
  // bar. `blood-pressure-lowering` — garlic (a dozen-plus meta-analysed RCTs,
  // strongest in hypertensives, standardized-powder doses close to a clove a
  // day) and garlic-powder (the literal form most of those trials used);
  // beetroot and beetroot-juice, spinach, and arugula, all via the same
  // dietary-nitrate → nitric-oxide pathway with real RCT support at
  // food-sized doses (beetroot's whole-root dose is the least precise of the
  // four, since nitrate content swings with soil and variety — flagged in
  // its own note); hibiscus tea, backed by an umbrella review of 26 RCTs at
  // ordinary tea-drinking amounts. `immune-supportive` — garlic again (two
  // independent placebo-controlled trials, an allicin capsule and an aged
  // extract, both at concentrated-but-food-adjacent doses, both showing real
  // NK/γδ-T cell and illness-frequency effects, honestly caveated against
  // the Cochrane review that called the first trial alone insufficient);
  // shiitake (one whole-dried-mushroom RCT at an ordinary 5-10g/day dose,
  // real immune-marker shifts, same single-trial calibration as walnuts'
  // sleep-aid entry); elderberry, at `contested` rather than moderate — the
  // pooled trials behind it are mostly funded by one supplement maker, and
  // the sole independent trial found no effect, which the note says plainly.
  // `cough-suppressant` — honey, backed by a Cochrane review of six trials in
  // nearly 900 children finding it beats placebo and no-treatment and holds
  // its own against dextromethorphan, at exactly the spoonful dose tested.
  // Declined this pass, with reasons: garlic/cold-cure evidence stopping at
  // immune-supportive rather than reaching a bare "antimicrobial" tag, since
  // the mechanism-specific tags say more; cranberry/UTI, researched
  // specifically per the brief — the highest-quality synthesis (Cochrane,
  // 24 trials) found no significant effect, and newer meta-analyses claiming
  // benefit in subgroups don't overturn that, so the popular claim stays
  // out despite looking plausible; celery for blood pressure, which turned
  // out to be seed-extract evidence only (capsules standardized to
  // 3-n-butylphthalide) with no whole-stalk trial behind it — the same
  // supplement-dose-inflation shape as the already-declined turmeric and
  // green tea; oyster mushroom's beta-glucan (pleuran) evidence, same
  // shape again — purified extract capsules, not a food-sized mushroom
  // serving; L-theanine anti-anxiety, researched specifically per the
  // brief — real RCTs exist, but the effective dose (200-400mg) is 7-20
  // cups of tea, so this is the theanine/EGCG dose-inflation pattern again,
  // not a real distinction from the already-shipped `calming`/`focus` tags;
  // vitamin-C/citrus for immune support, the other common misconception
  // checked directly — Cochrane's own pooled analysis (11,306 participants)
  // found no effect on cold incidence in the general population, benefit
  // showing up only in endurance-athlete subgroups, so this is the same
  // deficiency-correction-only shape as the already-declined iron/B12 claim;
  // honey's wound-healing evidence, which is real but topical, outside this
  // app's eaten-food scope entirely; thyme for cough, where every RCT found
  // used a thyme+ivy or thyme+primrose combination extract rather than
  // thyme alone, so no single-food claim can be cleanly supported.
  "blood-pressure-lowering", "immune-supportive", "cough-suppressant",
  // Batch (2026-09-03, pass 6): a rigor spot-audit of four existing entries
  // (saffron/mood-lifting, walnuts/sleep-aid, honey/cough-suppressant,
  // garlic/blood-pressure-lowering) turned up one real inaccuracy — garlic's
  // note claimed meta-analyses pooling "well over a thousand participants";
  // the actual literature tops out around 970 (20 trials) to 738 (12 trials),
  // never over a thousand, so the note was corrected in place. The other
  // three checked out: saffron's 2025 trial is genuinely 202 participants and
  // the CANMAT/WFSBP task force guideline citation is real; walnuts' 76-
  // participant 2025 trial matches on every number including the specific
  // p-values for sleep latency and efficiency; honey's Cochrane review is
  // genuinely six trials/899 children with the stated comparator results.
  // Three new tags cleared the bar this pass. `bone-supportive` — prunes,
  // backed by a 12-month RCT in 235 postmenopausal women where 50g/day
  // preserved hip BMD against a losing control group, credited to polyphenol
  // action on bone remodelling distinct from the fruit's laxative mechanism.
  // Dairy/calcium, researched specifically per the brief, did not clear the
  // bar: 44 cohort studies on dietary calcium/dairy and fracture mostly found
  // no association, only two RCTs exist on food-form (not supplement) calcium,
  // and even supplement RCTs lose significance at lowest risk of bias — real
  // uncertainty, not a case of dose-inflation like the declined categories,
  // so this is left out rather than added on weak footing. `liver-supportive`
  // — coffee, on cohort evidence rather than RCTs (cirrhosis and fibrosis
  // outcomes can't ethically or practically be randomised over the years they
  // take to develop): pooled analyses spanning hundreds of thousands of
  // participants show a consistent dose-response (each +2 cups/day roughly
  // halves pooled cirrhosis risk), replicated across alcoholic and viral
  // hepatitis subgroups, with decaf sharing the benefit — pointing to
  // chlorogenic acid and related compounds alongside caffeine. Milk thistle,
  // named in the brief, isn't in the dataset. `satiety` — a pulses-as-a-class
  // meta-analysis (9 RCTs, 31% greater fullness from ~160g/meal, an ordinary
  // portion) swept across every whole dried pulse in the dataset (chickpeas,
  // both lentils, mung beans, urad dal, kidney/black/pinto/lima/fava beans,
  // black-eyed peas, chana/toor dal, kala chana, horse gram, adzuki beans) —
  // soybeans excluded (higher-fat profile puts them outside the "pulses"
  // definition the trials used) and moth beans excluded (this dataset's own
  // entry describes it as usually sprouted, a different food than the dried
  // whole legume the trials tested. Oats also cleared the bar (a 22-trial
  // review plus a dedicated isocaloric-breakfast RCT, both crediting
  // beta-glucan viscosity) at `moderate`; chia seeds only at `contested` —
  // real trials exist but conflict, one finding a real satiety effect and
  // another finding none despite a real glycaemic-response change. Checked
  // and declined: `appetite-suppressing`-shaped concern re-litigated by
  // this satiety research was avoided by requiring isocaloric-controlled
  // trial designs throughout, the same discipline that kept the earlier
  // appetite-suppressing/concentration-impairing categories out — this is a
  // food property (fibre/protein content) acting on a fixed-calorie meal,
  // not the meal's own composition or size doing the work.
  // `anticoagulant`/blood-thinning, researched specifically per the brief —
  // declined, and flagged clearly given the real warfarin/pre-surgery safety
  // stakes: case reports exist for both garlic and ginger raising INR, but
  // the actual controlled trials point the other way — a 12-week
  // placebo-controlled trial of aged garlic extract in 48 people stabilised
  // on warfarin found no INR change, and controlled human trials of ginger
  // found no effect on warfarin's pharmacokinetics either. Adding a tag the
  // best controlled evidence argues against would overstate a claim this
  // app has no mechanism to safety-caveat properly, so it stays out; the
  // case-report signal is real but unconfirmed, worth knowing about, not
  // worth shipping as a documented effect. Vitamin-K leafy greens
  // (clotting-supportive — the opposite direction) declined for a different
  // reason: this is basic nutrient physiology (K is a clotting-factor
  // cofactor), not a food doing something beyond its baseline nutritional
  // role the way every other entry in this vocabulary does, and "helps you
  // clot better" is not a benefit framing that makes sense for a general
  // audience the way calming or digestive do. `oral-health`/antibacterial-
  // in-mouth — green tea catechins, researched per the brief — declined:
  // xylitol has no foods in this dataset to hang it on, and green tea's
  // trials use a concentrated mouthwash held in the mouth for 30-60 seconds,
  // a different dose and contact-time than swallowing a cup of tea; the
  // specific systematic review pooling this evidence also found high
  // heterogeneity and risk of bias, with green tea not clearly beating
  // placebo overall despite some individual trials showing benefit.
  "bone-supportive", "liver-supportive", "satiety"];
// A documented-effect note must read as traditional/anecdotal information, never
// as a personalised or predictive promise (product spec's traditional-info
// framing rule — "traditionally classified as", never "this will lower your
// body heat"). Mirrors the stimulant note's mg-dose ban below.
// The verb list is enumerated, not general — extend it whenever a new effect
// category brings verbs of its own (focus/energizing/mood-lifting add
// impair/sharpen/trigger/distort/boost; impairing/laxative/blood-sugar-
// moderating/analgesic add lower/reduce/ease/moderate/relieve) rather
// than relying on the existing list to catch them by accident.
const PREDICTIVE_CLAIM = /\b(will (make|help|calm|relax|cure|fix|impair|sharpen|trigger|distort|boost|lower|reduce|ease|moderate|relieve)|cures?|treats?|guarantees?|always works)\b/i;
for (const f of all.values()) {
  if (!f.effects) continue;
  const where = `${f.file} → ${f.id}`;
  if (!Array.isArray(f.effects) || !f.effects.length) {
    errors.push(`${where}: effects must be a non-empty array when present (omit the field entirely otherwise)`);
    continue;
  }
  for (const e of f.effects) {
    if (!EFFECTS.includes(e.effect)) errors.push(`${where}: unknown effect "${e.effect}"`);
    if (!CONFIDENCE.includes(e.confidence)) errors.push(`${where}: bad effect confidence "${e.confidence}"`);
    if (!e.note) errors.push(`${where}: effect "${e.effect}" needs a note — a bare label makes an unexplained claim`);
    else if (PREDICTIVE_CLAIM.test(e.note)) errors.push(`${where}: effect "${e.effect}" note reads as a predictive/medical claim — state it as documented, not promised`);
  }
}

// Histamine provenance. `ref` records what SIGHI itself says about a food it
// lists, so the app can show its own reading next to its source instead of
// citing SIGHI and quietly departing from it — which it did on 116 of the 187
// foods SIGHI carries, with nothing anywhere saying so.
const MARK_CHARS = /^[HALB]*$/;
for (const f of all.values()) {
  const ref = f.histamine.ref;
  if (!ref) {
    if (f.histamine.why) errors.push(`${f.file} → ${f.id}: has a "why" but no "ref" to differ from`);
    continue;
  }
  const where = `${f.file} → ${f.id}`;
  if (!(ref.sighi >= 0 && ref.sighi <= 3)) errors.push(`${where}: ref.sighi out of range`);
  if (typeof ref.marks !== "string" || !MARK_CHARS.test(ref.marks)) errors.push(`${where}: ref.marks must be a subset of HALB`);
  if (!ref.as) errors.push(`${where}: ref needs "as" — the SIGHI row it was matched against, so a loose match stays visible`);
}

// Cross-reference dish/drink ingredients
for (const f of all.values()) {
  for (const ing of f.ingredients ?? []) {
    if (!all.has(ing)) errors.push(`${f.file} → ${f.id}: unknown ingredient "${ing}"`);
  }
}

// Preparations (curated simple recipes; separate id namespace, food-id references)
const preps = JSON.parse(readFileSync(join(dir, "..", "preparations.json"), "utf8"));
const prepIds = new Set();
for (const p of preps) {
  const where = `preparations.json → ${p.id ?? "??"}`;
  if (!p.id?.startsWith("prep-")) errors.push(`${where}: id must start with "prep-"`);
  if (prepIds.has(p.id)) errors.push(`${where}: DUPLICATE id`);
  prepIds.add(p.id);
  if (all.has(p.id)) errors.push(`${where}: id collides with a food id`);
  if (!p.name || !p.blurb || !p.emoji) errors.push(`${where}: missing name/blurb/emoji`);
  if (!p.why) errors.push(`${where}: missing "why" — a preparation has to say which tradition is doing the work`);
  if (!PREP_KINDS.includes(p.kind)) errors.push(`${where}: bad kind ${p.kind} (expected ${PREP_KINDS.join("|")})`);
  if (!(p.minutes > 0)) errors.push(`${where}: missing/invalid minutes`);
  if (!(p.serves > 0)) errors.push(`${where}: missing/invalid serves`);
  if (!REMEDY_STATES.includes(p.state) && p.state !== "reactive") errors.push(`${where}: bad state ${p.state}`);
  // 2–4 steps, both ends enforced. The lower bound was always here; the upper
  // one is what keeps the lane "three-step things, not recipes" as it grows —
  // without it, the format drifts into a recipe site one well-meaning entry at
  // a time, and the whole set stops being hand-maintainable.
  if (!Array.isArray(p.steps) || p.steps.length < 2 || p.steps.length > 4) {
    errors.push(`${where}: needs 2–4 steps, has ${p.steps?.length ?? 0}`);
  }
  const ing = [];
  for (const id of p.ingredients ?? []) {
    if (!all.has(id)) errors.push(`${where}: unknown ingredient "${id}"`);
    else ing.push(all.get(id));
  }

  // A preparation is a recommendation, so it has to survive being read next to
  // the remedy list that recommends it. Two of the original ten did not: the
  // "low-histamine" oat porridge carried cinnamon and the coconut-chia cooler
  // carried lime, both liberators, both sitting on the Reactive → Avoid list
  // the reader had just come from. Same reasoning as the dish/ingredient SIGHI
  // check above — the screen shows the claim and the chips together.
  if (p.state === "reactive") {
    // Mirrors reactiveVerdict() in assets/js/data.js exactly. It used to reject
    // any tag at all, which was the same rule only as long as every tag meant
    // "histamine". Adding `other-amines` broke that: SIGHI marks pear A, the
    // Reactive screen does not avoid pear, and the check failed a preparation
    // over an ingredient the screen it protects is perfectly happy with. A
    // guard that is stricter than the screen it mirrors is just a bug with a
    // good error message.
    const bad = ing.filter(
      f => f.histamine.sighi >= 2 || f.histamine.tags.includes("liberator") || f.histamine.tags.includes("dao-blocker"),
    );
    if (bad.length) {
      const which = bad.map(f => `${f.id} (SIGHI ${f.histamine.sighi}${f.histamine.tags.length ? ` ${f.histamine.tags.join("/")}` : ""})`);
      errors.push(`${where}: reactive preparation contains ${which.join(", ")} — the Reactive screen tells the reader to avoid these`);
    }
  } else if (ing.length) {
    // The thermal counterpart, deliberately weak: a cooling preparation must
    // contain something cooling. It does NOT compute a verdict from the
    // ingredients — the product spec declines that outright, because
    // preparation method changes thermal nature. Seasoning quantities of a hot
    // spice in a cold dish are normal and stay legal.
    const want = p.state === "too-hot" ? ["cold", "cool"] : ["hot", "warm"];
    if (!ing.some(f => want.includes(heatClass(f)))) {
      errors.push(`${where}: ${p.state} preparation with no ${want.join("/")} ingredient in it`);
    }
  }
}

// Stats
const total = all.size;
// ---- Cross-entry consistency ------------------------------------------------
// These catch contradictions the data can prove against itself. Both were real
// when first run (2026-08-14): nine dishes rated below an ingredient they list,
// and two foods prescribed for the state their own thermal reading argues
// against. The screen shows the rating and the ingredient chips together, so an
// inconsistency here is visible to the reader and costs trust in everything else.

// A dish may sit one level below its worst ingredient — a trace of something
// high does not drag the whole plate up — but not two.
for (const f of all.values()) {
  if (!f.ingredients?.length) continue;
  const known = f.ingredients.map(i => all.get(i)).filter(Boolean);
  if (!known.length) continue;
  const worst = Math.max(...known.map(i => i.histamine.sighi));
  if (f.histamine.sighi < worst - 1) {
    const which = known.filter(i => i.histamine.sighi === worst).map(i => i.id).join("/");
    errors.push(`${f.id}: SIGHI ${f.histamine.sighi} but lists ${which} at ${worst} — raise the dish, or drop the ingredient if it isn't really in it`);
  }
}

// A remedy must not point against the food's own composite reading.
const HEAT_V = {
  tcm: { cold: -1, cool: -0.5, neutral: 0, warm: 0.5, hot: 1 },
  ayurveda: { cooling: -0.7, heating: 0.7 },
  unani: { cold: -1, "cold-dry": -1, "cold-moist": -1, neutral: 0, hot: 1, "hot-dry": 1, "hot-moist": 1 },
};
for (const f of all.values()) {
  if (!f.remedy || !f.thermal?.tcm) continue;
  const h = ["tcm", "ayurveda", "unani"].reduce((n, s) => n + (HEAT_V[s][f.thermal[s].verdict] ?? 0), 0) / 3 / 0.9;
  if (f.remedy["too-hot"] === "eat" && h > 0.2) errors.push(`${f.id}: prescribed for "too hot" but reads warm (${h.toFixed(2)})`);
  if (f.remedy["too-cold"] === "eat" && h < -0.2) errors.push(`${f.id}: prescribed for "too cold" but reads cool (${h.toFixed(2)})`);
}

// Macros cannot exceed the 100 g they are measured against.
for (const f of all.values()) {
  const n = f.nutrition;
  if (!n) continue;
  const g = n.protein + n.carbs + n.fat;
  if (g > 100.5) errors.push(`${f.id}: macros sum to ${g.toFixed(1)} g per 100 g`);
}

const contested = [...all.values()].filter(f => Object.values(f.thermal ?? {}).some(t => t?.confidence === "contested"));
const conflicts = [...all.values()].filter(f => {
  const t = f.thermal; if (!t?.tcm || !t?.ayurveda || !t?.unani) return false;
  const heat = v => /hot|warm|heating/.test(v) ? 1 : /cold|cool/.test(v) ? -1 : 0;
  const dirs = [heat(t.tcm.verdict), heat(t.ayurveda.verdict), heat(t.unani.verdict)].filter(d => d !== 0);
  return new Set(dirs).size > 1;
});
const sighiDist = [0, 1, 2, 3].map(s => [...all.values()].filter(f => f.histamine.sighi === s).length);
// Remedy lists are derived from the band in-app (see data/README.md); the JSON
// `remedy` field is only an override. Report both, or this reads as a coverage
// gap that no longer exists.
const bandOf = f => {
  const h = ["tcm", "ayurveda", "unani"].reduce((n, s) => n + (HEAT_V[s][f.thermal[s].verdict] ?? 0), 0) / 3 / 0.9;
  return h <= -0.7 ? "cold" : h <= -0.2 ? "cool" : h < 0.2 ? "neutral" : h < 0.7 ? "warm" : "hot";
};
const derivedEat = state => [...all.values()].filter(f => {
  const hand = f.remedy?.[state];
  if (hand) return hand === "eat";
  const c = bandOf(f);
  return state === "too-hot" ? c === "cold" || c === "cool" : c === "warm" || c === "hot";
}).length;
const handTags = [...all.values()].filter(f => f.remedy).length;

console.log(`TOTAL FOODS: ${total}`);
console.log("By category:", byCategory);
console.log(`SIGHI distribution 0/1/2/3: ${sighiDist.join(" / ")}`);
console.log(`Cross-tradition conflicts (hot vs cold disagreement): ${conflicts.length}`);
console.log(`  e.g. ${conflicts.slice(0, 12).map(f => f.id).join(", ")}`);
console.log(`Entries with ≥1 contested confidence: ${contested.length}`);
console.log(`Remedy "eat" lists (derived) — too-hot: ${derivedEat("too-hot")}, too-cold: ${derivedEat("too-cold")}  ·  hand overrides: ${handTags}`);
console.log(`Aliases total: ${[...all.values()].reduce((a, f) => a + f.aliases.length, 0)}`);
console.log(`Preparations: ${preps.length}`);
console.log(`Foods with a documented effect: ${[...all.values()].filter(f => f.effects).length}`);

if (errors.length) { console.error(`\n${errors.length} ERRORS:`); errors.forEach(e => console.error(" -", e)); process.exit(1); }
console.log("\nAll checks passed ✅");
