// One function per screen. Each returns { html, mount? } — mount runs after the
// HTML lands in the DOM (focus, listeners that can't be delegated).
import {
  BANDS, CATEGORIES, CUISINES, LISTS, META, SORTS, SOURCES, STATES, byCategory, fuzzySuggest,
  BLOATING, COMPOUNDS, EFFECTS, EFFECT_IDS, GUNAS, GUNA_IDS, MECHANISM_IDS, MECHANISMS,
  effectsCount, foodsWithEffect, foodsWithGuna, foodsWithMechanism, getEffectEntry, gunaCount,
  stimulantFamilies, getFood, getFoodDetail, getFoods, getList, getMechanism,
  getPreparation, heatClass, preparations, prepsForState, prepsUsing, remedyList, search,
  sortFoods, spectrum, systemHeat,
} from "./data.js";
import { favorites, misses, recent, triggers } from "./store.js";
import {
  art, artGlyph, chip, commonnessLabel, conflictBanner, esc, flags, macroRings, mechLabel,
  miniTile, prepFacts, prepTile, provenance, sighiBadge, sighiText, thermalScale, tileList,
} from "./components.js";

const backBar = (label, href) =>
  `<button class="linkish" data-nav="${href}">← ${esc(label)}</button>`;

/**
 * Dead ends used to render as a bare "Unknown food." — no heading, no controls,
 * no explanation. That is reachable in normal use: this ships as an installed
 * PWA, so people keep old links on home screens, and entries do get renamed or
 * merged (zobo folded into bissap, lahm-bi-ajeen into lahmacun). Anyone holding
 * those URLs deserves to know what happened and be handed a way onward.
 */
export function notFound(thing) {
  return {
    html: `
      ${backBar("Find", "/find")}
      <section class="hero"><h1>Not found</h1>
        <p>That ${esc(thing)} isn't here. It may have been renamed, or merged into another entry.</p>
      </section>
      <div class="empty">
        <p><strong>Nothing at this address.</strong></p>
        <p class="tiny" style="margin-top:6px">Entries are occasionally merged when two names turn out to mean the same food.</p>
      </div>
      <div class="chiprow" style="margin-top:14px">
        <button class="pillbtn" data-nav="/find?focus=1">Search all ${META.count} foods</button>
        <button class="pillbtn" data-nav="/">Home</button>
      </div>`,
  };
}

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

// SPIKE: async — the food card is the one view actually converted to fetch its
// full record on demand (assets/data/detail/<id>.json) instead of reading it
// out of a synchronously-imported full dataset. See app.js's render() for how
// the router deals with a view that's a promise.
export async function foodView(id) {
  const food = await getFoodDetail(id);
  if (!food) return notFound("food");
  recent.push(food.id);

  const isFav = favorites.has(food.id);
  const isTrig = triggers.has(food.id);
  const ingredients = getFoods(food.ingredients ?? []);
  const usedIn = prepsUsing(food.id);
  // Reads from the derived verdicts, not the raw hand tag, so the card and the
  // remedy list can never disagree about the same food.
  const remedy = Object.entries(food.remedies)
    .filter(([, verdict]) => verdict)
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

      ${
        food.guna
          ? `<div class="panel guna__row t-${GUNAS[food.guna.verdict].tone}">
               <div class="guna__row-main">
                 <span class="guna__glyph">${GUNAS[food.guna.verdict].glyph}</span>
                 <span>
                   <span class="guna__label">${esc(GUNAS[food.guna.verdict].label)}</span>
                   <span class="guna__sub">${esc(GUNAS[food.guna.verdict].oneLine)}</span>
                 </span>
                 <button class="linkish" data-nav="/guna">What this means</button>
               </div>
               ${food.guna.note ? `<p class="guna__note">${esc(food.guna.note)}</p>` : ""}
               ${food.guna.confidence === "contested" ? `<p class="guna__note guna__note--soft">The sources differ on this one.</p>` : ""}
             </div>`
          : ""
      }

      ${
        food.effects?.length
          ? `<div class="panel">
               <h3>Documented effects</h3>
               <p class="tiny muted">Traditionally or anecdotally reported for this food specifically — individual response varies. Open one for the full note, including any dose or safety caveat.</p>
               ${food.effects.map(e => `
                 <details class="expander" style="margin-top:14px">
                   <summary>
                     <span class="cmpd__pill">${EFFECTS[e.effect]?.glyph ?? "•"} ${esc(EFFECTS[e.effect]?.label ?? e.effect)}</span>
                     <span class="note__conf ${e.confidence === "contested" ? "note__conf--contested" : ""}"
                           title="${esc(CONF_TITLE[e.confidence])}">${e.confidence}</span>
                   </summary>
                   <p class="cmpd__what">${esc(e.note)}</p>
                 </details>`).join("")}
             </div>`
          : ""
      }

      <div class="panel">${sighiBadge(food)}${provenance(food)}</div>

      ${
        food.stimulant
          ? `<div class="panel">
               <h3>What's in the cup</h3>
               <p class="cmpd__list">${
                 food.stimulant.compounds.length
                   ? food.stimulant.compounds.map(c => `<span class="cmpd__pill">${COMPOUNDS[c].glyph} ${esc(COMPOUNDS[c].label)}</span>`).join("")
                   : `<span class="cmpd__pill cmpd__pill--none">No meaningful stimulant</span>`
               }</p>
               <p class="cmpd__what">${esc(food.stimulant.note)}</p>
               <button class="linkish" data-nav="/caffeine">How these four differ →</button>
             </div>`
          : ""
      }

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

      <!-- The reverse of the chip row above, and the only route out of a food
           card that leads to doing something with the food rather than to
           another food. -->
      ${
        usedIn.length
          ? `<div class="panel">
               <h3>Used in</h3>
               <div class="tiles" style="margin-top:10px">${usedIn.map(prepTile).join("")}</div>
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
    // The reactive icon on purpose: histamine is the calm axis, and these three
    // pages are that axis explained rather than scored.
    { to: "/mechanism", icon: "state-reactive", label: "Histamine mechanisms", sub: "Why a food reacts, not just how much" },
    { to: "/effect", icon: "category-spices", label: "Documented effects", sub: `${effectsCount()} foods with a sleep, focus, mood or other reported effect` },
    { to: "/bloating", icon: "category-vegetables", label: "Why food bloats", sub: "Four mechanisms, and what they cannot tell you" },
    { to: "/caffeine", icon: "category-drinks", label: "The caffeine family", sub: "Why tea and coffee don't feel alike" },
    { to: "/guna", icon: "browse-spectrum", label: "Light, restless, heavy", sub: "Ayurveda's other axis — what food does to your head" },
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

// ---- Guna -------------------------------------------------------------------

/**
 * Owner brief, verbatim: "it needs to be very easy to understand." So the
 * English name is the heading and the Sanskrit is a footnote, every section
 * answers "is this good or bad" before it explains anything, and the sentence
 * that does the most work — condition beats ingredient — gets its own panel
 * rather than being buried in a paragraph.
 */
export function gunaView() {
  return {
    tone: null,
    html: `
      ${backBar("Find", "/find")}
      <section class="hero">
        <h1>Light, restless, heavy</h1>
        <p>Ayurveda sorts food a second way, and this one is about your head rather than your temperature.</p>
      </section>

      <div class="panel">
        <p class="mech__body">Everywhere else in this app, Ayurveda is telling you whether a food
        warms you or cools you. It has a second answer too: does this food leave you clear, wind
        you up, or weigh you down?</p>
      </div>

      <!-- The one sentence worth remembering. It earns a panel of its own. -->
      <div class="mech__verdict">It matters less what the food is than what state it's in. Fresh
      dal is light. The same dal reheated tomorrow is heavy. That's the whole idea.</div>

      ${GUNA_IDS.map(id => {
        const g = GUNAS[id];
        const list = foodsWithGuna(id);
        return `
          <section class="section">
            <div class="section__head">
              <h2 class="guna__title t-${g.tone}">${g.glyph} ${esc(g.label)}</h2>
              <span class="tiny muted">${list.length}</span>
            </div>
            <p class="guna__one">${esc(g.oneLine)}</p>
            <div class="panel">
              <p class="guna__verdict">${esc(g.verdict)}</p>
              <p class="cmpd__what">${esc(g.what)}</p>
              <p class="guna__sanskrit">Called <em>${esc(g.sanskrit)}</em> in the sources.</p>
              <div class="chips" style="margin-top:14px">${list.slice(0, 18).map(chip).join("")}</div>
              ${list.length > 18 ? `<p class="tiny muted" style="margin-top:10px">…and ${list.length - 18} more.</p>` : ""}
            </div>
          </section>`;
      }).join("")}

      <div class="panel">
        <h3>The rule that does most of the work</h3>
        <p class="mech__body" style="margin-top:8px">Almost anything becomes heavy if it is old,
        reheated, deep-fried, or simply too much. That is why the tradition is so particular about
        eating food the day it is cooked, and why the same plate can read light at lunch and heavy
        as leftovers. You do not need to memorise a list to use this — you need to notice how long
        the food has been sitting.</p>
      </div>

      <!-- An overlap, observed. Not a derivation: nothing here computes one
           system's verdict from the other's, which the spec refuses outright. -->
      <div class="panel">
        <h3>Two traditions, one shelf</h3>
        <p class="mech__body" style="margin-top:8px">The foods Ayurveda calls heavy are largely the
        ones SIGHI marks
        <button class="linkish linkish--inline" data-nav="/mechanism/high-histamine">high in histamine</button>:
        aged, cured, fermented, or left standing. Two systems from opposite ends of the world,
        centuries apart, pointing at the same shelf of the fridge and describing the same feeling
        afterwards.</p>
        <p class="mech__body mech__body--lead">They are not the same claim and neither is computed
        from the other. It is just striking that they agree.</p>
      </div>

      <p class="tiny muted" style="margin:0 2px">${gunaCount()} of the everyday foods carry a reading.
      Guna is described in the sources by quality and condition far more than by lists, so the long
      tail is deliberately left unmarked rather than guessed at. Traditional classification, not
      medical advice.</p>`,
  };
}

// ---- Caffeine ---------------------------------------------------------------

/**
 * Every caffeinated drink in the library, grouped by which stimulant molecules
 * it carries rather than by how much.
 *
 * Dose is the obvious axis and the wrong one: a cup of coffee and a cup of tea
 * can carry the same caffeine and feel nothing alike, because the tea also
 * carries theanine. Grouping by compound puts that difference where the reader
 * meets it, and it is the same chemistry the histamine layer already turns on —
 * theobromine is SIGHI's named DAO inhibitor, and the tea plant's catechins are
 * why every tea here is tagged a DAO blocker while coffee is not.
 */
export function caffeineView() {
  const families = stimulantFamilies();
  return {
    tone: null,
    html: `
      ${backBar("Find", "/find")}
      <section class="hero">
        <h1>The caffeine family</h1>
        <p>Same molecule in most of these. They still don't feel alike — and the reason is what else is in the cup.</p>
      </section>

      <div class="panel">
        <p class="mech__body">Dose is the obvious way to compare a coffee with a tea, and it is
        the wrong one. A cup of each can carry similar caffeine and land completely differently,
        because caffeine is rarely travelling alone.</p>
        <p class="mech__body mech__body--lead">So this page groups by what is in the cup, not by
        how strong it is. Nothing here quotes a milligram figure: that number swings with the
        grind, the steep and the size of your cup far more than with what you ordered.</p>
      </div>

      <section class="section">
        <div class="section__head"><h2>The four molecules</h2></div>
        ${Object.entries(COMPOUNDS).map(([id, c]) => `
          <div class="panel cmpd">
            <h3><span class="cmpd__glyph">${c.glyph}</span> ${esc(c.label)}</h3>
            <p class="cmpd__what">${esc(c.what)}</p>
            <p class="cmpd__feel"><strong>How it lands.</strong> ${esc(c.feel)}</p>
            <p class="cmpd__catch"><strong>Worth knowing.</strong> ${esc(c.catch)}</p>
          </div>`).join("")}
      </section>

      <section class="section">
        <div class="section__head"><h2>What's in what</h2><span class="tiny muted">${families.reduce((n, f) => n + f.list.length, 0)}</span></div>
        ${families.map(fam => `
          <div class="panel">
            <h3>${fam.compounds.length ? fam.compounds.map(c => `${COMPOUNDS[c].glyph} ${esc(COMPOUNDS[c].label)}`).join(" + ") : "Decaffeinated"}</h3>
            <div class="chips" style="margin-top:12px">${fam.list.map(chip).join("")}</div>
          </div>`).join("")}
      </section>

      <!-- The join between this page and the histamine layer, which is the part
           no other reference puts in one place. -->
      <div class="panel">
        <h3>The same chemistry runs both ways</h3>
        <p class="mech__body" style="margin-top:8px">Theobromine is the compound SIGHI names as
        inhibiting DAO — so the mildest stimulant on this page is the one with the clearest effect
        on how you clear histamine. And the tea plant's catechins are why every tea here carries a
        <button class="linkish linkish--inline" data-nav="/mechanism/dao-blocker">DAO blocker</button>
        tag while coffee, for all its caffeine, does not.</p>
        <p class="mech__body mech__body--lead">Which is the answer to a question that sounds like two:
        why one caffeinated drink leaves you sharp and another leaves you foggy is often the same
        chemistry as why one bothers you and another doesn't.</p>
      </div>

      <p class="tiny muted" style="margin:0 2px">How fast you clear caffeine varies severalfold
      between people, and tolerance shifts it again. General information, not medical advice.</p>`,
  };
}

// ---- Bloating ---------------------------------------------------------------

/**
 * Neutral tone throughout: this sits off both of the app's axes — it is neither
 * a temperature nor a histamine reading — and colouring it as either would be a
 * lie the palette tells before the copy gets a chance to speak.
 */
export function bloatingView() {
  return {
    tone: null,
    html: `
      ${backBar("Find", "/find")}
      <section class="hero">
        <h1>Why food bloats</h1>
        <p>Four mechanisms, and the honest limits of a list.</p>
      </section>

      <div class="panel">
        <p class="mech__body">Most bloating is gas, and most of that gas is made by your own gut
        bacteria fermenting carbohydrate your small intestine did not absorb. Which carbohydrate,
        and how much of it you can take before it shows, is where people differ enormously.</p>
        <p class="mech__body mech__body--lead">Dose decides. So does your own gut. Nothing on this
        page is a verdict on a food — these are the usual suspects, not a list of things to avoid.</p>
      </div>

      ${BLOATING.map(sec => `
        <section class="section">
          <div class="section__head"><h2>${esc(sec.title)}</h2></div>
          <p class="tiny muted" style="margin:-4px 2px 14px">${esc(sec.lede)}</p>
          ${sec.groups.map(g => `
            <div class="panel bloat__group">
              <h3>${esc(g.label)}</h3>
              <p class="bloat__why">${esc(g.why)}</p>
              <div class="chips">${getFoods(g.ids.split(" ")).map(chip).join("")}</div>
            </div>`).join("")}
        </section>`).join("")}

      <!-- The point of the page. FODMAP's whole clinical method is elimination
           then structured reintroduction, precisely because no list can answer
           the individual question. Saying so is more useful than a verdict. -->
      <div class="panel">
        <h3>What this page can't tell you</h3>
        <p class="mech__body" style="margin-top:8px">Which of these is yours. Tolerance is individual
        and dose-dependent, and the clinical approach reflects that: remove the lot for a few weeks,
        then bring them back one group at a time and watch what happens. That is the low-FODMAP
        method, and it exists in that shape because reading a list does not work.</p>
        <p class="mech__body mech__body--lead">Which also means a food appearing above is not a
        reason to drop it. It is a reason to test it.</p>
      </div>

      <p class="tiny muted" style="margin:0 2px">General nutrition information, not medical advice.
      Persistent bloating, or bloating with weight loss, bleeding or pain, deserves a doctor rather
      than a food list.</p>`,
  };
}

// ---- Histamine mechanisms -------------------------------------------------

/**
 * The index. Three cards, because the mechanisms are peers — none of them is
 * the "main" one, and ranking them by how many foods carry the tag would imply
 * a severity order that SIGHI does not claim.
 */
export function mechanismIndexView() {
  return {
    tone: "calm",
    html: `
      ${backBar("Find", "/find")}
      <section class="hero t-calm">
        <h1>Histamine mechanisms</h1>
        <p>A score tells you how bad a food is. These tell you why — four different
        routes to the same trouble.</p>
      </section>
      <!-- Asked directly and answered directly: a reader who cannot tell whether
           a page is warning them or reassuring them has learnt nothing. -->
      <div class="mech__verdict">None of these is a good thing. They are four
      reasons a food can cause a problem, not four grades of safety.</div>
      <div class="stack">
        ${MECHANISM_IDS.map(id => {
          const m = MECHANISMS[id];
          return `<button class="listcard t-calm" data-nav="/mechanism/${id}">
                    <span class="listcard__title">${m.glyph} ${esc(m.label)}</span>
                    <span class="listcard__blurb">${esc(m.lede)}</span>
                    <span class="listcard__count">${foodsWithMechanism(id).length} foods</span>
                  </button>`;
        }).join("")}
      </div>
      <!-- The legend ends on a tag name with no full stop, so it needs one. -->
      <p class="tiny muted" style="margin:16px 2px 0">${esc(SOURCES.legend.histamine)}.
      Informational, not medical advice.</p>`,
  };
}

export function mechanismView(id, { sort = "staples" } = {}) {
  const m = getMechanism(id);
  if (!m) return notFound("mechanism");
  if (!(sort in SORTS)) sort = "staples";
  const all = foodsWithMechanism(id);
  // Foods that carry the mechanism while scoring low. For a DAO blocker that
  // set is the entire point of the page — black tea and masala chai read as
  // "1 — Usually fine" and still lower the ceiling for everything after them.
  const missable = m.missable ? sortFoods(all.filter(f => f.histamine.sighi <= 1), "staples") : [];

  return {
    tone: "calm",
    html: `
      ${backBar("Mechanisms", "/mechanism")}
      <section class="hero t-calm">
        <h1>${esc(m.label)}</h1>
        <p>${esc(m.lede)}</p>
      </section>

      <div class="mech__verdict">${esc(m.verdict)}</div>

      <div class="panel">
        <p class="mech__body">${esc(m.body)}</p>
        <p class="mech__body mech__body--lead">${esc(m.implication)}</p>
      </div>

      ${
        missable.length > 1
          ? `<section class="section">
               <div class="section__head"><h2>${esc(m.missable)}</h2><span class="tiny muted">${missable.length}</span></div>
               <p class="tiny muted" style="margin-bottom:12px">${esc(m.missableNote)}</p>
               ${tileList(missable, { metaFn: SIGHI_META, meter: "histamine" })}
             </section>`
          : ""
      }

      <section class="section">
        <div class="section__head">
          <h2>Every food on this list</h2>
          <span class="tiny muted">${all.length}</span>
        </div>
        ${sortSelect(sort, ["staples", "gentlest", "az", "hottest", "coolest"], "mechsort")}
        <div id="mechbody" style="margin-top:12px">
          ${tileList(sortFoods(all, sort), { metaFn: SIGHI_META, meter: "histamine" })}
        </div>
      </section>

      <!-- The safety framing lives here instead of inside every sentence. It
           used to be hedged into the prose, which made the prose unreadable
           without making it any safer. -->
      <p class="tiny muted" style="margin:0 2px">This is what the SIGHI list flags,
      not a prediction about you — people react to very different things. Informational,
      not medical advice.</p>`,

    mount(root) {
      const sel = root.querySelector("#mechsort");
      sel.addEventListener("change", () => {
        root.querySelector("#mechbody").innerHTML =
          tileList(sortFoods(all, sel.value), { metaFn: SIGHI_META, meter: "histamine" });
        history.replaceState(null, "", `#/mechanism/${id}?sort=${sel.value}`);
      });
    },
  };
}

// ---- Documented effects -----------------------------------------------------

/**
 * The index: every effect tag actually carried by a food, ranked by how many
 * foods carry it. Neutral tone throughout — this sits off both of the app's
 * axes (it's neither a temperature nor a histamine reading, same reasoning as
 * guna above), and colouring it as either would misrepresent what it is.
 */
export function effectIndexView() {
  return {
    tone: null,
    html: `
      ${backBar("Find", "/find")}
      <section class="hero">
        <h1>Documented effects</h1>
        <p>Traditional or anecdotal reports for specific foods — sleep, focus, mood, digestion and
        more. Individual response varies, and every entry says how confident the evidence is.</p>
      </section>
      <div class="stack">
        ${EFFECT_IDS.map(id => {
          const e = EFFECTS[id] ?? { label: id, glyph: "•" };
          return `<button class="listcard t-neutral" data-nav="/effect/${id}">
                    <span class="listcard__title">${e.glyph} ${esc(e.label)}</span>
                    <span class="listcard__count">${foodsWithEffect(id).length} foods</span>
                  </button>`;
        }).join("")}
      </div>
      <p class="tiny muted" style="margin:16px 2px 0">Traditional, anecdotal or early-research
      reports, food by food — never a personalised or predictive claim. Open a food to see the
      confidence and any dose or safety note behind its entry. Informational, not medical advice.</p>`,
  };
}

export function effectView(id, { sort = "staples" } = {}) {
  const e = EFFECTS[id];
  if (!e) return notFound("effect");
  if (!(sort in SORTS)) sort = "staples";
  const all = foodsWithEffect(id);
  if (!all.length) return notFound("effect");
  // A few labels carry a clarifying suffix after an em dash (carminative,
  // satiety, analgesic) for the pill and the h1 — too much for a sentence.
  const short = e.label.split(" — ")[0].toLowerCase();
  // Confidence is right here in the sub-line, not just on the food card — the
  // same reason SIGHI_META puts the SIGHI score in the mechanism list rather
  // than making a reader open every food to find out how solid the claim is.
  const metaFn = food => {
    const entry = getEffectEntry(food, id);
    return `${entry.confidence} confidence${entry.confidence === "contested" ? " — sources disagree" : ""}`;
  };

  return {
    tone: null,
    html: `
      ${backBar("Documented effects", "/effect")}
      <section class="hero">
        <h1>${e.glyph} ${esc(e.label)}</h1>
        <p>Foods with a documented or anecdotal ${esc(short)} report. Individual
        response varies — open a food for the full note and its confidence.</p>
      </section>

      <section class="section">
        <div class="section__head">
          <h2>Every food with this tag</h2>
          <span class="tiny muted">${all.length}</span>
        </div>
        ${sortSelect(sort, ["staples", "gentlest", "az", "hottest", "coolest"], "effectsort")}
        <div id="effectbody" style="margin-top:12px">
          ${tileList(sortFoods(all, sort), { metaFn })}
        </div>
      </section>

      <p class="tiny muted" style="margin:0 2px">Not a ranking of which food works best — these are
      the foods with a documented report, nothing more. Informational, not medical advice.</p>`,

    mount(root) {
      const sel = root.querySelector("#effectsort");
      sel.addEventListener("change", () => {
        root.querySelector("#effectbody").innerHTML =
          tileList(sortFoods(all, sel.value), { metaFn });
        history.replaceState(null, "", `#/effect/${id}?sort=${sel.value}`);
      });
    },
  };
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
        <p class="tiny muted" style="margin-bottom:12px">Two to four steps, not recipes. Each one links to the foods in it.</p>
        <!-- Grouped rather than one flat grid: at ten a flat list was fine, at
             forty-four it is a wall, and the only division a reader actually
             wants here is the one the whole app is organised by. -->
        ${Object.keys(STATES)
          .map(id => {
            const list = prepsForState(id);
            return `
              <div class="section__head" style="margin-top:20px">
                <h3 class="band">${esc(STATES[id].effect)}</h3>
                <span class="tiny muted">${list.length}</span>
              </div>
              <div class="tiles">${list.map(p => prepTile(p, { effect: false })).join("")}</div>`;
          })
          .join("")}
      </section>`,
  };
}

export function listView(id) {
  const list = getList(id);
  if (!list) return notFound("list");
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
  if (!prep) return notFound("preparation");
  const tone = STATES[prep.state].tone;
  const ingredients = getFoods(prep.ingredients);
  // The reader's own triggers outrank anything a preparation recommends, so
  // they are called out at the top rather than left as a ring on a chip
  // halfway down — this is the one place the app is telling you to go and eat
  // something, and it should not have to be proof-read for your own list.
  const flagged = ingredients.filter(f => triggers.has(f.id));
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
          <p class="prep__facts">${prepFacts(prep)}</p>
        </div>
      </div>

      ${
        flagged.length
          ? `<div class="prep__warn">⚠ Contains ${flagged.map(f => esc(f.name)).join(", ")}, on your trigger list.</div>`
          : ""
      }

      <div class="panel">
        <h3>What goes in</h3>
        <div class="chips" style="margin-top:10px">${ingredients.map(chip).join("")}</div>
      </div>

      <div class="panel t-${tone}">
        <h3>How</h3>
        <ol class="steps">${prep.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ol>
        ${prep.swap ? `<p class="prep__swap"><b>Swap</b> ${esc(prep.swap)}</p>` : ""}
      </div>

      <!-- The reason this lane exists rather than a link to a recipe site: it
           says which tradition is doing the work, in the same register the
           food cards use. Never "this will cool you". -->
      <div class="panel">
        <h3>Why it's on this list</h3>
        <p class="prep__why">${esc(prep.why)}</p>
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
  if (!cat) return notFound("category");
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

  // The overview previews each band; the band view lists it in full.
  //
  // Rendering all 2,000 here used to lock the tab. A horizontal .rail has to lay
  // out every child to know its scroll width, so nothing is ever "below the
  // fold" and loading="lazy" buys nothing — 2,000 minitiles measured ~1s of
  // blocking layout off-screen and hung the renderer on-screen. A vertical
  // tileList has no such problem (970 rows render in ~2ms), so the full band
  // uses that instead of a rail.
  const PREVIEW = 18;
  const groups = active
    ? `<section class="section">
         <div class="section__head"><h2 class="band">${esc(active.label)}</h2><span class="tiny muted">${esc(active.blurb)}</span></div>
         <p class="tiny muted" style="margin:0 2px 10px">${shown.length} foods, coldest to hottest.</p>
         ${tileList(shown)}
       </section>`
    : BANDS.map(b => {
        const items = all.filter(f => f.heatClass === b.id);
        if (!items.length) return "";
        const more = items.length - PREVIEW;
        return `<section class="section">
                  <div class="section__head">
                    <h2 class="band">${esc(b.label)}</h2>
                    <span class="tiny muted">${esc(b.blurb)}</span>
                  </div>
                  <div class="rail">${items.slice(0, PREVIEW).map(miniTile).join("")}</div>
                  ${
                    more > 0
                      ? `<button class="linkish" data-nav="/spectrum?band=${b.id}">See all ${items.length} ${esc(b.label.toLowerCase())} foods →</button>`
                      : ""
                  }
                </section>`;
      }).join("");

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

/**
 * The remedy screen used to hand you six hundred cooling foods and stop there —
 * a correct answer to "what may I eat" and no answer at all to "what do I make".
 * The preparations existed the whole time, three taps away behind Find →
 * Curated lists, which is to say invisible from the one screen this app is
 * built around. Four of them, fastest first, on the Eat tab only: making
 * something is an eat action, and offering it beside "Avoid" would read as a
 * recommendation to cook the thing you were just told to skip.
 */
function makeSomething(stateId) {
  const preps = prepsForState(stateId);
  if (!preps.length) return "";
  const shown = preps.slice(0, 4);
  return `
    <section class="section">
      <div class="section__head">
        <h2>Or make something</h2>
        ${preps.length > shown.length ? `<button class="linkish" data-nav="/lists">All ${preps.length}</button>` : ""}
      </div>
      <div class="tiles">${shown.map(prepTile).join("")}</div>
    </section>`;
}

export function stateView(stateId, { list = "eat", q = "", sort = "" } = {}) {
  const state = STATES[stateId];
  if (!state) return notFound("state");
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

      ${verdict === "eat" ? makeSomething(stateId) : ""}

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
