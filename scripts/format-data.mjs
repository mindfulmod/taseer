// Canonical formatter for data/foods/*.json.
//
// These files are hand-maintained — the data spec makes a point of it — and the
// authored layout is deliberately compact: identity on the first line, then one
// top-level key per line. A naive JSON.stringify(arr, null, 2) blows a 709-line
// file out to 5,240 and makes every future diff unreadable. That happened on
// 2026-08-19; this script exists so it cannot happen quietly again.
//
//   node scripts/format-data.mjs         # rewrite in canonical form
//   node scripts/format-data.mjs --check # exit 1 if anything is off-format
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "foods");
const HEAD = ["id", "name", "aliases", "emoji", "category", "cuisines", "commonness"];

export function formatFoods(arr) {
  const blocks = arr.map(food => {
    const head = HEAD.filter(k => k in food).map(k => `${JSON.stringify(k)}:${JSON.stringify(food[k])}`);
    const rest = Object.keys(food).filter(k => !HEAD.includes(k))
      .map(k => `   ${JSON.stringify(k)}:${JSON.stringify(food[k])}`);
    return `  {${head.join(",")}${rest.length ? ",\n" + rest.join(",\n") : ""}}`;
  });
  return `[\n${blocks.join(",\n\n")}\n]\n`;
}

const check = process.argv.includes("--check");
let bad = 0;
for (const file of readdirSync(dir).filter(f => f.endsWith(".json")).sort()) {
  const path = join(dir, file);
  const raw = readFileSync(path, "utf8");
  const out = formatFoods(JSON.parse(raw));
  if (out === raw) continue;
  if (check) { console.error(`off-format: data/foods/${file}`); bad++; }
  else { writeFileSync(path, out); console.log(`formatted data/foods/${file}`); }
}
if (check) {
  if (bad) { console.error(`\n${bad} file(s) need \`node scripts/format-data.mjs\``); process.exit(1); }
  console.log("data/foods/*.json all canonically formatted ✅");
}
