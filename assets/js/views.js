// One function per screen. Each returns { html, mount? } — mount runs after the
// HTML lands in the DOM (focus, listeners that can't be delegated).
import {
  CATEGORIES, CUISINES, META, SOURCES, STATES, byCategory, fuzzySuggest, getFood, getFoods,
  heatClass, search, systemHeat,
} from "./data.js";
import { favorites, misses, recent, triggers } from "./store.js";
import {
  badgeRow, chip, commonnessLabel, esc, flags, macroRings, miniTile, tileList,
} from "./components.js";

const backBar = (label, href) =>
  `<button class="linkish" data-nav="${href}">← ${esc(label)}</button>`;

// ---- Home ----------------------------------------------------------------

export function homeView() {
  const recents = getFoods(recent.all()).slice(0, 12);
  const states = [
    ["too-hot", "cold"],
    ["too-cold", "hot"],
    ["reactive", "neutral"],
  ];
  return {
    html: `
      <section class="hero">
        <h1>How does your body feel?</h1>
        <p>Pick a state — we'll show foods traditionally classified as helping or aggravating.</p>
      </section>

      <div class="states">
        ${states
          .map(([id, tone]) => {
            const s = STATES[id];
            return `
            <button class="state t-${tone}" data-nav="/state/${id}">
              <span class="state__emoji">${s.emoji}</span>
              <span class="state__label">${esc(s.label)}</span>
              <span class="state__blurb">${esc(s.blurb)}</span>
            </button>`;
          })
          .join("")}
        <button class="state t-neutral" data-nav="/browse">
          <span class="state__emoji">🍃</span>
          <span class="state__label">Balanced</span>
          <span class="state__blurb">Just browsing the library</span>
        </button>
      </div>

      <button class="searchcue" data-nav="/search">🔍 Search ${META.count} foods — try “karela”</button>

      ${
        recents.length
          ? `<section class="section">
               <div class="section__head"><h2>Recently viewed</h2></div>
               <div class="rail">${recents.map(miniTile).join("")}</div>
             </section>`
          : ""
      }

      <section class="section">
        <div class="section__head">
          <h2>Browse by category</h2>
          <button class="linkish" data-nav="/browse">All</button>
        </div>
        ${categoryGrid()}
      </section>`,
  };
}

// ---- Search --------------------------------------------------------------

function resultsHtml(q) {
  if (!q.trim()) {
    return `<p class="muted tiny">Type a name in any language you'd say it — bhindi, bamia, bok choy.</p>`;
  }
  const hits = search(q);
  if (hits.length) {
    return `<p class="eyebrow" style="margin-bottom:10px">${hits.length} result${hits.length === 1 ? "" : "s"}</p>
      ${tileList(hits)}`;
  }
  const near = fuzzySuggest(q);
  return `
    <div class="empty">
      <p><strong>No match for “${esc(q)}”</strong></p>
      <p class="tiny" style="margin-top:6px">Logged it — search misses drive the next data batch.</p>
    </div>
    ${
      near.length
        ? `<section class="section">
             <div class="section__head"><h2>Did you mean</h2></div>
             ${tileList(near)}
           </section>`
        : ""
    }`;
}

export function searchView({ q = "" } = {}) {
  return {
    html: `
      <div class="searchbar">
        <span aria-hidden="true">🔍</span>
        <input id="q" type="search" inputmode="search" autocomplete="off" spellcheck="false"
               placeholder="Search foods, aliases, dishes…" value="${esc(q)}" aria-label="Search foods">
      </div>
      <div id="results">${resultsHtml(q)}</div>`,
    mount(root) {
      const input = root.querySelector("#q");
      const out = root.querySelector("#results");
      let missTimer;
      input.focus({ preventScroll: true });
      input.setSelectionRange(input.value.length, input.value.length);
      input.addEventListener("input", () => {
        const value = input.value;
        out.innerHTML = resultsHtml(value);
        const hash = value ? `#/search?q=${encodeURIComponent(value)}` : "#/search";
        history.replaceState(null, "", hash);
        clearTimeout(missTimer);
        if (value.trim().length >= 2 && search(value).length === 0) {
          missTimer = setTimeout(() => misses.log(value), 900);
        }
      });
    },
  };
}

// ---- Food card -----------------------------------------------------------

const CONF_TITLE = {
  high: "Consistently documented across standard references of that tradition",
  moderate: "Documented, but references vary",
  contested: "References genuinely disagree, or classical documentation is thin",
};

const SYSTEM_NOTE_LABELS = { tcm: "TCM", ayurveda: "Ayurveda", unani: "Unani" };

// Each note is tinted by *its own* system's verdict, not the food's composite —
// TCM calling mango cool must not show up in mango's overall warm tint.
const systemNote = (food, sys) => {
  const t = food.thermal[sys];
  return `
    <div class="note t-${heatClass(systemHeat(food, sys))}">
      <div class="note__head">
        ${esc(SYSTEM_NOTE_LABELS[sys])}
        <span class="note__conf ${t.confidence === "contested" ? "note__conf--contested" : ""}"
              title="${esc(CONF_TITLE[t.confidence])}">${t.confidence}</span>
      </div>
      <div class="note__body">Traditionally classified as <strong>${esc(t.verdict.replace("-", " and "))}</strong>${t.note ? `. ${esc(t.note)}` : "."}</div>
    </div>`;
};

export function foodView(id) {
  const food = getFood(id);
  if (!food) return { html: `<div class="empty">Unknown food.</div>` };
  recent.push(food.id);

  const isFav = favorites.has(food.id);
  const isTrig = triggers.has(food.id);
  const ingredients = getFoods(food.ingredients ?? []);
  const remedy = Object.entries(food.remedy ?? {})
    .map(([state, verdict]) => `${verdict === "eat" ? "Helps" : "Aggravates"} when you feel <strong>${STATES[state].label.toLowerCase()}</strong>`);

  return {
    html: `
      ${backBar("Back", "/")}
      <div class="card__hero t-${food.heatClass}">
        <div class="card__glyph">${food.emoji}</div>
        <div>
          <div class="card__title"><h1>${esc(food.name)}</h1></div>
          ${food.aliases.length ? `<div class="card__aliases">${food.aliases.map(esc).join(" · ")}</div>` : ""}
          <p class="card__desc">${esc(food.description)}</p>
        </div>
      </div>

      ${flags(food)}

      <div class="card__actions">
        <button class="pillbtn" data-act="fav" data-id="${food.id}" aria-pressed="${isFav}">${isFav ? "♥" : "♡"} Favourite</button>
        <button class="pillbtn" data-act="trigger" data-id="${food.id}" aria-pressed="${isTrig}">⚠ ${isTrig ? "One of my triggers" : "Mark as trigger"}</button>
      </div>

      <div class="panel">${badgeRow(food)}</div>

      <div class="panel t-${food.heatClass}">
        <h3>Per 100 ${food.category === "drink" ? "ml" : "g"}</h3>
        ${macroRings(food)}
      </div>

      ${
        ingredients.length
          ? `<div class="panel">
               <h3>Typically contains</h3>
               <p class="tiny muted" style="margin-bottom:10px">Traditions classify the dish as a whole — these are the usual contents, not a calculation.</p>
               <div class="chips">${ingredients.map(chip).join("")}</div>
             </div>`
          : ""
      }

      <div class="panel t-${food.heatClass}">
        <details class="expander" style="border-top:0;padding-top:0">
          <summary>Why it's classified this way</summary>
          <div class="notes" style="margin:12px 0 16px">
            ${systemNote(food, "tcm")}
            ${systemNote(food, "ayurveda")}
            ${systemNote(food, "unani")}
            <div class="note" style="border-left-color:var(--sighi-${food.histamine.sighi})">
              <div class="note__head">Histamine (SIGHI ${food.histamine.sighi})</div>
              <div class="note__body">${esc(food.histamine.note ?? "")}</div>
            </div>
          </div>
          <dl class="kv">
            <dt>Kitchen</dt><dd>${esc(commonnessLabel(food.commonness))}</dd>
            <dt>Cuisines</dt><dd>${food.cuisines.map(c => esc(CUISINES.find(x => x.id === c)?.label ?? c)).join(" · ")}</dd>
            ${remedy.length ? `<dt>Remedy</dt><dd>${remedy.join("<br>")}</dd>` : ""}
            <dt>TCM basis</dt><dd>${esc(SOURCES.legend.tcm)}</dd>
            <dt>Ayurveda basis</dt><dd>${esc(SOURCES.legend.ayurveda)}</dd>
            <dt>Unani basis</dt><dd>${esc(SOURCES.legend.unani)}</dd>
            <dt>Histamine basis</dt><dd>${esc(SOURCES.legend.histamine)}</dd>
            <dt>Nutrition</dt><dd>${esc(SOURCES.legend.nutrition)}</dd>
          </dl>
        </details>
      </div>`,
  };
}

// ---- Browse --------------------------------------------------------------

function categoryGrid() {
  return `<div class="catgrid">
    ${CATEGORIES.map(
      c => `<button class="cat" data-nav="/category/${c.id}">
              <span class="cat__emoji">${c.emoji}</span>
              <span class="cat__label">${esc(c.label)}</span>
              <span class="cat__count">${META.categories[c.id] ?? 0} foods</span>
            </button>`,
    ).join("")}
  </div>`;
}

export function browseView() {
  return {
    html: `
      <section class="hero"><h1>Browse</h1><p>${META.count} foods across South Asian, Arabic, Chinese and Western kitchens.</p></section>
      <section class="section">${categoryGrid()}</section>`,
  };
}

export function categoryView(catId) {
  const cat = CATEGORIES.find(c => c.id === catId);
  if (!cat) return { html: `<div class="empty">Unknown category.</div>` };
  const list = byCategory(catId).sort((a, b) => a.commonness - b.commonness || a.name.localeCompare(b.name));
  return {
    html: `
      ${backBar("Browse", "/browse")}
      <section class="hero"><h1>${cat.emoji} ${esc(cat.label)}</h1><p>${list.length} foods, everyday staples first.</p></section>
      ${tileList(list)}`,
  };
}

// ---- Placeholder until phase 2 ------------------------------------------

export function stateView(stateId) {
  const s = STATES[stateId];
  if (!s) return { html: `<div class="empty">Unknown state.</div>` };
  return {
    html: `${backBar("Home", "/")}
      <section class="hero"><h1>${s.emoji} ${esc(s.label)}</h1><p>${esc(s.blurb)}</p></section>
      <div class="empty">Remedy lists land in the next build step.</div>`,
  };
}
