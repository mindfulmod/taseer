// Stamps sw.js's VERSION with a hash of the actual shell files.
//   node scripts/stamp-sw.mjs
//
// Relying on a human to remember to bump the version ships a permanently stale
// app to everyone who already installed it — the cache is served first, so a
// forgotten bump is invisible in testing and fatal in production.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const swPath = join(root, "sw.js");
const sw = readFileSync(swPath, "utf8");

// The hashed set is exactly what the worker precaches, read out of the worker
// itself so the two can never drift apart.
const listMatch = sw.match(/const SHELL_FILES = \[([\s\S]*?)\];/);
if (!listMatch) {
  console.error("FATAL: could not find SHELL_FILES in sw.js");
  process.exit(1);
}
const files = [...listMatch[1].matchAll(/"([^"]+)"/g)]
  .map(m => m[1])
  .filter(f => f !== "./") // the directory alias resolves to index.html
  .sort();

const hash = createHash("sha256");
for (const file of files) {
  hash.update(file);
  hash.update(readFileSync(join(root, file)));
}
const version = `taseer-${hash.digest("hex").slice(0, 10)}`;

const next = sw.replace(/const VERSION = "[^"]*";/, `const VERSION = "${version}";`);
if (next === sw) {
  console.log(`sw.js already stamped ${version}`);
} else {
  writeFileSync(swPath, next);
  console.log(`sw.js stamped ${version} (${files.length} shell files hashed)`);
}
