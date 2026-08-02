// One function per screen. Each returns { html, mount? } — mount runs after the
// HTML lands in the DOM (focus, listeners that can't be delegated).
import {
  BANDS, CATEGORIES, CUISINES, LISTS, META, SOURCES, STATES, byCategory, fuzzySuggest, getFood,
  getFoods, getList, getPreparation, heatClass, preparations, remedyList, search, spectrum,
  systemHeat,
} from "./data.js";
import { favorites, misses, recent, triggers } from "./store.js";
import {
  badgeRow, chip, commonnessLabel, conflictBanner, esc, flags, macroRings, mechLabel, miniTile,
  sighiText, tileList,
} from "./components.js";

const backBar = (label, href) =>
  `<button class="linkish" data-nav="${href}">← ${esc(label)}</button>`;

// ---- Home ----------------------------------------------------------------

export function homeView() {
  const recents = getFoods(recent.all()).slice(0, 12);
  return {
    html: `
      <section class="hero">
        <h1>How does your body feel?</h1>
        <p>Pick a state — we'll show foods traditionally classified as helping or aggravating.</p>
      </section>

      <div class="states">
        ${Object.entries(STATES)
          .map(
            ([id, s]) => `
            <button class="state t-${s.tone}" data-nav="/state/${id}">
              <span class="state__emoji">${s.emoji}</span>
              <span class="state__label">${esc(s.label)}</span>
              <span class="state__blurb">${esc(s.blurb)}</span>
            </button>`,
          )
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
    mount(root) {
      // The illustration set is generated externally and lands incrementally, so
      // presence is detected at runtime rather than baked into the dataset.
      const img = root.querySelector(".card__img");
      img?.addEventListener("load", () => root.querySelector("#card")?.classList.add("card--illustrated"));
      img?.addEventListener("error", () => img.closest(".card__media")?.remove());
    },
    html: `
      ${backBar("Back", "/")}
      <article id="card">
      <figure class="card__media t-${food.heatClass}">
        <img class="card__img" src="assets/food-images/${food.id}.webp" alt="Painted illustration of ${esc(food.name)}" decoding="async">
      </figure>
      <div class="card__hero t-${food.heatClass}">
        <div class="card__glyph">${food.emoji}</div>
        <div>
          <div class="card__title"><h1>${esc(food.name)}</h1></div>
          ${food.aliases.length ? `<div class="card__aliases">${food.aliases.map(esc).join(" · ")}</div>` : ""}
          <p class="card__desc">${esc(food.description)}</p>
        </div>
      </div>

      ${conflictBanner(food)}
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
      </div>
      </article>`,
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
  const ways = [
    { to: "/lists", emoji: "📜", label: "Curated lists", sub: `${LISTS.length} lists + ${preparations.length} simple preparations` },
    { to: "/spectrum", emoji: "🌡️", label: "Spectrum", sub: "Every food, coldest to hottest" },
    { to: "/compare", emoji: "⚖️", label: "Compare", sub: "Put two or three side by side" },
  ];
  return {
    html: `
      <section class="hero"><h1>Browse</h1><p>${META.count} foods across South Asian, Arabic, Chinese and Western kitchens.</p></section>
      <section class="section">
        <div class="stack">
          ${ways
            .map(
              w => `<button class="wayrow" data-nav="${w.to}">
                      <span class="wayrow__emoji">${w.emoji}</span>
                      <span><span class="wayrow__label">${esc(w.label)}</span><span class="wayrow__sub">${esc(w.sub)}</span></span>
                      <span class="wayrow__go" aria-hidden="true">›</span>
                    </button>`,
            )
            .join("")}
        </div>
      </section>
      <section class="section">
        <div class="section__head"><h2>By category</h2></div>
        ${categoryGrid()}
      </section>`,
  };
}

// ---- Curated lists & preparations ----------------------------------------

export function listsView() {
  return {
    html: `
      ${backBar("Browse", "/browse")}
      <section class="hero"><h1>Curated lists</h1><p>Shortcuts into the library, and a few things worth making.</p></section>
      <div class="stack">
        ${LISTS.map(l => {
          const n = l.pick().length;
          return `<button class="listcard t-${l.tone}" data-nav="/list/${l.id}">
                    <span class="listcard__title">${esc(l.title)}</span>
                    <span class="listcard__blurb">${esc(l.blurb)}</span>
                    <span class="listcard__count">${n} foods</span>
                  </button>`;
        }).join("")}
      </div>
      <section class="section">
        <div class="section__head"><h2>Simple preparations</h2><span class="tiny muted">${preparations.length}</span></div>
        <p class="tiny muted" style="margin-bottom:12px">Three-step things, not recipes. Each one links to the foods in it.</p>
        <div class="tiles">
          ${preparations
            .map(
              p => `<button class="tile t-${STATES[p.state].tone}" data-nav="/prep/${p.id}">
                      <span class="tile__glyph">${p.emoji}</span>
                      <span class="tile__body">
                        <span class="tile__name"><span>${esc(p.name)}</span></span>
                        <span class="tile__meta">${esc(p.blurb)}</span>
                      </span>
                      <span class="tile__end tiny muted">${esc(STATES[p.state].label)}</span>
                    </button>`,
            )
            .join("")}
        </div>
      </section>`,
  };
}

export function listView(id) {
  const list = getList(id);
  if (!list) return { html: `<div class="empty">Unknown list.</div>` };
  const items = list.pick();
  return {
    tone: list.tone === "neutral" ? null : list.tone,
    html: `
      ${backBar("Lists", "/lists")}
      <section class="hero t-${list.tone}"><h1>${esc(list.title)}</h1><p>${esc(list.blurb)}</p></section>
      ${tileList(items)}`,
  };
}

export function prepView(id) {
  const prep = getPreparation(id);
  if (!prep) return { html: `<div class="empty">Unknown preparation.</div>` };
  const tone = STATES[prep.state].tone;
  const ingredients = getFoods(prep.ingredients);
  return {
    tone,
    html: `
      ${backBar("Lists", "/lists")}
      <div class="card__hero t-${tone}">
        <div class="card__glyph">${prep.emoji}</div>
        <div>
          <div class="card__title"><h1>${esc(prep.name)}</h1></div>
          <p class="card__desc">${esc(prep.blurb)}</p>
        </div>
      </div>

      <div class="panel">
        <h3>What goes in</h3>
        <div class="chips" style="margin-top:10px">${ingredients.map(chip).join("")}</div>
      </div>

      <div class="panel t-${tone}">
        <h3>How</h3>
        <ol class="steps">${prep.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
      </div>

      <p class="tiny muted" style="margin:0 2px">Traditionally taken when you feel
      <strong>${esc(STATES[prep.state].label.toLowerCase())}</strong>. Informational, not medical advice.</p>`,
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

// ---- Compare -------------------------------------------------------------

const COMPARE_MAX = 3;

export function compareView({ ids = "" } = {}) {
  const picked = getFoods(ids.split(",").filter(Boolean)).slice(0, COMPARE_MAX);
  const without = id => picked.filter(f => f.id !== id).map(f => f.id).join(",");

  if (!picked.length) {
    return {
      html: `
        ${backBar("Browse", "/browse")}
        <section class="hero"><h1>Compare</h1><p>Pick two or three foods and see the traditions line up — or not.</p></section>
        ${comparePicker(picked)}`,
      mount: mountComparePicker(picked),
    };
  }

  const cell = (label, render) => `
    <div class="cmp__label">${esc(label)}</div>
    ${picked.map(f => `<div class="cmp__cell">${render(f)}</div>`).join("")}`;

  const verdict = sys => f => {
    const t = f.thermal[sys];
    return `<span class="cmp__verdict t-${heatClass(systemHeat(f, sys))}">${esc(t.verdict.replace("-", " · "))}</span>
      ${t.confidence === "contested" ? `<span class="cmp__conf">contested</span>` : ""}`;
  };

  return {
    html: `
      ${backBar("Browse", "/browse")}
      <section class="hero"><h1>Compare</h1></section>
      <div class="cmp" style="--cols:${picked.length}">
        ${picked
          .map(
            f => `<div class="cmp__head t-${f.heatClass}">
                    <button class="cmp__drop" data-nav="/compare?ids=${without(f.id)}" aria-label="Remove ${esc(f.name)}">✕</button>
                    <span class="cmp__glyph">${f.emoji}</span>
                    <span class="cmp__name">${esc(f.name)}</span>
                  </div>`,
          )
          .join("")}
        ${cell("TCM", verdict("tcm"))}
        ${cell("Ayurveda", verdict("ayurveda"))}
        ${cell("Unani", verdict("unani"))}
        ${cell("Histamine", f => `<span class="cmp__verdict">SIGHI ${f.histamine.sighi}</span><span class="cmp__conf">${esc(sighiText(f.histamine.sighi).toLowerCase())}</span>`)}
        ${cell("Kitchen", f => `<span class="cmp__conf">${esc(commonnessLabel(f.commonness))}</span>`)}
        ${cell("Per 100 g", f => `<span class="cmp__conf">${f.nutrition.kcal} kcal · ${f.nutrition.protein}g protein</span>`)}
        ${cell("", f => `<button class="linkish" data-nav="/food/${f.id}">Open card →</button>`)}
      </div>
      ${picked.length < COMPARE_MAX ? comparePicker(picked) : ""}`,
    mount: mountComparePicker(picked),
  };
}

function comparePicker(picked) {
  return `
    <section class="section">
      <div class="section__head"><h2>${picked.length ? "Add another" : "Pick a food"}</h2></div>
      <div class="searchbar">
        <span aria-hidden="true">🔍</span>
        <input id="cmp-q" type="search" autocomplete="off" placeholder="Search foods…" aria-label="Search foods to compare">
      </div>
      <div id="cmp-results" class="tiles"></div>
    </section>`;
}

function mountComparePicker(picked) {
  return root => {
    const input = root.querySelector("#cmp-q");
    const out = root.querySelector("#cmp-results");
    if (!input || !out) return;
    const chosen = picked.map(f => f.id);
    const draw = () => {
      const hits = search(input.value, 8).filter(f => !chosen.includes(f.id));
      out.innerHTML = input.value.trim()
        ? hits.map(f => addToCompareTile(f, chosen)).join("") || `<p class="tiny muted">No match.</p>`
        : "";
    };
    input.addEventListener("input", draw);
  };
}

const addToCompareTile = (food, chosen) => `
  <button class="tile t-${food.heatClass}" data-nav="/compare?ids=${[...chosen, food.id].join(",")}">
    <span class="tile__glyph">${food.emoji}</span>
    <span class="tile__body">
      <span class="tile__name"><span>${esc(food.name)}</span></span>
      <span class="tile__meta">${esc(food.description)}</span>
    </span>
    <span class="tile__end tiny muted">Add</span>
  </button>`;

// ---- Spectrum explorer ---------------------------------------------------

export function spectrumView({ band = "" } = {}) {
  const all = spectrum();
  const active = BANDS.find(b => b.id === band);
  const shown = active ? all.filter(f => f.heatClass === active.id) : all;

  const rail = `
    <div class="spectrum__rail" role="tablist" aria-label="Temperature bands">
      ${BANDS.map(
        b => `<button class="spectrum__seg t-${b.id}" data-nav="/spectrum${active?.id === b.id ? "" : `?band=${b.id}`}"
                 aria-selected="${active?.id === b.id}">
                <span class="spectrum__segbar"></span>
                <span class="spectrum__seglabel">${esc(b.label)}</span>
                <span class="spectrum__segcount">${all.filter(f => f.heatClass === b.id).length}</span>
              </button>`,
      ).join("")}
    </div>`;

  const groups = (active ? [active] : BANDS)
    .map(b => {
      const items = shown.filter(f => f.heatClass === b.id);
      if (!items.length) return "";
      return `<section class="section">
                <div class="section__head"><h2 class="band">${esc(b.label)}</h2><span class="tiny muted">${esc(b.blurb)}</span></div>
                <div class="rail">${items.map(miniTile).join("")}</div>
              </section>`;
    })
    .join("");

  return {
    tone: active && active.id !== "neutral" && active.id !== "cool" ? active.id : null,
    html: `
      ${backBar("Browse", "/browse")}
      <section class="hero"><h1>Spectrum</h1><p>Every food in the library, coldest to hottest. Tap a band to narrow it.</p></section>
      ${rail}
      <p class="tiny muted" style="margin:12px 2px">Position blends all three traditions — it orders the shelf, it is not a verdict. The badges on each card are the verdicts.</p>
      ${groups}`,
  };
}

// ---- Me ------------------------------------------------------------------

export function meView() {
  const favs = getFoods(favorites.all());
  const trigs = getFoods(triggers.all());
  const recents = getFoods(recent.all());
  const missList = misses.all();

  const section = (title, body, action = "") =>
    `<section class="section"><div class="section__head"><h2>${esc(title)}</h2>${action}</div>${body}</section>`;

  return {
    html: `
      <section class="hero"><h1>Me</h1><p>Everything here stays on this device — no account, no backend, nothing sent anywhere.</p></section>

      ${section(
        "Favourites",
        favs.length ? tileList(favs) : `<div class="empty">Tap ♡ on any food. Favourites float to the top of remedy lists.</div>`,
      )}

      ${section(
        "My triggers",
        trigs.length
          ? tileList(trigs)
          : `<div class="empty">Mark a food as a trigger and it gets a warning ring everywhere it appears — including inside dish ingredients.</div>`,
      )}

      ${section(
        "Recently viewed",
        recents.length ? `<div class="rail">${recents.map(miniTile).join("")}</div>` : `<div class="empty">Nothing yet.</div>`,
        recents.length ? `<button class="linkish" data-act="clear-recent">Clear</button>` : "",
      )}

      ${section(
        "Foods you searched for that aren't here",
        missList.length
          ? `<p class="tiny muted" style="margin-bottom:10px">These drive the next data batch.</p>
             <div class="misslist">
               ${missList
                 .map(m => `<div class="missrow"><span>${esc(m.q)}</span><span class="tiny muted">${m.n > 1 ? `${m.n}×` : ""}</span></div>`)
                 .join("")}
             </div>`
          : `<div class="empty">No misses logged. Search for something we don't have and it lands here.</div>`,
        missList.length
          ? `<button class="linkish" data-act="copy-misses">Copy</button><button class="linkish" data-act="clear-misses">Clear</button>`
          : "",
      )}

      <section class="section" id="install-slot">
        <div class="panel install">
          <div>
            <strong>Install Taseer</strong>
            <p class="tiny">Add it to your home screen and it works with no connection at all.</p>
          </div>
          <button class="pillbtn" data-act="install">Install</button>
        </div>
      </section>

      <section class="section">
        <div class="section__head"><h2>About</h2></div>
        <div class="panel">
          <p><strong>Taseer</strong> (تاثیر) reports how three healing traditions — Traditional Chinese Medicine,
          Ayurveda and Unani — have classified ${META.count} everyday foods as warming or cooling, alongside
          SIGHI histamine compatibility.</p>
          <p style="margin-top:10px">It shows each tradition's own verdict side by side and never merges them into
          a single score. Where they disagree, that disagreement is the interesting part.</p>
          <p style="margin-top:10px"><strong>This is traditional information, not medical advice.</strong>
          Taseer does not diagnose or treat anything. Severe or persistent reactions deserve real care from a
          clinician.</p>
          <dl class="kv" style="margin-top:14px">
            <dt>Thermal</dt><dd>${esc(SOURCES.legend.tcm)}</dd>
            <dt></dt><dd>${esc(SOURCES.legend.ayurveda)}</dd>
            <dt></dt><dd>${esc(SOURCES.legend.unani)}</dd>
            <dt>Histamine</dt><dd>${esc(SOURCES.legend.histamine)}</dd>
            <dt>Nutrition</dt><dd>${esc(SOURCES.legend.nutrition)}</dd>
          </dl>
          <div class="row" style="margin-top:14px">
            <button class="pillbtn" data-act="show-banner">Show the safety notice again</button>
          </div>
        </div>
      </section>`,
  };
}

// ---- Remedy results ------------------------------------------------------

const SIGHI_META = food => {
  const tags = food.histamine.tags.map(mechLabel);
  return `SIGHI ${food.histamine.sighi} · ${sighiText(food.histamine.sighi).toLowerCase()}${tags.length ? ` · ${tags.join(", ").toLowerCase()}` : ""}`;
};

const GROUPS = [
  { n: 1, label: "Everyday staples" },
  { n: 2, label: "Common" },
  { n: 3, label: "Occasional" },
  { n: 4, label: "Specialty shop" },
];

/** Renders the list in commonness bands, with favourites lifted into their own band. */
function rankedGroups(list, favIds, metaFn) {
  const fav = new Set(favIds);
  const favs = list.filter(f => fav.has(f.id));
  const rest = list.filter(f => !fav.has(f.id));
  const band = (label, items, extra = "") =>
    items.length
      ? `<section class="section">
           <div class="section__head"><h2 class="band">${esc(label)}${extra}</h2><span class="tiny muted">${items.length}</span></div>
           ${tileList(items, { metaFn })}
         </section>`
      : "";
  return (
    band("Your favourites", favs, ` <span class="fav-dot">♥</span>`) +
    GROUPS.map(g => band(g.label, rest.filter(f => f.commonness === g.n))).join("")
  );
}

export function stateView(stateId, { list = "eat" } = {}) {
  const state = STATES[stateId];
  if (!state) return { html: `<div class="empty">Unknown state.</div>` };
  const verdict = list === "avoid" ? "avoid" : "eat";
  const favIds = favorites.all();
  const eat = remedyList(stateId, "eat", favIds);
  const avoid = remedyList(stateId, "avoid", favIds);
  const shown = verdict === "eat" ? eat : avoid;
  const metaFn = stateId === "reactive" ? SIGHI_META : undefined;

  const tab = (id, label, count) => `
    <button class="segbar__btn" data-nav="/state/${stateId}?list=${id}" aria-selected="${verdict === id}">
      ${label} <span class="segbar__count">${count}</span>
    </button>`;

  return {
    tone: state.tone,
    html: `
      ${backBar("Home", "/")}
      <section class="hero t-${state.tone}">
        <h1><span aria-hidden="true">${state.emoji}</span> ${esc(state.label)}</h1>
        <p>${esc(state.blurb)}.</p>
      </section>

      <div class="segbar" role="tablist">
        ${tab("eat", verdict === "eat" ? "Eat this" : "Eat", eat.length)}
        ${tab("avoid", verdict === "avoid" ? "Avoid this" : "Avoid", avoid.length)}
      </div>

      ${
        stateId === "reactive"
          ? `<p class="tiny muted" style="margin:0 2px 14px">Computed from SIGHI scores — safe means 0 and not a histamine liberator; avoid means 2+, or a liberator or DAO-blocker.</p>`
          : `<p class="tiny muted" style="margin:0 2px 14px">Everyday kitchen items first. Traditional classifications, not medical advice.</p>`
      }

      ${shown.length ? rankedGroups(shown, favIds, metaFn) : `<div class="empty">Nothing in this list yet.</div>`}`,
  };
}
