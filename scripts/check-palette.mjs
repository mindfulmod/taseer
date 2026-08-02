// Enforces ART.md §2: no hex literal may appear in source unless the bible declares it.
//   node scripts/check-palette.mjs
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const HEX = /#[0-9a-fA-F]{3,8}\b/g;

const bible = readFileSync(join(root, "ART.md"), "utf8");
const allowed = new Set((bible.match(HEX) ?? []).map(h => h.toLowerCase()));
if (!allowed.size) {
  console.error("FATAL: no hexes found in ART.md — is the palette table intact?");
  process.exit(1);
}

const files = [];
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (entry === "data" || entry === "food-images") continue;
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(css|js|html|webmanifest)$/.test(entry)) files.push(path);
  }
})(join(root, "assets"));
files.push(join(root, "index.html"));

const problems = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  text.split("\n").forEach((line, i) => {
    for (const hex of line.match(HEX) ?? []) {
      const h = hex.toLowerCase();
      if (["#fff", "#ffffff", "#000", "#000000"].includes(h)) {
        problems.push(`${relative(root, file)}:${i + 1}  ${hex} — pure white/black is banned (ART.md §6.2)`);
      } else if (!allowed.has(h)) {
        problems.push(`${relative(root, file)}:${i + 1}  ${hex} — not in the ART.md §2 palette`);
      }
    }
  });
}

if (problems.length) {
  console.error(`${problems.length} palette violation(s):`);
  problems.forEach(p => console.error(" -", p));
  console.error("\nAmend ART.md §2 first if the colour is genuinely needed.");
  process.exit(1);
}
console.log(`Palette clean — ${files.length} files checked against ${allowed.size} declared colours ✅`);
