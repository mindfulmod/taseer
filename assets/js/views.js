// One function per screen. Each returns { html, mount? } — mount runs after the
// HTML lands in the DOM (focus, listeners that can't be delegated).
import {
  BANDS, CATEGORIES, CUISINES, LISTS, META, SORTS, SOURCES, STATES, byCategory, fuzzySuggest,
  getFood, getFoods, getList, getPreparation, heatClass, preparations, remedyList, search,
  sortFoods, spectrum, systemHeat,
} from "./data.js";
import { favorites, misses, recent, triggers } from "./store.js";
import {
  art, artGlyph, chip, commonnessLabel, conflictBanner, esc, flags, macroRings, mechLabel,
  miniTile, sighiBadge, sighiText, thermalScale, tileList,
} from "./components.js";

const backBar = (label, href) =>
  `<button class="linkish" data-nav="${href}">← ${esc(label)}</button>`;

// ---- Home ----------------------------------------------------------------

export function homeView() {
  const recents = getFoods(recent.all()).slice(0, 12);
  return {
    html: `
      <!-- The brand is content here rather than chrome on every screen. -->
      <div class="brand">
        <img class="brand__mark" src="assets/ui/taseer-mark.png" alt="">
        Taseer
        <span class="brand__sub">تاثیر</span>
      </div>

      <section class="hero">
        <h1>How does your body feel?</h1>
        <p>Pick a state — we'll show foods traditionally classified as helping or aggravating.</p>
      </section>

      <!-- Each card has to read on its own: the title asks about you, the line
           under it says what the list holds. A card that only makes sense once
           you have read the heading above it is a card that failed. -->
      <div class="states">
        ${Object.entries(STATES)
          .map(
            ([id, s]) => `
            <button class="state t-${s.tone}" data-nav="/state/${id}">
              <img class="state__icon" src="assets/ui/icons/state-${id}.png" alt="" aria-hidden="true">
              <span class="state__label">${esc(s.ask)}</span>
              <span class="state__blurb">${esc(s.blurb)}</span>
            </button>`,
          )
          .join("")}
        <button class="state t-neutral" data-nav="/find">
          <img class="state__icon" src="assets/ui/icons/state-balanced.png" alt="" aria-hidden="true">
          <span class="state__label">Just browsing?</span>
          <span class="state__blurb">All ${META.count} foods by category</span>
        </button>
      </div>

      <!-- focus=1: tapping a search affordance should land in the box. Tapping
           the Find tab itself should not — see findView's mount. -->
      <button class="searchcue" data-nav="/find?focus=1">
        <img class="searchcue__icon" src="assets/ui/icons/tab-search.png" alt="" aria-hidden="true">
        Search ${META.count} foods — try “karela”
      </button>

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
          <button class="linkish" data-nav="/find">All</button>
        </div>
        ${categoryGrid()}
      </section>`,
  };
}

// ---- Find (search + browse) ----------------------------------------------

/** Only ever called with a non-empty query — findBody owns the empty case. */
function resultsHtml(q) {
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

/**
 * Find — search and browse in one tab.
 *
 * They were never two jobs. Both existed to locate a food, and splitting them
 * across two tabs meant guessing up front whether you knew the name. The search
 * box is always there; with it empty the screen is the browse library, and
 * typing swaps the library for results. Clearing the box brings it back.
 */
export function findView({ q = "", focus = "" } = {}) {
  return {
    html: `
      <section class="hero">
        <h1>Find</h1>
        <p>${META.count} foods across the world's home kitchens.</p>
      </section>

      <div class="searchbar">
        <img class="searchbar__icon" src="assets/ui/icons/tab-search.png" alt="" aria-hidden="true">
        <input id="q" type="search" inputmode="search" autocomplete="off" spellcheck="false"
               placeholder="Search ${META.count} foods — try “karela”" value="${esc(q)}"
               aria-label="Search foods, in any language you'd say the name">
      </div>

      <div id="findbody">${findBody(q)}</div>`,
    mount(root) {
      const input = root.querySelector("#q");
      const body = root.querySelector("#findbody");
      let missTimer;

      // Only when the user tapped a search affordance to get here. Focusing on
      // every visit would throw the keyboard over the library they came to browse.
      if (focus) {
        input.focus({ preventScroll: true });
        input.setSelectionRange(input.value.length, input.value.length);
      }

      input.addEventListener("input", () => {
        const value = input.value;
        body.innerHTML = findBody(value);
        history.replaceState(null, "", value ? `#/find?q=${encodeURIComponent(value)}` : "#/find");
        clearTimeout(missTimer);
        if (value.trim().length >= 2 && search(value).length === 0) {
          missTimer = setTimeout(() => misses.log(value), 900);
        }
      });
    },
  };
}

/** Results while there is a query; the browse library while there isn't. */
function findBody(q) {
  return q.trim() ? resultsHtml(q) : browseBody();
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
      <article id="card" class="t-${food.heatClass}">
      <!-- ART.md §10.1: the painting runs to the top edge with no header above
           it, and the title card overlaps up into it. The back and favourite
           controls float on the art, which is what removes the header. -->
      <div class="fhero">
        ${art(food, `assets/food-images/${food.id}.webp`)}
        <button class="fhero__btn fhero__btn--back" data-back="/category/${food.category}" aria-label="Back">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>
        </button>
        <button class="fhero__btn fhero__btn--fav${isFav ? " is-on" : ""}" data-act="fav" data-id="${food.id}"
                aria-pressed="${isFav}" aria-label="Favourite">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19.6s-7.2-4.5-7.2-9.3A4 4 0 0 1 12 7.9a4 4 0 0 1 7.2 2.4c0 4.8-7.2 9.3-7.2 9.3Z"/></svg>
        </button>
      </div>

      <div class="titlecard">
        <p class="eyebrow">${esc(CATEGORIES.find(c => c.id === food.category)?.label ?? food.category)}${
          food.cuisines.length ? ` · ${esc(CUISINES.find(x => x.id === food.cuisines[0])?.label ?? food.cuisines[0])}` : ""
        }</p>
        <h1>${esc(food.name)}</h1>
        ${food.aliases.length ? `<div class="card__aliases">${food.aliases.map(esc).join(" · ")}</div>` : ""}
        <p class="card__desc">${esc(food.description)}</p>

        <!-- Thermal nature is what the app is FOR, so it sits in the title card
             above the fold rather than in a panel below the nutrition. -->
        <div class="cardsection">
          <h3>Thermal nature</h3>
          <p class="tiny muted">Where each tradition places it</p>
          ${thermalScale(food)}
          ${food.conflict ? "" : `<p class="spread"><strong>All three traditions agree.</strong> The readings line up across the scale.</p>`}
        </div>
      </div>

      ${conflictBanner(food)}
      ${flags(food)}

      <div class="card__actions">
        <button class="pillbtn" data-act="trigger" data-id="${food.id}" aria-pressed="${isTrig}">⚠ ${isTrig ? "One of my triggers" : "Mark as trigger"}</button>
      </div>

      <div class="panel">${sighiBadge(food)}</div>

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

// ---- The library (Find's empty-query body) --------------------------------

function categoryGrid() {
  return `<div class="catgrid">
    ${CATEGORIES.map(
      c => `<button class="cat" data-nav="/category/${c.id}">
              <img class="cat__cut" src="assets/ui/categories/${c.id}.png" alt="" aria-hidden="true" loading="lazy">
              <span class="cat__label">${esc(c.label)}</span>
              <span class="cat__count">${META.categories[c.id] ?? 0} foods</span>
            </button>`,
    ).join("")}
  </div>`;
}

/** The library itself — what Find shows whenever the search box is empty. */
function browseBody() {
  const ways = [
    { to: "/lists", icon: "browse-curated", label: "Curated lists", sub: `${LISTS.length} lists + ${preparations.length} simple preparations` },
    { to: "/spectrum", icon: "browse-spectrum", label: "Spectrum", sub: "Every food, coldest to hottest" },
    { to: "/compare", icon: "browse-compare", label: "Compare", sub: "Put two or three side by side" },
  ];
  return `
    <section class="section">
      <div class="stack stack--ways">
        ${ways
          .map(
            w => `<button class="wayrow" data-nav="${w.to}">
                    <img class="wayrow__icon" src="assets/ui/icons/${w.icon}.png" alt="" aria-hidden="true">
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
    </section>`;
}

// ---- Curated lists & preparations ----------------------------------------

export function listsView() {
  return {
    html: `
      ${backBar("Find", "/find")}
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
                      <!-- What the preparation DOES, never the complaint it treats. -->
                      <span class="tile__end prep__effect">${esc(STATES[p.state].effect)}</span>
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
          <p class="eyebrow">${esc(STATES[prep.state].effect)}</p>
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

const byStaplesFirst = (a, b) => a.commonness - b.commonness || a.name.localeCompare(b.name);

/**
 * Cuisine chips earn their space on Dishes and nowhere else. A dish belongs to
 * exactly one kitchen 98% of the time, so the filter cuts 970 down to 36–190.
 * Ingredients sit in several kitchens at once — half of all fruit carries two
 * or more tags — so the same control there would hide half the list while
 * cutting nothing the reader wanted gone.
 */
const cuisineFilterable = catId => catId === "dish";

/**
 * The sort control. Rendered as a native <select> on purpose: four to six
 * options is too many for a chip row that already carries eleven cuisines, and
 * the platform picker is better on a phone than anything hand-rolled.
 */
function sortSelect(current, ids, id = "sortby") {
  return `
    <label class="sortby">
      <span class="sr">Sort by</span>
      <select id="${id}" class="sortby__sel">
        ${ids
          .map(s => `<option value="${s}"${s === current ? " selected" : ""}>${esc(SORTS[s].label)}</option>`)
          .join("")}
      </select>
    </label>`;
}

const CAT_SORTS = ["staples", "hottest", "coolest", "gentlest", "az"];

/**
 * A thermally-sorted list rendered flat reads as alphabetical, because the
 * composite lands on so few distinct values that long runs share one. Grouping
 * the run under its band name makes the ranking legible and honest at once:
 * you can see that 66 foods really are equally cold, rather than guessing why
 * the order looks arbitrary.
 */
function thermalBands(list, dir, opts) {
  const order = BANDS.map(b => b.id);
  if (dir === "desc") order.reverse();
  return order
    .map(id => {
      const items = list.filter(f => heatClass(f.heat) === id);
      if (!items.length) return "";
      const band = BANDS.find(b => b.id === id);
      return `
        <section class="section">
          <div class="section__head">
            <h2 class="band t-${id}">${esc(band.label)}</h2>
            <span class="tiny muted">${items.length}</span>
          </div>
          ${tileList(items, opts)}
        </section>`;
    })
    .join("");
}

/** Ranked output: banded when the sort is thermal, flat otherwise. */
function sortedList(list, sort, opts) {
  const dir = SORTS[sort]?.band;
  return dir ? thermalBands(list, dir, opts) : tileList(list, opts);
}

function categoryBody(pool, q, cuisine, sort) {
  let list = cuisine ? pool.filter(f => f.cuisines.includes(cuisine)) : pool;
  // A query ranks by match quality — reordering those hits by temperature would
  // bury the exact-name match the reader was after. Sorting owns the rest.
  list = q.trim() ? search(q, 500, list) : sortFoods(list, sort);

  if (!list.length) {
    return `<div class="empty">Nothing matches${q.trim() ? ` “${esc(q.trim())}”` : ""} here.
      ${cuisine ? "Try clearing the cuisine filter." : "Try a different spelling, or search from Find."}</div>`;
  }
  const of = list.length === pool.length ? "" : ` of ${pool.length}`;
  // The noun agrees with whichever number it follows — "1 of 970 foods", but
  // "1 food" when the category really does hold one.
  const noun = (of ? pool.length : list.length) === 1 ? "food" : "foods";
  const how = q.trim() ? "best match first" : SORTS[sort in SORTS ? sort : "staples"].label.toLowerCase();
  return `
    <p class="tiny muted" style="margin:0 2px 10px">${list.length}${of} ${noun}, ${how}.</p>
    ${q.trim() ? tileList(list) : sortedList(list, sort)}`;
}

export function categoryView(catId, { q = "", cuisine = "", sort = "staples" } = {}) {
  const cat = CATEGORIES.find(c => c.id === catId);
  if (!cat) return { html: `<div class="empty">Unknown category.</div>` };
  const pool = byCategory(catId);
  const cuisines = cuisineFilterable(catId)
    ? CUISINES.filter(c => pool.some(f => f.cuisines.includes(c.id)))
    : [];
  if (!(sort in SORTS)) sort = "staples";

  const chipFor = (id, label, on) =>
    `<button class="pillbtn" data-cuisine="${esc(id)}" aria-pressed="${on}">${esc(label)}</button>`;

  return {
    html: `
      ${backBar("Find", "/find")}
      <section class="hero hero--cat">
        <img class="hero__cut" src="assets/ui/categories/${cat.id}.png" alt="" aria-hidden="true">
        <h1>${esc(cat.label)}</h1><p>${pool.length} foods to look through.</p>
      </section>

      <div class="findrow">
        <div class="searchbar">
          <img class="searchbar__icon" src="assets/ui/icons/tab-search.png" alt="" aria-hidden="true">
          <input id="catq" type="search" inputmode="search" autocomplete="off" spellcheck="false"
                 placeholder="Search ${esc(cat.label.toLowerCase())}" value="${esc(q)}"
                 aria-label="Search within ${esc(cat.label)}">
        </div>
        ${sortSelect(sort, CAT_SORTS)}
      </div>

      ${
        cuisines.length
          ? `<div class="chiprow" role="group" aria-label="Filter by cuisine">
               ${chipFor("", "All", !cuisine)}
               ${cuisines.map(c => chipFor(c.id, c.label, c.id === cuisine)).join("")}
             </div>`
          : ""
      }

      <div id="catbody">${categoryBody(pool, q, cuisine, sort)}</div>`,

    mount(root) {
      const input = root.querySelector("#catq");
      const sel = root.querySelector("#sortby");
      const body = root.querySelector("#catbody");
      let q0 = q;
      let cuisine0 = cuisine;
      let sort0 = sort;

      // Arriving on a shared link with a filter already set, the active chip can
      // sit off the right edge of the scroller — the list looks arbitrarily
      // short with nothing on screen explaining why. Only scroll when it really
      // is out of view: centring a chip that was already visible pushes "All"
      // off the left edge, hiding the only way to clear the filter.
      if (cuisine0) {
        const active = root.querySelector(`[data-cuisine="${CSS.escape(cuisine0)}"]`);
        const row = active?.parentElement;
        if (active && row) {
          const a = active.getBoundingClientRect();
          const r = row.getBoundingClientRect();
          if (a.left < r.left || a.right > r.right) {
            active.scrollIntoView({ block: "nearest", inline: "center" });
          }
        }
      }

      // replaceState, not a hash change: re-rendering the whole screen on every
      // keystroke would rebuild the chip row and steal focus from the input.
      const sync = () => {
        body.innerHTML = categoryBody(pool, q0, cuisine0, sort0);
        const p = new URLSearchParams();
        if (q0.trim()) p.set("q", q0.trim());
        if (cuisine0) p.set("cuisine", cuisine0);
        if (sort0 !== "staples") p.set("sort", sort0);
        const qs = p.toString();
        history.replaceState(null, "", `#/category/${catId}${qs ? `?${qs}` : ""}`);
      };

      input.addEventListener("input", () => {
        q0 = input.value;
        sync();
      });

      sel?.addEventListener("change", () => {
        sort0 = sel.value;
        sync();
      });

      for (const btn of root.querySelectorAll("[data-cuisine]")) {
        btn.addEventListener("click", () => {
          cuisine0 = btn.dataset.cuisine === cuisine0 ? "" : btn.dataset.cuisine;
          for (const b of root.querySelectorAll("[data-cuisine]")) {
            b.setAttribute("aria-pressed", String(b.dataset.cuisine === cuisine0));
          }
          sync();
        });
      }
    },
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
        ${backBar("Find", "/find")}
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
      ${backBar("Find", "/find")}
      <section class="hero"><h1>Compare</h1></section>
      <div class="cmp" style="--cols:${picked.length}">
        ${picked
          .map(
            f => `<div class="cmp__head t-${f.heatClass}">
                    <button class="cmp__drop" data-nav="/compare?ids=${without(f.id)}" aria-label="Remove ${esc(f.name)}">✕</button>
                    ${artGlyph(f, "cmp__glyph")}
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
    ${artGlyph(food, "tile__glyph")}
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
      ${backBar("Find", "/find")}
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

      <!-- Theme used to live in the app bar; with the bar gone it belongs with
           the rest of the settings. app.js keeps the glyph in sync. -->
      <div class="setrow">
        <span class="setrow__label">Appearance</span>
        <button class="iconbtn iconbtn--ghost" id="theme-toggle" data-act="theme" aria-label="Toggle dark mode">🌙</button>
      </div>

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
function rankedGroups(list, favIds, opts) {
  const fav = new Set(favIds);
  const favs = list.filter(f => fav.has(f.id));
  const rest = list.filter(f => !fav.has(f.id));
  const band = (label, items, extra = "") =>
    items.length
      ? `<section class="section">
           <div class="section__head"><h2 class="band">${esc(label)}${extra}</h2><span class="tiny muted">${items.length}</span></div>
           ${tileList(items, opts)}
         </section>`
      : "";
  return (
    band("Your favourites", favs, ` <span class="fav-dot">♥</span>`) +
    GROUPS.map(g => band(g.label, rest.filter(f => f.commonness === g.n))).join("")
  );
}

export function stateView(stateId, { list = "eat", q = "", sort = "" } = {}) {
  const state = STATES[stateId];
  if (!state) return { html: `<div class="empty">Unknown state.</div>` };
  const verdict = list === "avoid" ? "avoid" : "eat";
  if (sort && !(sort in SORTS)) sort = "";
  const favIds = favorites.all();
  const eat = remedyList(stateId, "eat", favIds);
  const avoid = remedyList(stateId, "avoid", favIds);
  // Reactive is the one remedy sorted BY histamine, so its rows read histamine —
  // both the sub-line and the meter. Everywhere else the meter is thermal.
  const tileOpts = stateId === "reactive" ? { metaFn: SIGHI_META, meter: "histamine" } : undefined;

  // Switching Eat/Avoid keeps whatever search and sort you had — they describe
  // how you want to read a list, not which list you are reading.
  const keep = extra => {
    const p = new URLSearchParams(extra);
    if (q.trim()) p.set("q", q.trim());
    if (sort) p.set("sort", sort);
    return p.toString();
  };
  const tab = (id, label, count) => `
    <button class="segbar__btn" data-nav="/state/${stateId}?${keep({ list: id })}" aria-selected="${verdict === id}">
      ${label} <span class="segbar__count">${count}</span>
    </button>`;

  // The remedy's own axis leads. "Too hot" wants its strongest coolers at the
  // top, so Coolest is offered first there and Hottest first on "too cold";
  // the reactive screen ranks by histamine instead, which is its whole subject.
  const sorts =
    stateId === "reactive"
      ? ["gentlest", "coolest", "hottest", "az"]
      : stateId === "too-hot"
        ? ["coolest", "hottest", "gentlest", "az"]
        : ["hottest", "coolest", "gentlest", "az"];

  return {
    tone: state.tone,
    html: `
      ${backBar("Home", "/")}
      <section class="hero hero--cat t-${state.tone}">
        <img class="hero__cut" src="assets/ui/icons/state-${stateId}.png" alt="" aria-hidden="true">
        <!-- "Feeling …", not a bare "Too hot": on its own that reads as a screen
             about hot foods, when it is the opposite. -->
        <h1>Feeling ${esc(state.label.toLowerCase())}</h1>
        <p>${esc(state.blurb)}.</p>
      </section>

      <div class="segbar" role="tablist">
        ${tab("eat", verdict === "eat" ? "Eat this" : "Eat", eat.length)}
        ${tab("avoid", verdict === "avoid" ? "Avoid this" : "Avoid", avoid.length)}
      </div>

      <div class="findrow">
        <div class="searchbar">
          <img class="searchbar__icon" src="assets/ui/icons/tab-search.png" alt="" aria-hidden="true">
          <input id="stateq" type="search" inputmode="search" autocomplete="off" spellcheck="false"
                 placeholder="Search this list" value="${esc(q)}"
                 aria-label="Search within these foods">
        </div>
        <label class="sortby">
          <span class="sr">Sort by</span>
          <select id="statesort" class="sortby__sel">
            <option value=""${sort ? "" : " selected"}>Everyday first</option>
            ${sorts
              .map(s => `<option value="${s}"${s === sort ? " selected" : ""}>${esc(SORTS[s].label)}</option>`)
              .join("")}
          </select>
        </label>
      </div>

      ${
        stateId === "reactive"
          ? `<p class="tiny muted" style="margin:0 2px 14px">Computed from SIGHI scores — safe means 0 and not a histamine liberator; avoid means 2+, or a liberator or DAO-blocker.</p>`
          : `<p class="tiny muted" style="margin:0 2px 14px">Traditional classifications, not medical advice.</p>`
      }

      <div class="remedy" id="remedybody">
        ${remedyColumn("eat", "Eat this", eat, verdict, favIds, tileOpts, { q, sort })}
        ${remedyColumn("avoid", "Avoid", avoid, verdict, favIds, tileOpts, { q, sort })}
      </div>`,

    mount(root) {
      const input = root.querySelector("#stateq");
      const sel = root.querySelector("#statesort");
      const body = root.querySelector("#remedybody");
      let q0 = q;
      let sort0 = sort;

      // Same reasoning as the category screen: replaceState so a keystroke does
      // not re-render the screen out from under the input it came from.
      const sync = () => {
        body.innerHTML =
          remedyColumn("eat", "Eat this", eat, verdict, favIds, tileOpts, { q: q0, sort: sort0 }) +
          remedyColumn("avoid", "Avoid", avoid, verdict, favIds, tileOpts, { q: q0, sort: sort0 });
        const p = new URLSearchParams();
        if (verdict !== "eat") p.set("list", verdict);
        if (q0.trim()) p.set("q", q0.trim());
        if (sort0) p.set("sort", sort0);
        const qs = p.toString();
        history.replaceState(null, "", `#/state/${stateId}${qs ? `?${qs}` : ""}`);
      };

      input.addEventListener("input", () => {
        q0 = input.value;
        sync();
      });
      sel.addEventListener("change", () => {
        sort0 = sel.value;
        sync();
      });
    },
  };
}

/**
 * Both lists are always rendered. Phones show the one the segmented control
 * selects; desktop shows both side by side and hides the control (ART.md §5).
 */
function remedyColumn(id, label, items, active, favIds, opts, { q = "", sort = "" } = {}) {
  const shown = q.trim() ? search(q, 500, items) : sort ? sortFoods(items, sort) : items;

  let inner;
  if (!shown.length) {
    inner = `<div class="empty">${
      q.trim() ? `Nothing here matches “${esc(q.trim())}”.` : "Nothing in this list yet."
    }</div>`;
  } else if (q.trim() || sort) {
    // Commonness bands are the default shape, but they fight an explicit sort:
    // "hottest first" split across four headed groups is four restarts, not one
    // ranking. A chosen order flattens the list so the top really is the top.
    const of = shown.length === items.length ? "" : ` of ${items.length}`;
    inner = `<p class="tiny muted" style="margin:0 2px 10px">${shown.length}${of}, ${
      q.trim() ? "best match first" : SORTS[sort].label.toLowerCase()
    }.</p>${q.trim() ? tileList(shown, opts) : sortedList(shown, sort, opts)}`;
  } else {
    inner = rankedGroups(shown, favIds, opts);
  }

  return `
    <div class="remedy__col${id === active ? " is-active" : ""}" data-col="${id}">
      <div class="remedy__head"><h2>${esc(label)}</h2><span class="tiny muted">${items.length}</span></div>
      ${inner}
    </div>`;
}
