// Histamine-consistency check: when several dishes share the same
// high-histamine ingredient, do they actually score that ingredient's
// contribution consistently?
//
// Background: this accuracy pass found dishes sharing an identical "this
// ingredient carries the histamine score" reasoning that were nonetheless
// scored inconsistently — many soy-sauce-based dishes correctly matched soy
// sauce's own histamine.sighi score, but a handful didn't, and the same
// shape recurred for bone-broth-based dishes (fixed in commit 74efa52). That
// was found and fixed by hand; this makes it mechanically checkable so it
// can't silently drift again — the same motivation as
// check-derived-consistency.mjs (a real regression, mango-juice/mango-lassi's
// thermal confidence, already happened once on this branch after a one-sided
// edit).
//
// Scope: unlike check-derived-consistency.mjs (one derived food vs. its one
// raw source) this is a many-dishes-share-one-ingredient shape — group every
// dish that lists a given SIGHI>=2 ingredient, and check each dish's own
// histamine.sighi against that ingredient's. validate-data.mjs already HARD
// gates the worst case (a dish more than one level below its worst
// ingredient is a build error) — this script is deliberately softer and
// wider: it also flags a dish sitting exactly one level below an ingredient
// it shares with siblings that sit AT that ingredient's level, when nothing
// in the dish's own note documents why (a trace amount, dilution, a cooking
// step that reduces histamine, fresh-vs-aged, etc.) — the "legal but
// undocumented, and inconsistent with its own siblings" case validate-data.mjs
// doesn't see because it checks each dish only against itself, never against
// the group.
//
// This is a CANDIDATE QUEUE for human/worker review, not an auto-fixer — a
// real difference in quantity, freshness or cooking method can legitimately
// put one dish below another that shares the same ingredient. A flag here
// means "read this note and compare it with its siblings", never "this is
// wrong".
//
// Run: node scripts/check-histamine-consistency.mjs
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "foods");

// A "meaningful" difference: the dish sits at least one full SIGHI level
// below the shared ingredient. (Two or more levels below is already a hard
// validate-data.mjs error — see the `worst - 1` check there — so this script
// mostly surfaces the one-level, currently-legal-but-undocumented gap.)
const MIN_GAP = 1;

// Best-effort language that documents WHY a dish sits below its ingredient's
// own score: trace quantity, dilution, a cooking/prep step known to cut
// histamine, or fresh-vs-aged framing. Word-boundary guarded throughout, same
// spirit as check-serving-custom.mjs's CUSTOM_RE — this is a dictionary
// lookup, not NLP, and it is deliberately generous (a false "documented" is
// cheap: the dish just doesn't get flagged; a false "undocumented" costs a
// human two minutes reading a note that already explained itself).
const REASON_RE = new RegExp(
  [
    "\\btrace(?:s|d)?\\b",
    "dilut\\w*",
    "small amount",
    "\\bminimal\\b",
    "\\blittle\\b",
    "hint of",
    "\\bbarely\\b",
    "\\bbrief(?:ly)?\\b",
    "quick(?:ly)?[- ]?cook\\w*",
    "quick[- ]seared",
    "seared quickly",
    "same[- ]day",
    "\\bfresh\\w*", // fresh, freshly, fresh-cooked, fresh-made
    "doesn'?t (?:carry|reach|drag|add much)",
    "not (?:much|really|significant)",
    "lower than",
    "less than",
    "much lower",
    "keeps it (?:down|low|moderate|out of)",
    "\\bunfermented\\b",
    "no ferment",
    "\\boffsets?\\b",
    "\\btempers?\\b",
    "\\bunmarinated\\b",
    "cooked (?:same day|straight away)",
  ].join("|"),
  "i",
);

// ---- Load everything --------------------------------------------------
const all = new Map();
for (const file of readdirSync(dir).filter(f => f.endsWith(".json"))) {
  const foods = JSON.parse(readFileSync(join(dir, file), "utf8"));
  for (const f of foods) all.set(f.id, { ...f, file });
}
const dishes = (JSON.parse(readFileSync(join(dir, "dishes.json"), "utf8")))
  .map(d => ({ ...d, file: "dishes.json" }));

// Every histamine-relevant ingredient: SIGHI >= 2 (moderate-or-higher), the
// class of ingredient that should meaningfully drive a dish's own score.
// Drawn from ALL categories (not just dishes.json) since a dish can list
// another dish as an ingredient (e.g. samosa-chaat -> samosa, cassoulet ->
// confit-de-canard) as well as a plain raw/spice/protein ingredient.
const highHistamine = [...all.values()].filter(f => (f.histamine?.sighi ?? -1) >= 2);

// ---- Group dishes by shared ingredient ---------------------------------
const groups = [];
for (const ing of highHistamine) {
  const members = dishes.filter(d => Array.isArray(d.ingredients) && d.ingredients.includes(ing.id) && d.id !== ing.id);
  if (members.length === 0) continue;
  groups.push({ ingredient: ing, members });
}

// ---- Check each group for consistency ----------------------------------
const flags = [];
for (const { ingredient, members } of groups) {
  for (const dish of members) {
    const dishSighi = dish.histamine?.sighi;
    if (dishSighi == null) continue; // schema gap — validate-data.mjs's job
    const gap = ingredient.histamine.sighi - dishSighi;
    if (gap < MIN_GAP) continue; // at or above the ingredient's own level — fine

    const note = dish.histamine?.note ?? "";
    const documented = REASON_RE.test(note);
    if (documented) continue;

    flags.push({
      ingredientId: ingredient.id, ingredientSighi: ingredient.histamine.sighi,
      dishId: dish.id, dishFile: dish.file, dishSighi, gap,
      note,
      groupSize: members.length,
    });
  }
}
flags.sort((a, b) => b.gap - a.gap || b.groupSize - a.groupSize || a.ingredientId.localeCompare(b.ingredientId) || a.dishId.localeCompare(b.dishId));

// ---- Report -------------------------------------------------------------
console.log(`Found ${highHistamine.length} histamine-relevant ingredients (SIGHI >= 2) across ${all.size} foods.`);
console.log(`${groups.length} of them are used as an ingredient by at least one dish in dishes.json (${dishes.length} dishes total).\n`);

// Per-ingredient summary, ranked by how many of its dishes are inconsistent —
// "soy-sauce: 63 dishes, 9 inconsistent" at a glance.
const byIngredient = new Map();
for (const g of groups) byIngredient.set(g.ingredient.id, { ingredient: g.ingredient, total: g.members.length, flagged: 0 });
for (const f of flags) byIngredient.get(f.ingredientId).flagged++;
const summary = [...byIngredient.values()].filter(s => s.flagged > 0).sort((a, b) => b.flagged - a.flagged || b.total - a.total);

console.log(`SUMMARY — ${summary.length} ingredient groups with at least one inconsistent dish (of ${groups.length} groups total):\n`);
for (const s of summary) {
  console.log(`  ${s.ingredient.id} (SIGHI ${s.ingredient.histamine.sighi}): ${s.total} dishes, ${s.flagged} inconsistent`);
}

console.log(`\nDETAIL — ${flags.length} dish/ingredient flags, largest gap first:\n`);
for (const f of flags) {
  console.log(`  ${f.dishId} [${f.dishFile}] SIGHI ${f.dishSighi} vs. ${f.ingredientId} SIGHI ${f.ingredientSighi} (gap ${f.gap}, group of ${f.groupSize}) — note: "${f.note || "(none)"}"`);
}

console.log(`\n${flags.length} total flags across ${new Set(flags.map(f => f.dishId)).size} dishes. Not every flag is a bug — a dish's own note can legitimately explain a gap in words this script's keyword list doesn't recognise; read each note before touching data. Two-or-more-level gaps are already a hard error in validate-data.mjs — this script's job is the one-level, currently-legal-but-undocumented gap, especially where sibling dishes sharing the same ingredient sit at its full level.`);

const outPath = process.argv[2] ?? null;
if (outPath) {
  writeFileSync(outPath, JSON.stringify({ groups: groups.map(g => ({ ingredient: g.ingredient.id, sighi: g.ingredient.histamine.sighi, members: g.members.map(m => m.id) })), flags }, null, 2));
  console.error(`\n(full JSON written to ${outPath})`);
}
