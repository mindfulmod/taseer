// Thermal consistency check: for every food that lists `ingredients` (dishes,
// and the handful of compound drinks), does its own tcm/ayurveda/unani verdict
// agree with the confidence-weighted direction its own ingredients point?
//
// Scope note (2026-09): this originally checked dishes.json only. A prior
// scoping pass found the same blind spot — a verdict authored confidently and
// never checked against anything — is not unique to dishes, so this now walks
// every data/foods/*.json file and checks any food with a non-empty
// `ingredients` array, regardless of category. Foods without one (almost all
// raw fruit/veg/spice/protein/dairy entries) have nothing to derive a
// majority from and are skipped outright — that's expected, not an error.
//
// This is a CANDIDATE QUEUE for human/worker review, not an auto-fixer. A
// preparation method (frying, roasting, long fermentation) legitimately shifts
// a dish's thermal nature away from its raw ingredients' average — the earlier
// scoping pass hit exactly this on besan-ladoo/ghevar/gujiya. A flag here means
// "look at this", never "this is wrong".
//
// Run: node scripts/check-dish-consistency.mjs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "foods");
const SYSTEMS = ["tcm", "ayurveda", "unani"];

// Same per-verdict heat magnitudes validate-data.mjs uses for compositeHeat/
// heatClass, duplicated for the same reason it duplicates them: this script
// reads data/foods/*.json directly and must not depend on anything generated.
const HEAT = {
  tcm: { cold: -1, cool: -0.5, neutral: 0, warm: 0.5, hot: 1 },
  ayurveda: { cooling: -0.7, heating: 0.7 },
  unani: { cold: -1, "cold-dry": -1, "cold-moist": -1, neutral: 0, hot: 1, "hot-dry": 1, "hot-moist": 1 },
};

// Confidence weighting for ingredient evidence. Contested readings are
// deliberately down-weighted to "weak/unreliable" rather than excluded
// outright — a dish surrounded entirely by contested ingredients still tells
// you something, just not much.
const CONF_WEIGHT = { high: 1.0, moderate: 0.6, contested: 0.2 };
// Same idea applied to the DISH's own verdict confidence, as a mild multiplier
// on rank: a high-confidence verdict that disagrees with strong ingredient
// evidence is more surprising — and more worth a human's time — than a
// contested one that already admits uncertainty.
const DISH_CONF_WEIGHT = { high: 1.0, moderate: 0.85, contested: 0.5 };

// Below this the ingredient-majority is called "neutral" rather than a
// direction — matches the ±0.15 band already implicit in the ±0.5/±0.7/±1
// verdict magnitudes above (a single "cool"/"cooling" ingredient should be
// enough to tip it, pure rounding noise should not).
const DIR_THRESHOLD = 0.15;
// Minimum confidence-weighted evidence before a majority is trusted at all —
// below this there just isn't enough to compare the dish's verdict against.
// Roughly: one moderate-confidence ingredient, or several contested ones.
const MIN_EVIDENCE = 0.6;

function direction(score) {
  if (score > DIR_THRESHOLD) return "heating";
  if (score < -DIR_THRESHOLD) return "cooling";
  return "neutral";
}

// ---- Load everything ------------------------------------------------------
const all = new Map();
for (const file of readdirSync(dir).filter(f => f.endsWith(".json"))) {
  const foods = JSON.parse(readFileSync(join(dir, file), "utf8"));
  for (const f of foods) all.set(f.id, { ...f, file });
}

const checkable = [...all.values()].filter(f => Array.isArray(f.ingredients) && f.ingredients.length > 0);

// ---- Part 1: thermal consistency ------------------------------------------
const flags = [];
for (const f of checkable) {
  for (const sys of SYSTEMS) {
    const dishT = f.thermal?.[sys];
    if (!dishT) continue; // schema violation, not this script's job — validate-data.mjs catches it
    const dishScore = HEAT[sys][dishT.verdict] ?? 0;
    const dishDir = direction(dishScore);

    const evidence = [];
    for (const id of f.ingredients) {
      const ing = all.get(id);
      const it = ing?.thermal?.[sys];
      if (!ing || !it) continue; // unknown ingredient id is validate-data's job; missing thermal likewise
      const w = CONF_WEIGHT[it.confidence] ?? 0;
      const v = HEAT[sys][it.verdict] ?? 0;
      evidence.push({ id, verdict: it.verdict, confidence: it.confidence, weight: w, value: v });
    }
    const totalWeight = evidence.reduce((s, e) => s + e.weight, 0);
    if (totalWeight < MIN_EVIDENCE) continue; // not enough to compare against

    const weightedScore = evidence.reduce((s, e) => s + e.value * e.weight, 0) / totalWeight;
    const majorityDir = direction(weightedScore);
    if (majorityDir === dishDir) continue; // agrees — nothing to flag

    // Ingredients actually driving the disagreement: the ones pulling toward
    // the majority direction (i.e. away from the dish's own verdict),
    // strongest evidence first.
    const driving = evidence
      .filter(e => direction(e.value) === majorityDir)
      .sort((a, b) => b.weight - a.weight || Math.abs(b.value) - Math.abs(a.value));

    const rank = totalWeight * Math.abs(weightedScore) * (DISH_CONF_WEIGHT[dishT.confidence] ?? 0.5);
    flags.push({
      id: f.id, name: f.name, file: f.file, category: f.category, system: sys,
      dishVerdict: dishT.verdict, dishConfidence: dishT.confidence,
      majorityDirection: majorityDir, weightedScore: +weightedScore.toFixed(3),
      totalEvidenceWeight: +totalWeight.toFixed(2),
      drivingIngredients: driving.map(e => ({ id: e.id, verdict: e.verdict, confidence: e.confidence })),
      allEvidenceCount: evidence.length, ingredientCount: f.ingredients.length,
      rank: +rank.toFixed(3),
    });
  }
}
flags.sort((a, b) => b.rank - a.rank);

// ---- Part 2: incomplete ingredient lists (ewedu-class) --------------------
// Best-effort text check: <3 ingredients AND the description names a
// food-like noun that isn't in the ingredients array. No NLP — just a
// dictionary lookup of every OTHER food's name/aliases against the
// description text, filtered by a small stopword list to cut obvious noise.
// Candidate nouns are drawn from non-dish categories (a description is far
// more likely to name a raw ingredient than reference another whole dish).
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "with", "in", "on", "of", "for", "to", "its",
  "one", "line", "plain", "words", "dish", "soup", "stew", "curry", "salad",
  "bowl", "plate", "drink", "cousin", "style", "version", "further", "south",
  "north", "east", "west", "based", "topped", "served", "made", "eaten",
]);
function termsFor(food) {
  const raw = [food.name, ...(food.aliases ?? [])];
  return raw
    .map(t => t.toLowerCase().replace(/\([^)]*\)/g, "").trim())
    .filter(t => t.length >= 3 && !STOPWORDS.has(t));
}
const candidatePool = [...all.values()].filter(f => f.category !== "dish");
// term -> [{id, name}] — several foods can share a term ("chicken" appears in
// aliases of more than one entry); any match is reported, dedup'd by dish.
const termIndex = new Map();
for (const c of candidatePool) {
  for (const t of termsFor(c)) {
    if (!termIndex.has(t)) termIndex.set(t, []);
    termIndex.get(t).push({ id: c.id, name: c.name });
  }
}
// Longest terms first so "jute leaf" / "jute leaves" matches before a shorter
// substring of it would.
const terms = [...termIndex.keys()].sort((a, b) => b.length - a.length);

const incomplete = [];
for (const f of checkable) {
  if (f.ingredients.length >= 3) continue;
  const desc = (f.description ?? "").toLowerCase();
  if (!desc) continue;
  const known = new Set(f.ingredients);
  const seen = new Set();
  const hits = [];
  for (const term of terms) {
    // word-boundary match, plural-tolerant (trailing s optional)
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?\\b`, "i");
    if (!re.test(desc)) continue;
    for (const cand of termIndex.get(term)) {
      if (known.has(cand.id) || seen.has(cand.id)) continue;
      seen.add(cand.id);
      hits.push(cand);
    }
  }
  if (hits.length) {
    incomplete.push({ id: f.id, name: f.name, file: f.file, category: f.category, ingredientCount: f.ingredients.length, description: f.description, possibleMissing: hits });
  }
}

// ---- Cross-reference: incomplete lists vs. the consistency flags ----------
// A food with a missing ingredient can look falsely CONSISTENT above — the
// majority check only ever sees the ingredients that were recorded, so a
// short/incomplete list is missing evidence, not evidence that agrees. Flag
// which incomplete-list dishes also show up (or, notably, do NOT show up) in
// the Part 1 flag list on any system, since an absence there is the
// unreliable case worth calling out explicitly.
const flaggedIds = new Set(flags.map(f => f.id));
const incompleteAlsoFlagged = incomplete.filter(f => flaggedIds.has(f.id));
const incompleteNotFlagged = incomplete.filter(f => !flaggedIds.has(f.id));
for (const f of incomplete) f.alsoFlaggedInPart1 = flaggedIds.has(f.id);
// Also mark, on every Part 1 flag, whether its subject has a short ingredient
// list (<3) full stop — even if it wasn't picked up by the description-noun
// heuristic, thin ingredient lists are inherently thinner evidence.
for (const f of flags) f.thinIngredientList = (all.get(f.id)?.ingredients?.length ?? 0) < 3;

// ---- Report -----------------------------------------------------------
console.log(`Checked ${checkable.length} foods with an ingredients array (of ${all.size} total foods).`);
console.log(`\nPART 1 — thermal consistency: ${flags.length} dish/system disagreements flagged\n`);
for (const f of flags) {
  const drive = f.drivingIngredients.map(e => `${e.id} (${e.verdict}/${e.confidence})`).join(", ");
  const thin = f.thinIngredientList ? "  [THIN LIST <3 ingredients — treat with caution]" : "";
  console.log(`${f.rank.toFixed(2).padStart(6)}  ${f.id} [${f.system}]  own=${f.dishVerdict}/${f.dishConfidence}  ingredients→${f.majorityDirection} (score ${f.weightedScore}, evidence ${f.totalEvidenceWeight})  driven by: ${drive}${thin}`);
}

console.log(`\nPART 2 — incomplete ingredient lists (<3 ingredients + unlisted food-noun in description): ${incomplete.length} flagged\n`);
for (const f of incomplete) {
  const also = f.alsoFlaggedInPart1 ? "  [also in Part 1]" : "";
  console.log(`${f.id} (${f.ingredientCount} ingredients): "${f.description}" → possibly missing: ${f.possibleMissing.map(h => h.id).join(", ")}${also}`);
}

console.log(`\nCross-reference: ${incompleteAlsoFlagged.length}/${incomplete.length} incomplete-list dishes are ALSO flagged in Part 1.`);
console.log(`${incompleteNotFlagged.length}/${incomplete.length} incomplete-list dishes look thermally "consistent" in Part 1 SOLELY because their short ingredient list gives the check nothing to disagree with — that consistency is not trustworthy.`);

// ---- Save full machine-readable output for review ---------------------
const outPath = process.argv[2] ?? null;
if (outPath) {
  writeFileSync(outPath, JSON.stringify({ flags, incomplete, incompleteAlsoFlagged: incompleteAlsoFlagged.map(f => f.id), incompleteNotFlagged: incompleteNotFlagged.map(f => f.id) }, null, 2));
  console.error(`\n(full JSON written to ${outPath})`);
}
