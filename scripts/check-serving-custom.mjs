// Serving-custom check: does a "cooling" verdict's own note lean on
// serving-temperature or eating-custom language ("served cold", "eaten
// chilled", "in summer", "iced", ...) rather than, or in addition to,
// ingredient-level reasoning?
//
// Background: on this branch's accuracy pass, several genuine bugs (fixed in
// commit 19d95c8: smashed-cucumber, cold-noodles-chinese, sashimi) turned out
// to be a dish whose note said only "raw X, served cold" and never checked
// its own ingredients — smashed-cucumber's dressing (garlic, chili-oil,
// sesame-oil, black-vinegar) is confidently HOT, sashimi's salmon is warm not
// cold, but the note took the eating experience (cold food on a plate) for
// the thermal doctrine (cooling in the body), which are not the same claim.
//
// This is a CANDIDATE QUEUE for human/worker review, not an auto-fixer — a
// serving-temperature mention is often just corroborating color alongside
// real ingredient grounding (most hits below are exactly that: legitimate),
// and TCM in particular has its own doctrinal "heat-clearing" property
// language that legitimately co-occurs with "eaten in summer" without being
// the SOLE basis for the verdict (grass-jelly, green-tea, sugarcane-juice,
// white-tea) — that TCM-specific phrasing is deliberately excluded below so
// it doesn't drown out the cases worth a human's time. A flag here means
// "read this note and check the ingredients yourself", never "this is wrong".
//
// Run: node scripts/check-serving-custom.mjs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "foods");
const SYSTEMS = ["tcm", "ayurveda", "unani"];

// Which verdicts count as "cooling" per system — same three thermal systems
// check-dish-consistency.mjs and check-derived-consistency.mjs both use.
const COOLING_VERDICTS = {
  tcm: new Set(["cold", "cool"]),
  ayurveda: new Set(["cooling"]),
  unani: new Set(["cold", "cold-dry", "cold-moist"]),
};

// Serving-temperature / eating-custom language: how the food is EATEN, not
// what it's made of. Word-boundary guarded throughout so e.g. "iced" doesn't
// match inside "spiced".
const CUSTOM_RE = new RegExp(
  [
    "served (?:ice[- ]?)?(?:cold|cool|chilled)",
    "eaten (?:ice[- ]?)?(?:cold|cool|chilled)",
    "\\bchilled\\b",
    "\\biced\\b",
    "ice-cold",
    "\\bicy\\b",
    "\\bfrozen\\b",
    "shaved ice",
    "\\bsummer\\b",
    "hot day",
    "hot weather",
    "\\bon ice\\b",
    "over ice",
  ].join("|"),
  "i",
);

// TCM's own legitimate doctrine: "heat-clearing" / "clears heat" is a
// property claim about the food itself (a recognized functional class,
// alongside foods like mucilaginous greens or bitter melon), not a
// description of how or when it's served — even though it very often
// co-occurs with "eaten in summer" in the same note. Worked out by hand
// during the prior scoping pass; reused as-is here.
const TCM_DOCTRINE_RE = /heat-clearing|clears? heat/i;

// ---- Load everything --------------------------------------------------
const all = [];
for (const file of readdirSync(dir).filter(f => f.endsWith(".json"))) {
  const foods = JSON.parse(readFileSync(join(dir, file), "utf8"));
  for (const f of foods) all.push({ ...f, file });
}

// ---- Scan ---------------------------------------------------------------
const flags = [];
for (const f of all) {
  for (const sys of SYSTEMS) {
    const t = f.thermal?.[sys];
    if (!t || !t.note) continue;
    if (!COOLING_VERDICTS[sys].has(t.verdict)) continue;
    if (sys === "tcm" && TCM_DOCTRINE_RE.test(t.note)) continue;
    const m = t.note.match(CUSTOM_RE);
    if (!m) continue;
    flags.push({
      id: f.id, name: f.name, file: f.file, category: f.category, system: sys,
      verdict: t.verdict, confidence: t.confidence, matchedPhrase: m[0], note: t.note,
      hasIngredients: Array.isArray(f.ingredients) && f.ingredients.length > 0,
    });
  }
}
// Highest-confidence verdicts first — a confident cooling read that turns out
// to rest only on serving custom is more surprising, and more worth a
// human's time, than a contested one that already admits uncertainty.
const CONF_RANK = { high: 3, moderate: 2, contested: 1 };
flags.sort((a, b) => (CONF_RANK[b.confidence] ?? 0) - (CONF_RANK[a.confidence] ?? 0) || a.id.localeCompare(b.id));

// ---- Report ---------------------------------------------------------------
const foodIds = new Set(flags.map(f => f.id));
console.log(`Scanned ${all.length} foods across ${SYSTEMS.length} systems.`);
console.log(`${flags.length} cooling-verdict notes (${foodIds.size} foods) mention serving-temperature/eating-custom language, excluding TCM's doctrinal heat-clearing language:\n`);
for (const f of flags) {
  const thin = f.hasIngredients ? "" : "  [no ingredients array to cross-check against]";
  console.log(`  [${f.confidence.padEnd(9)}] ${f.id} [${f.system}] ${f.verdict} — "${f.matchedPhrase}" in: ${f.note}${thin}`);
}
console.log(`\nNot every hit above is a bug — serving-cold/summer language is often corroborating color alongside real ingredient grounding. Cross-reference against scripts/check-dish-consistency.mjs's ingredient tally (for foods with an \`ingredients\` array) before touching data; the ones marked "no ingredients array" have nothing else to check the verdict against and deserve the closest look.`);

const outPath = process.argv[2] ?? null;
if (outPath) {
  writeFileSync(outPath, JSON.stringify({ flags }, null, 2));
  console.error(`\n(full JSON written to ${outPath})`);
}
