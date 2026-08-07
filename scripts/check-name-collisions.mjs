// Pre-write collision check. Feed it candidate "id|Display Name" pairs and it
// reports which would clash with an existing id, name, or BARE alias — before
// any entry gets written. Batch 3 learned this the hard way.
import { readFileSync } from "node:fs";

const FILES = ["fruits", "vegetables", "grains", "spices", "proteins", "dairy", "drinks", "dishes"];
const all = [];
for (const f of FILES) all.push(...JSON.parse(readFileSync(`data/foods/${f}.json`, "utf8")));

const ids = new Set(all.map(f => f.id));
const names = new Map();
const bareAlias = new Map();
for (const f of all) {
  names.set(f.name.toLowerCase(), f.id);
  for (const a of f.aliases) {
    if (/\(/.test(a)) continue; // qualified aliases are deliberate cross-refs
    const k = a.toLowerCase().trim();
    if (!bareAlias.has(k)) bareAlias.set(k, []);
    bareAlias.get(k).push(f.id);
  }
}

const candidates = process.argv.slice(2).join(" ").split(",").map(s => s.trim()).filter(Boolean);
let clashes = 0;
const clean = [];

// Batch 4 got past an earlier version of this check twice, both ways:
//   1. It checked the name declared here ("Bamia stew") while the entry was
//      written with a shorter one ("Bamia") that WAS a bare alias. So the
//      declared name must be the exact string that goes in the file.
//   2. chakli and murukku were both batch-4 candidates and collided with each
//      other — neither existed yet, so neither could be caught against the
//      shipped data. Candidates are now checked against each other too.
const seenName = new Map();
const seenId = new Set();

for (const c of candidates) {
  const [id, name = id.replace(/-/g, " ")] = c.split("|").map(s => s.trim());
  const lower = name.toLowerCase();
  const why = [];
  if (ids.has(id)) why.push("id exists");
  if (names.has(lower)) why.push(`name = ${names.get(lower)}`);
  const ba = bareAlias.get(lower);
  if (ba) why.push(`bare alias of ${ba.join("/")}`);
  const baId = bareAlias.get(id.replace(/-/g, " "));
  if (baId && !ba) why.push(`id-as-words is a bare alias of ${baId.join("/")}`);
  if (seenId.has(id)) why.push("duplicate id WITHIN this batch");
  if (seenName.has(lower)) why.push(`name clashes with ${seenName.get(lower)} IN THIS BATCH`);
  seenId.add(id);
  seenName.set(lower, id);
  if (why.length) { console.log(`CLASH  ${id.padEnd(26)} ${why.join("; ")}`); clashes++; }
  else clean.push(id);
}
console.log(`\n${clean.length} clean, ${clashes} clashing, of ${candidates.length} candidates`);
if (clashes) console.log("Drop or rename the clashing ones before writing entries.");
console.log("NOTE: the name given here must be the EXACT display name written to the file.");
console.log("Aliases you intend to add are not checked — run the post-write audit as well.");
