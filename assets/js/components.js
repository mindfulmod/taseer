// Render helpers. Everything returns an HTML string; the shell owns the DOM.
import { PREP_KINDS, STATES, SYSTEM_LABELS, systemHeat, heatClass } from "./data.js";
import { favorites, triggers } from "./store.js";

export const esc = s =>
  String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const VERDICT_TEXT = v => v.replace("-", " · ");

const COMMONNESS = ["", "Everyday staple", "Common", "Occasional", "Specialty shop"];
export const commonnessLabel = n => COMMONNESS[n] ?? "";

const MECHS = {
  liberator: { glyph: "⚡", label: "Histamine liberator" },
  "high-histamine": { glyph: "●", label: "High histamine" },
  "dao-blocker": { glyph: "⛔", label: "DAO blocker" },
  "other-amines": { glyph: "◆", label: "Other amines" },
};

const SIGHI_TEXT = ["Well tolerated", "Usually fine", "Care advised", "Poorly tolerated"];

export function sighiBadge(food) {
  const { sighi, tags } = food.histamine;
  const segs = [0, 1, 2, 3].map(i => `<i class="${i <= sighi ? "on" : ""}"></i>`).join("");
  return `
    <div class="badge badge--sighi" style="--sighi:var(--sighi-${sighi})">
      <div class="badge__label">Histamine · SIGHI</div>
      <div class="badge__verdict">${sighi} — ${SIGHI_TEXT[sighi]}</div>
      <div class="segments">${segs}</div>
      <!-- The chips were inert labels. They are the only place the reader meets
           a mechanism, so they are now the way into what it means. -->
      ${tags.length ? `<div class="mechs">${tags.map(t => `<button class="mech mech--link" data-nav="/mechanism/${t}">${MECHS[t].glyph} ${esc(MECHS[t].label)} <span class="mech__go" aria-hidden="true">›</span></button>`).join("")}</div>` : ""}
    </div>`;
}

const MARK_LABEL = { H: "high histamine", L: "liberator", A: "other amines", B: "DAO blocker" };
const refReading = ref =>
  `${ref.sighi}${ref.marks ? ` · ${[...ref.marks].map(c => MARK_LABEL[c] ?? c).join(" · ")}` : " · no mechanism marked"}`;

/**
 * Where this reading came from, and whether it matches the source the app cites.
 *
 * The thermal layer has shown its confidence and its disagreements from the
 * start. This is the same courtesy for histamine, which was citing SIGHI while
 * departing from it on 116 of the 187 foods SIGHI lists — silently, which is
 * how a wrong coffee mechanism reached production and stayed there two days.
 * An unreviewed difference is stated as unreviewed; the honest answer is not a
 * rationalisation invented after the fact.
 */
export function provenance(food) {
  const { ref, why } = food.histamine;
  if (!ref) {
    return `<p class="prov prov--derived">Not on the SIGHI list — this reading is taken from close
            relatives and from what the dish contains.</p>`;
  }
  if (food.sourceState === "verified") {
    return `<p class="prov prov--ok">✓ Matches the SIGHI list${
      ref.as.toLowerCase() !== food.name.toLowerCase() ? `, listed there as “${esc(ref.as)}”` : ""}.</p>`;
  }
  return `
    <div class="prov prov--differs">
      <p class="prov__head">⚑ Taseer differs from SIGHI here</p>
      <p class="prov__ref">SIGHI rates <em>${esc(ref.as)}</em> at <strong>${refReading(ref)}</strong>.</p>
      <p class="prov__why">${
        why
          ? esc(why)
          : "Nobody has worked out which reading is right. Treat the difference as an open question, not a considered position."
      }</p>
    </div>`;
}

const SYSTEMS = ["tcm", "ayurveda", "unani"];

/**
 * Painting wrapper (ART.md §8). Everything painted goes through this, so the
 * dark grade is applied in exactly one place. A missing file degrades to the
 * emoji on a tinted ground instead of a broken-image icon.
 */
export const art = (food, src, cls = "") => `
  <span class="art ${cls}">
    <img src="${src}" alt="" loading="lazy" decoding="async"
         onerror="this.parentElement.classList.add('art--none');this.parentElement.append('${food.emoji}')">
  </span>`;

/**
 * The three traditions as thin markers on one shared cold→hot axis.
 *
 * Same information as three stacked verdict badges in ~40% of the height, and
 * the disagreement reads better: one axis means the spread between the markers
 * is directly comparable, which is the whole point of showing three schools
 * side by side. Still per-system — never an average (product spec).
 */
export function thermalScale(food) {
  const rows = SYSTEMS.map(sys => {
    const t = food.thermal[sys];
    const heat = systemHeat(food, sys);
    return `
      <div class="scaperow t-${heatClass(heat)}">
        <span class="scaperow__sys">${SYSTEM_LABELS[sys]}
          <span>${esc(VERDICT_TEXT(t.verdict))}${t.confidence === "contested" ? " ?" : ""}</span>
        </span>
        <span class="scaperow__track">
          <span class="scaperow__dot" style="--p:${((heat + 1) / 2).toFixed(3)}"></span>
        </span>
      </div>`;
  }).join("");
  return `
    <div class="scale">${rows}</div>
    <div class="scale__axis"><span>Cold</span><span>Neutral</span><span>Hot</span></div>`;
}
const joinNames = list =>
  list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list.at(-1)}` : list[0];

/**
 * Card-level disagreement banner. Names which traditions split which way — the
 * conflict is the interesting part of the product, not an error to apologise for.
 */
export function conflictBanner(food) {
  if (!food.conflict) return "";
  const cooling = SYSTEMS.filter(s => systemHeat(food, s) < 0).map(s => SYSTEM_LABELS[s]);
  const warming = SYSTEMS.filter(s => systemHeat(food, s) > 0).map(s => SYSTEM_LABELS[s]);
  return `
    <div class="conflict">
      <span class="conflict__mark" aria-hidden="true">◐</span>
      <div>
        <strong>The traditions disagree here.</strong>
        <p class="tiny">${esc(joinNames(cooling))} read${cooling.length > 1 ? "" : "s"} it cooling;
        ${esc(joinNames(warming))} read${warming.length > 1 ? "" : "s"} it warming.
        Taseer shows both rather than picking a winner.</p>
      </div>
    </div>`;
}

export function flags(food) {
  const out = [];
  if (food.contested) {
    const which = SYSTEMS.filter(s => food.thermal[s].confidence === "contested").map(s => SYSTEM_LABELS[s]);
    out.push(`<span class="flagline" title="References genuinely disagree, or classical documentation is thin">? ${esc(joinNames(which))} contested</span>`);
  }
  if (food.nutrition.estimate) out.push(`<span class="flagline">≈ Nutrition estimated</span>`);
  return out.length ? `<div class="row" style="gap:7px">${out.join("")}</div>` : "";
}

/**
 * Glyph tile carrying the painted thumb, with the emoji left in the DOM
 * underneath it. A missing thumb removes its own <img> and the tinted emoji
 * tile is what shows — no broken image, no layout shift, the same silent
 * degradation the food-card hero already does.
 */
export const artGlyph = (food, cls) => `
  <span class="${cls}">${food.emoji}<img class="glyph__art"
    src="assets/food-thumbs/${food.id}.webp" alt="" loading="lazy" decoding="async"
    onerror="this.remove()"></span>`;

/**
 * Thermal reading at row scale — one dot per tradition, same three systems in
 * the same order as the food card's scale, each carrying its OWN verdict colour.
 *
 * Deliberately not a single dot at a composite position: that would be a
 * synthesized verdict in the most-scanned place in the app, which is the one
 * thing Taseer never does. Three dots still answer "hot or cold?" at a glance
 * when the traditions agree — they are all the same colour — and when they
 * disagree the mixture is the answer, matching the ◐ on the name.
 */
export function thermalDots(food) {
  const label = SYSTEMS
    .map(sys => `${SYSTEM_LABELS[sys]} ${food.thermal[sys].verdict.replace("-", " and ")}`)
    .join(", ");
  const dots = SYSTEMS
    .map(sys => `<i class="t-${heatClass(systemHeat(food, sys))}"></i>`)
    .join("");
  return `<span class="tdots" role="img" aria-label="${esc(label)}">${dots}</span>`;
}

/** Histamine meter, for the one screen where histamine is the actual metric. */
const sighiSegments = food => `
  <span class="segments" style="--sighi:var(--sighi-${food.histamine.sighi});width:34px"
        role="img" aria-label="SIGHI ${food.histamine.sighi} — ${SIGHI_TEXT[food.histamine.sighi].toLowerCase()}">
    ${[0, 1, 2, 3].map(i => `<i class="${i <= food.histamine.sighi ? "on" : ""}"></i>`).join("")}
  </span>`;

/**
 * One list row. `metaFn(food)` overrides the default sub-line; `meter` picks
 * what the row end reads — thermal everywhere except the reactive remedy
 * screen, which is sorted by histamine and should show it.
 */
export function foodTile(food, { metaFn, meter = "thermal" } = {}) {
  const isTrigger = triggers.has(food.id);
  const isFav = favorites.has(food.id);
  const sub = esc(metaFn ? metaFn(food) : food.description);
  return `
    <button class="tile t-${food.heatClass}${isTrigger ? " tile--trigger" : ""}" data-nav="/food/${food.id}">
      ${artGlyph(food, "tile__glyph")}
      <span class="tile__body">
        <span class="tile__name">
          <span>${esc(food.name)}</span>
          ${food.conflict ? `<span class="tile__split" title="Traditions disagree on this food" aria-label="Traditions disagree">◐</span>` : ""}
          ${isFav ? `<span class="fav-dot" aria-label="Favourite">♥</span>` : ""}
          ${isTrigger ? `<span class="tile__flag" aria-label="One of your triggers">⚠</span>` : ""}
        </span>
        <span class="tile__meta">${sub}</span>
      </span>
      <span class="tile__end">
        ${meter === "histamine" ? sighiSegments(food) : thermalDots(food)}
      </span>
    </button>`;
}

export const tileList = (list, opts) =>
  `<div class="tiles">${list.map(f => foodTile(f, opts)).join("")}</div>`;

export const miniTile = food => `
  <button class="minitile t-${food.heatClass}" data-nav="/food/${food.id}">
    ${artGlyph(food, "minitile__glyph")}
    <span class="minitile__name">${esc(food.name)}</span>
  </button>`;

/**
 * A preparation row, shared by the lists screen, the remedy screens and the
 * food card. One renderer on purpose: a preparation offered from three places
 * should look identical in all three, or it reads as three different things.
 */
export const prepTile = (prep, { effect: showEffect = true } = {}) => {
  const { tone, effect } = STATES[prep.state];
  return `
    <button class="tile tile--prep t-${tone}" data-nav="/prep/${prep.id}">
      <span class="tile__glyph">${prep.emoji}</span>
      <span class="tile__body">
        <span class="tile__name"><span>${esc(prep.name)}</span></span>
        <span class="tile__meta">${esc(prep.blurb)}</span>
      </span>
      <span class="tile__end">
        <!-- What the preparation DOES, never the complaint it treats. Off where
             a section heading has just said it — fourteen rows each repeating
             "Cooling" under a COOLING heading is noise, and the time is the
             thing that actually separates them. -->
        ${showEffect ? `<span class="prep__effect">${esc(effect)}</span>` : ""}
        <span class="prep__time">${prep.minutes} min</span>
      </span>
    </button>`;
};

/** Kind · time · yield — the three things you want before committing to cook. */
export const prepFacts = prep =>
  `${esc(PREP_KINDS[prep.kind] ?? prep.kind)} · ${prep.minutes} min · serves ${prep.serves}`;

export const chip = food => `
  <button class="chip t-${food.heatClass}${triggers.has(food.id) ? " chip--trigger" : ""}" data-nav="/food/${food.id}">
    ${artGlyph(food, "chip__glyph")}${esc(food.name)}
  </button>`;

// ---- Macro rings ---------------------------------------------------------

const R = 24;
const CIRC = 2 * Math.PI * R;
const MACROS = [
  { key: "kcal", label: "kcal", max: 400, unit: "" },
  { key: "protein", label: "Protein", max: 30, unit: "g" },
  { key: "carbs", label: "Carbs", max: 60, unit: "g" },
  { key: "fat", label: "Fat", max: 30, unit: "g" },
];

const ring = (value, max, label, unit) => {
  const pct = Math.max(0, Math.min(1, value / max));
  return `
    <div class="ring">
      <svg viewBox="0 0 62 62" role="img" aria-label="${esc(label)} ${value}${unit} per 100 g">
        <circle class="ring__track" cx="31" cy="31" r="${R}"></circle>
        <circle class="ring__fill" cx="31" cy="31" r="${R}"
          stroke-dasharray="${(pct * CIRC).toFixed(1)} ${CIRC.toFixed(1)}"></circle>
        <text class="ring__val" x="31" y="35" text-anchor="middle">${value}${unit}</text>
      </svg>
      <span class="ring__label">${esc(label)}</span>
    </div>`;
};

/**
 * The fourth slot used to hold the hand-written `highlight`, sitting in the
 * ring row under the label "Highlight" as though it were a macro stat. It is
 * not one — two thirds of those strings restate the description printed
 * directly above them, and a line like "the dish two countries argue over"
 * reads as a non-sequitur beside 165 kcal.
 *
 * What belongs there is a reading of the macros themselves, so that is what it
 * is now: derived, always true, and nothing to maintain. The written line moves
 * below the rings as a caption, which is what it always was.
 */
function macroShape({ kcal, protein, carbs, fat }) {
  const cals = protein * 4 + carbs * 4 + fat * 9;
  if (kcal <= 25) return "barely any calories";
  // Calories with no protein, carbohydrate or fat to account for them: a spirit.
  // Alcohol carries ~7 kcal/g and is invisible to the macro rings, so say so
  // rather than repeating the kcal figure sitting next to it.
  if (!cals) return "calories from alcohol";
  const share = n => n / cals;
  if (share(fat * 9) >= 0.65) return "mostly fat";
  if (share(protein * 4) >= 0.45) return "mostly protein";
  if (share(carbs * 4) >= 0.8) return kcal >= 300 ? "dense in carbohydrate" : "mostly carbohydrate";
  if (share(fat * 9) >= 0.4) return "rich, fat-led";
  if (share(protein * 4) >= 0.25) return "protein and carbohydrate";
  return "carbohydrate-led";
}

export const macroRings = food => `
  <div class="rings">
    ${MACROS.map(m => ring(food.nutrition[m.key], m.max, m.label, m.unit)).join("")}
    <div class="ring ring--text">
      <span class="ring__hl">${esc(macroShape(food.nutrition))}</span>
      <span class="ring__label">Profile</span>
    </div>
  </div>
  <p class="rings__note">${esc(food.nutrition.highlight)}</p>`;

export const mechLabel = tag => MECHS[tag]?.label ?? tag;
export const sighiText = n => SIGHI_TEXT[n];
