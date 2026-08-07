// Derives square thumbnails from the painted 3:2 set.
//   node scripts/build-thumbs.mjs
// Uses macOS `sips` so there is no install step — the repo already assumes a Mac
// for icon generation. Heroes stay 3:2; these feed rows, rails, fanned feel-card
// stacks and category cards, where a 174 KB hero twenty times over is not viable.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "assets", "food-images");
const outDir = join(root, "assets", "food-thumbs");

/** sips reports one property per line as "  pixelWidth: 1280". */
function dimensions(file) {
  const out = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", file], { encoding: "utf8" });
  const w = Number(out.match(/pixelWidth:\s*(\d+)/)?.[1]);
  const h = Number(out.match(/pixelHeight:\s*(\d+)/)?.[1]);
  return { w, h };
}

const SIZE = 320; // 2x a 160px card face
const QUALITY = 55;

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const sources = readdirSync(srcDir).filter(f => /\.jpe?g$/i.test(f));
if (!sources.length) {
  console.error(`No paintings in ${srcDir}.`);
  process.exit(1);
}

const force = process.argv.includes("--force");
let built = 0;
let skipped = 0;
let bytes = 0;

for (const file of sources) {
  const id = basename(file).replace(/\.jpe?g$/i, "");
  const out = join(outDir, `${id}.jpg`);
  if (!force && existsSync(out)) {
    skipped++;
    bytes += statSync(out).size;
    continue;
  }
  // Two passes, deliberately. `-c` and `-Z` in one sips call compute the resize
  // ratio from the PRE-crop dimensions, so a chained call silently produces
  // 213x213 instead of 320x320. And the square must come from this image's own
  // shorter side — the set is mostly 1280x854 but 8 files are 1000x666, and a
  // fixed 854 crop pads those with black instead of cropping them.
  const { w, h } = dimensions(join(srcDir, file));
  const side = Math.min(w, h);
  const tmp = join(tmpdir(), `taseer-thumb-${id}.jpg`);

  // The §8 recipe centres every subject in a 3:2 frame, so a centred square
  // crop is safe across the whole set — no per-food art direction needed.
  execFileSync("sips", ["-c", String(side), String(side), join(srcDir, file), "--out", tmp], { stdio: "ignore" });
  execFileSync("sips", [
    "-Z", String(SIZE),
    "-s", "format", "jpeg",
    "-s", "formatOptions", String(QUALITY),
    tmp, "--out", out,
  ], { stdio: "ignore" });
  rmSync(tmp, { force: true });
  bytes += statSync(out).size;
  built++;
}

const mb = (bytes / 1024 / 1024).toFixed(1);
const avg = Math.round(bytes / (built + skipped) / 1024);
console.log(`Thumbs: ${built} built, ${skipped} already present → ${mb} MB total, ~${avg} KB each`);
