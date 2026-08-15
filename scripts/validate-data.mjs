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
const TAGS = ["liberator", "high-histamine", "dao-blocker"];
const REMEDY_STATES = ["too-hot", "too-cold"];

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
  if (!REMEDY_STATES.includes(p.state) && p.state !== "reactive") errors.push(`${where}: bad state ${p.state}`);
  if (!Array.isArray(p.steps) || p.steps.length < 2) errors.push(`${where}: needs at least 2 steps`);
  for (const ing of p.ingredients ?? []) {
    if (!all.has(ing)) errors.push(`${where}: unknown ingredient "${ing}"`);
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

if (errors.length) { console.error(`\n${errors.length} ERRORS:`); errors.forEach(e => console.error(" -", e)); process.exit(1); }
console.log("\nAll checks passed ✅");
