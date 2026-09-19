// Enforces ART.md §3: every type size in the app comes from the role scale.
//   node scripts/check-type.mjs
//
// The bible defines five roles (Display, Title, Body, Meta, Eyebrow) and the
// stylesheet declares them, plus --fs-small and --fs-display-lg, as tokens on
// :root. Sizes written straight into a rule drift — the app had ~30 distinct
// font-size values for those seven roles — so a literal size is an error here
// and the token list is read from the stylesheet rather than duplicated below.
//
// The one exception is a decorative emoji sitting in a fixed-size badge (the
// glyph tiles): those are px on purpose, so a reader at 200% OS text size
// cannot burst a 50px tile, exactly as an icon font would behave. Each one is
// listed here by size and has to say so in a comment at its own rule.
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSS = join(root, "assets/app.css");

// Fixed-badge emoji fallbacks, by the tile they fill:
//   13px .chip__glyph (22px) · 22px .minitile__glyph (40px)
//   24px .cmp__glyph (46px)  · 26px .tile__glyph (50px) · 40px .card__glyph (74px)
const ALLOWED_PX = new Set([13, 22, 24, 26, 40]);
// What such a rule must acknowledge, within a few lines above the declaration.
const PX_COMMENT = /\bpx\b[^\n]*\b(not rem|see \.[\w-]+|text-size|text scaling)\b/i;

const css = readFileSync(CSS, "utf8");
const tokens = new Set([...css.matchAll(/^\s*(--fs-[\w-]+)\s*:/gm)].map(m => m[1]));
if (!tokens.size) {
  console.error("FATAL: no --fs-* tokens declared in assets/app.css — is the :root block intact?");
  process.exit(1);
}

const files = [CSS, ...readdirSync(join(root, "assets/js")).filter(f => f.endsWith(".js")).map(f => join(root, "assets/js", f))];

const problems = [];
let checked = 0;
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    // Skips the token declarations themselves (`--fs-body: 1rem`), which are
    // the one place a literal size is the point.
    for (const m of line.matchAll(/font-size\s*:\s*([^;}"'`\n]+)/g)) {
      checked++;
      const value = m[1].trim();
      const where = `${relative(root, file)}:${i + 1}`;
      if (value === "inherit") continue;
      const token = value.match(/^var\((--fs-[\w-]+)\)$/);
      if (token) {
        if (!tokens.has(token[1])) problems.push(`${where}  ${value} — no such token on :root`);
        continue;
      }
      const px = value.match(/^(\d+)px$/);
      if (px && ALLOWED_PX.has(Number(px[1]))) {
        const context = lines.slice(Math.max(0, i - 6), i + 1).join("\n");
        if (!PX_COMMENT.test(context)) {
          problems.push(`${where}  ${value} — allowed only for a fixed-size emoji badge, and the rule must say so in a comment`);
        }
        continue;
      }
      problems.push(`${where}  font-size: ${value} — use a role token: ${[...tokens].join(", ")}`);
    }
  });
}

if (problems.length) {
  console.error(`${problems.length} type-scale violation(s):`);
  problems.forEach(p => console.error(" -", p));
  console.error("\nART.md §3 owns the type scale. Map the size onto the nearest role token,");
  console.error("or amend §3 and add a token — never write a one-off size into a rule.");
  process.exit(1);
}
console.log(`Type scale clean — ${checked} font-size declarations, all from ${tokens.size} declared roles ✅`);
