// Render helpers. Everything returns an HTML string; the shell owns the DOM.
import { SYSTEM_LABELS, systemHeat, heatClass } from "./data.js";
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
};

const SIGHI_TEXT = ["Well tolerated", "Usually fine", "Care advised", "Poorly tolerated"];

/** Position on the shared warm↔cool gradient track, 0–100%. */
const dotPos = heat => `${((heat + 1) / 2) * 100}%`;

export function thermalBadge(food, sys) {
  const t = food.thermal[sys];
  const cls = heatClass(systemHeat(food, sys));
  const contested = t.confidence === "contested";
  return `
    <div class="badge t-${cls}${contested ? " badge--contested" : ""}">
      <div class="badge__label">${SYSTEM_LABELS[sys]}</div>
      <div class="badge__verdict">${esc(VERDICT_TEXT(t.verdict))}</div>
      <div class="badge__track"><span class="badge__dot" style="left:${dotPos(systemHeat(food, sys))}"></span></div>
    </div>`;
}

export function sighiBadge(food) {
  const { sighi, tags } = food.histamine;
  const segs = [0, 1, 2, 3].map(i => `<i class="${i <= sighi ? "on" : ""}"></i>`).join("");
  return `
    <div class="badge badge--sighi" style="--sighi:var(--sighi-${sighi})">
      <div class="badge__label">Histamine · SIGHI</div>
      <div class="badge__verdict">${sighi} — ${SIGHI_TEXT[sighi]}</div>
      <div class="segments">${segs}</div>
      ${tags.length ? `<div class="mechs">${tags.map(t => `<span class="mech" title="${esc(MECHS[t].label)}">${MECHS[t].glyph} ${esc(MECHS[t].label)}</span>`).join("")}</div>` : ""}
    </div>`;
}

export const badgeRow = food => `
  <div class="badges">
    ${["tcm", "ayurveda", "unani"].map(s => thermalBadge(food, s)).join("")}
    ${sighiBadge(food)}
  </div>`;

const SYSTEMS = ["tcm", "ayurveda", "unani"];
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

/** One list row. `metaFn(food)` overrides the default sub-line. */
export function foodTile(food, { metaFn } = {}) {
  const isTrigger = triggers.has(food.id);
  const isFav = favorites.has(food.id);
  const sub = esc(metaFn ? metaFn(food) : food.description);
  return `
    <button class="tile t-${food.heatClass}${isTrigger ? " tile--trigger" : ""}" data-nav="/food/${food.id}">
      <span class="tile__glyph">${food.emoji}</span>
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
        <span class="segments" style="--sighi:var(--sighi-${food.histamine.sighi});width:34px" aria-label="SIGHI ${food.histamine.sighi}">
          ${[0, 1, 2, 3].map(i => `<i class="${i <= food.histamine.sighi ? "on" : ""}"></i>`).join("")}
        </span>
      </span>
    </button>`;
}

export const tileList = (list, opts) =>
  `<div class="tiles">${list.map(f => foodTile(f, opts)).join("")}</div>`;

export const miniTile = food => `
  <button class="minitile t-${food.heatClass}" data-nav="/food/${food.id}">
    <span class="minitile__glyph">${food.emoji}</span>
    <span class="minitile__name">${esc(food.name)}</span>
  </button>`;

export const chip = food => `
  <button class="chip t-${food.heatClass}${triggers.has(food.id) ? " chip--trigger" : ""}" data-nav="/food/${food.id}">
    <span>${food.emoji}</span>${esc(food.name)}
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

export const macroRings = food => `
  <div class="rings">
    ${MACROS.map(m => ring(food.nutrition[m.key], m.max, m.label, m.unit)).join("")}
    <div class="ring ring--text">
      <span class="ring__hl">${esc(food.nutrition.highlight)}</span>
      <span class="ring__label">Highlight</span>
    </div>
  </div>`;

export const mechLabel = tag => MECHS[tag]?.label ?? tag;
export const sighiText = n => SIGHI_TEXT[n];
