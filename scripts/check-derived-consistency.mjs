// Derived-consistency check: for every food that is itself made FROM a single,
// identifiable raw source (a flour, juice, paste, oil, powder, milk, etc.; a
// dish whose own `ingredients` array names exactly one substantive item; or a
// description that says "made from X"/"made with X"), does its own
// confidence/verdict track that source's own actual, current thermal reading?
//
// Background: this is the pattern behind the amala/boiled-yam/pounded-yam/
// fried-yam/polenta-dish bugs found and fixed on this branch (commit 19d95c8)
// — a derived food's note asserted a reading for its source ("Yam is shita",
// "following corn") that flatly contradicted what that source's OWN entry
// actually says. It's also the shape of the mango-juice/mango-lassi
// confidence regression fixed earlier on this branch (commit 2f89215): a
// derived product silently drifting out of step with its raw ingredient after
// an edit to one side and not the other. Both are easy to introduce by hand
// and easy to miss by eye, and neither is caught by check-dish-consistency.mjs
// (which votes across a whole ingredient list, not a single named source) or
// by validate-data.mjs (which checks schema, not cross-food agreement).
//
// This is a CANDIDATE QUEUE for human/worker review, not an auto-fixer. Many
// matches are false positives by construction — a shared name suffix doesn't
// always mean a real derivation (sambar-powder is not "made from sambar"),
// and even a real derivation can legitimately diverge (a ferment, a roast, an
// added souring agent can shift a product's own reading away from its raw
// source's, e.g. tamarind-paste, smoked-salmon, dried-figs already do this on
// purpose). A flag here means "look at this", never "this is wrong".
//
// Run: node scripts/check-derived-consistency.mjs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "foods");
const SYSTEMS = ["tcm", "ayurveda", "unani"];

// Same per-verdict heat magnitudes check-dish-consistency.mjs uses (which
// itself duplicates validate-data.mjs's compositeHeat/heatClass mapping) —
// duplicated again here for the same reason: this script reads
// data/foods/*.json directly and must not depend on anything generated.
const HEAT = {
  tcm: { cold: -1, cool: -0.5, neutral: 0, warm: 0.5, hot: 1 },
  ayurveda: { cooling: -0.7, heating: 0.7 },
  unani: { cold: -1, "cold-dry": -1, "cold-moist": -1, neutral: 0, hot: 1, "hot-dry": 1, "hot-moist": 1 },
};
const DIR_THRESHOLD = 0.15; // matches check-dish-consistency.mjs's neutral band
function direction(score) {
  if (score > DIR_THRESHOLD) return "heating";
  if (score < -DIR_THRESHOLD) return "cooling";
  return "neutral";
}
const CONF_RANK = { contested: 1, moderate: 2, high: 3 };

// ---- Load everything --------------------------------------------------
const all = new Map();
for (const file of readdirSync(dir).filter(f => f.endsWith(".json"))) {
  const foods = JSON.parse(readFileSync(join(dir, file), "utf8"));
  for (const f of foods) all.set(f.id, { ...f, file });
}
const list = [...all.values()];

// ---- A name/alias/id index for resolving a stripped-suffix root or a
// "made from X" phrase back to an actual food. Best-effort text matching,
// same spirit as check-dish-consistency.mjs's Part 2 description-noun index
// — not NLP, just a dictionary lookup with light singular/plural tolerance.
function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function singularize(s) {
  return s.length > 3 && s.endsWith("s") && !s.endsWith("ss") ? s.slice(0, -1) : s;
}
const termIndex = new Map(); // normalized term -> food (first writer wins)
for (const f of list) {
  const keys = [f.id.replace(/-/g, " "), f.name, ...(f.aliases ?? [])];
  for (const key of keys) {
    const n = normalize(key);
    if (!n) continue;
    for (const form of [n, singularize(n)]) {
      if (!termIndex.has(form)) termIndex.set(form, f);
    }
  }
}
function lookupTerm(phrase) {
  const n = normalize(phrase);
  if (!n) return null;
  return termIndex.get(n) ?? termIndex.get(singularize(n)) ?? null;
}

// ---- Method A: single-token name suffix/prefix -------------------------
// e.g. mango-juice -> mango, rice-flour -> rice, tamarind-paste -> tamarind,
// dried-figs -> figs, smoked-salmon -> salmon.
const SUFFIXES = ["flour", "juice", "paste", "oil", "powder", "milk", "butter", "vinegar", "sauce", "syrup", "extract"];
const PREFIXES = ["dried", "smoked"];
function sourceByNamePattern(f) {
  const tokens = f.id.split("-");
  if (tokens.length < 2) return null;
  const last = tokens[tokens.length - 1];
  if (SUFFIXES.includes(last)) {
    const root = tokens.slice(0, -1).join(" ");
    const hit = lookupTerm(root);
    if (hit && hit.id !== f.id) return { source: hit, how: `name suffix "-${last}"` };
  }
  const first = tokens[0];
  if (PREFIXES.includes(first)) {
    const root = tokens.slice(1).join(" ");
    const hit = lookupTerm(root);
    if (hit && hit.id !== f.id) return { source: hit, how: `name prefix "${first}-"` };
  }
  return null;
}

// ---- Method B: exactly one substantive ingredient -----------------------
function sourceByIngredients(f) {
  if (!Array.isArray(f.ingredients) || f.ingredients.length !== 1) return null;
  const hit = all.get(f.ingredients[0]);
  if (hit && hit.id !== f.id) return { source: hit, how: "sole listed ingredient" };
  return null;
}

// ---- Method C: "made from X" / "made with X" in the description ---------
function sourceByDescription(f) {
  const m = (f.description ?? "").match(/\bmade (?:from|with)\s+([a-z][a-z '-]{2,40})/i);
  if (!m) return null;
  // Try progressively shorter word windows (4, 3, 2, 1) so "fermented palm
  // toddy" can still resolve via "palm toddy" or "toddy" even though the
  // full captured phrase won't be any single food's name.
  const words = m[1].replace(/[.,;].*$/, "").trim().split(/\s+/);
  for (let n = Math.min(4, words.length); n >= 1; n--) {
    for (let start = 0; start + n <= words.length; start++) {
      const phrase = words.slice(start, start + n).join(" ");
      const hit = lookupTerm(phrase);
      if (hit && hit.id !== f.id) return { source: hit, how: `description "made from/with ${phrase}"` };
    }
  }
  return null;
}

// ---- Resolve one source per food, first method that hits wins -----------
const pairs = [];
for (const f of list) {
  const found = sourceByIngredients(f) ?? sourceByNamePattern(f) ?? sourceByDescription(f);
  if (found) pairs.push({ derived: f, source: found.source, how: found.how });
}

// ---- Compare confidence/verdict per system -------------------------------
const flags = [];
for (const { derived, source, how } of pairs) {
  for (const sys of SYSTEMS) {
    const dT = derived.thermal?.[sys];
    const sT = source.thermal?.[sys];
    if (!dT || !sT) continue; // schema gaps are validate-data.mjs's job

    const dDir = direction(HEAT[sys][dT.verdict] ?? 0);
    const sDir = direction(HEAT[sys][sT.verdict] ?? 0);
    const dConf = CONF_RANK[dT.confidence] ?? 0;
    const sConf = CONF_RANK[sT.confidence] ?? 0;

    if (dDir !== sDir && dDir !== "neutral" && sDir !== "neutral") {
      flags.push({
        kind: "direction-mismatch", severity: 2,
        derivedId: derived.id, derivedFile: derived.file, how, system: sys,
        derivedVerdict: dT.verdict, derivedConfidence: dT.confidence,
        sourceId: source.id, sourceVerdict: sT.verdict, sourceConfidence: sT.confidence,
      });
    } else if (dConf > sConf) {
      // Same direction (or one side neutral), but the derived product claims
      // MORE certainty than its own raw source ever claims for itself — the
      // shape of the mango-juice/mango-lassi regression: nothing here is
      // necessarily wrong, but a derived reading outrunning its source's own
      // confidence deserves a second look.
      flags.push({
        kind: "confidence-escalation", severity: 1,
        derivedId: derived.id, derivedFile: derived.file, how, system: sys,
        derivedVerdict: dT.verdict, derivedConfidence: dT.confidence,
        sourceId: source.id, sourceVerdict: sT.verdict, sourceConfidence: sT.confidence,
      });
    }
  }
}
flags.sort((a, b) => b.severity - a.severity || a.derivedId.localeCompare(b.derivedId) || a.system.localeCompare(b.system));

// ---- Report ---------------------------------------------------------------
console.log(`Matched ${pairs.length} derived/source pairs (of ${list.length} foods) via name pattern, sole ingredient, or "made from/with" description.`);
const mismatches = flags.filter(f => f.kind === "direction-mismatch");
const escalations = flags.filter(f => f.kind === "confidence-escalation");
console.log(`\n${mismatches.length} direction mismatches (derived verdict disagrees with its own source's current verdict) — look at these first:\n`);
for (const f of mismatches) {
  console.log(`  ${f.derivedId} [${f.system}] own=${f.derivedVerdict}/${f.derivedConfidence}  vs.  source ${f.sourceId}=${f.sourceVerdict}/${f.sourceConfidence}  (matched via ${f.how})`);
}
console.log(`\n${escalations.length} confidence escalations (same direction, but derived claims MORE certainty than its raw source does):\n`);
for (const f of escalations) {
  console.log(`  ${f.derivedId} [${f.system}] own=${f.derivedVerdict}/${f.derivedConfidence}  vs.  source ${f.sourceId}=${f.sourceVerdict}/${f.sourceConfidence}  (matched via ${f.how})`);
}
console.log(`\n${flags.length} total flags across ${new Set(flags.map(f => f.derivedId)).size} foods. Not every match above is a bug — a real preparation step (souring, fermenting, roasting) can legitimately move a derived product's own reading away from its raw source's; read each note before touching data.`);

const outPath = process.argv[2] ?? null;
if (outPath) {
  writeFileSync(outPath, JSON.stringify({ pairs: pairs.map(p => ({ derived: p.derived.id, source: p.source.id, how: p.how })), flags }, null, 2));
  console.error(`\n(full JSON written to ${outPath})`);
}
