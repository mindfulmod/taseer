// Checks assets/food-images/ against the dataset: every filename must match a real
// food id, and reports coverage + any file over the ART.md §8 size budget.
//   node scripts/check-images.mjs
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const imgDir = join(root, "assets", "food-images");
const MAX_KB = 45;

const foods = readdirSync(join(root, "data", "foods"))
  .filter(f => f.endsWith(".json"))
  .flatMap(f => JSON.parse(readFileSync(join(root, "data", "foods", f), "utf8")));
const ids = new Set(foods.map(f => f.id));

if (!existsSync(imgDir)) {
  console.log(`No ${"assets/food-images"} yet — the app falls back to emoji glyphs. Nothing to check.`);
  process.exit(0);
}

const files = readdirSync(imgDir).filter(f => f.endsWith(".webp"));
const errors = [];
const oversized = [];
const present = new Set();

for (const file of files) {
  const id = file.replace(/\.webp$/, "");
  if (!ids.has(id)) errors.push(`${file} — no food has id "${id}"`);
  else present.add(id);
  const kb = statSync(join(imgDir, file)).size / 1024;
  if (kb > MAX_KB) oversized.push(`${file} — ${kb.toFixed(0)} KB (budget ${MAX_KB})`);
}

const missing = [...ids].filter(id => !present.has(id));
const totalMb = files.reduce((n, f) => n + statSync(join(imgDir, f)).size, 0) / 1024 / 1024;

console.log(`Images: ${present.size}/${ids.size} foods illustrated (${totalMb.toFixed(1)} MB total)`);
if (missing.length) {
  console.log(`Still to generate (${missing.length}): ${missing.slice(0, 12).join(", ")}${missing.length > 12 ? " …" : ""}`);
}
if (oversized.length) {
  console.warn(`\n${oversized.length} over budget:`);
  oversized.forEach(o => console.warn(" -", o));
}
if (errors.length) {
  console.error(`\n${errors.length} bad filename(s) — these will never be shown:`);
  errors.forEach(e => console.error(" -", e));
  process.exit(1);
}
console.log("\nAll filenames match real food ids ✅");
