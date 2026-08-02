// Validates the Taseer food dataset: schema, enums, unique ids, dish ingredient refs.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "foods");
const CATEGORIES = ["fruit", "vegetable", "grain", "spice", "protein", "dairy", "drink", "dish"];
const CUISINES = ["south-asian", "arabic", "chinese", "western"];
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

// Stats
const total = all.size;
const contested = [...all.values()].filter(f => Object.values(f.thermal ?? {}).some(t => t?.confidence === "contested"));
const conflicts = [...all.values()].filter(f => {
  const t = f.thermal; if (!t?.tcm || !t?.ayurveda || !t?.unani) return false;
  const heat = v => /hot|warm|heating/.test(v) ? 1 : /cold|cool/.test(v) ? -1 : 0;
  const dirs = [heat(t.tcm.verdict), heat(t.ayurveda.verdict), heat(t.unani.verdict)].filter(d => d !== 0);
  return new Set(dirs).size > 1;
});
const sighiDist = [0, 1, 2, 3].map(s => [...all.values()].filter(f => f.histamine.sighi === s).length);
const remedyEat = state => [...all.values()].filter(f => f.remedy?.[state] === "eat").length;

console.log(`TOTAL FOODS: ${total}`);
console.log("By category:", byCategory);
console.log(`SIGHI distribution 0/1/2/3: ${sighiDist.join(" / ")}`);
console.log(`Cross-tradition conflicts (hot vs cold disagreement): ${conflicts.length}`);
console.log(`  e.g. ${conflicts.slice(0, 12).map(f => f.id).join(", ")}`);
console.log(`Entries with ≥1 contested confidence: ${contested.length}`);
console.log(`Remedy coverage — too-hot eat: ${remedyEat("too-hot")}, too-cold eat: ${remedyEat("too-cold")}`);
console.log(`Aliases total: ${[...all.values()].reduce((a, f) => a + f.aliases.length, 0)}`);

if (errors.length) { console.error(`\n${errors.length} ERRORS:`); errors.forEach(e => console.error(" -", e)); process.exit(1); }
console.log("\nAll checks passed ✅");
