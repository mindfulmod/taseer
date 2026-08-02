// Converts generated PNGs in assets/food-images/_raw/ into shipped WebP.
//   node scripts/optimise-images.mjs
// Needs cwebp (dev-time only, never a runtime dependency):  brew install webp
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "assets", "food-images");
const rawDir = join(outDir, "_raw");

const WIDTH = 640;
const QUALITY = 72;
const MAX_KB = 45;

try {
  execFileSync("cwebp", ["-version"], { stdio: "ignore" });
} catch {
  console.error("cwebp not found. Install it with:\n\n  brew install webp\n");
  process.exit(1);
}

if (!existsSync(rawDir)) {
  mkdirSync(rawDir, { recursive: true });
  console.log(`Created ${rawDir}. Drop generated PNGs there (named <food-id>.png) and rerun.`);
  process.exit(0);
}

const sources = readdirSync(rawDir).filter(f => /\.(png|jpe?g)$/i.test(f));
if (!sources.length) {
  console.log(`No PNGs in ${rawDir} — nothing to do.`);
  process.exit(0);
}

let converted = 0;
const oversized = [];

for (const file of sources) {
  const id = basename(file).replace(/\.(png|jpe?g)$/i, "");
  const out = join(outDir, `${id}.webp`);
  execFileSync("cwebp", ["-q", String(QUALITY), "-resize", String(WIDTH), "0", "-quiet", join(rawDir, file), "-o", out]);
  const kb = statSync(out).size / 1024;
  if (kb > MAX_KB) oversized.push(`${id}.webp — ${kb.toFixed(0)} KB`);
  converted++;
}

console.log(`Converted ${converted} image(s) → ${WIDTH}px WebP q${QUALITY}`);
if (oversized.length) {
  console.warn(`\n${oversized.length} over the ${MAX_KB} KB budget (ART.md §8):`);
  oversized.forEach(o => console.warn(" -", o));
  console.warn("Rerun with a lower quality, or simplify those illustrations.");
}
console.log("\nNext: node scripts/check-images.mjs");
