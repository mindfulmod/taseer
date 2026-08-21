// Dataset access layer: derived fields, search, remedy lists.
// The bundled module is a faithful mirror of data/foods/*.json — everything
// interpretive is computed here so the source data stays hand-editable.
import { FOODS, META, PREPARATIONS, SOURCES } from "../data/foods.js";

export { META, SOURCES };

// Per-system heat, normalised to a -1..1 scale. Ayurveda is a binary virya so it
// carries a smaller magnitude than the granular five-nature TCM scale — otherwise
// it would drag every food to an extreme.
const HEAT = {
  tcm: { cold: -1, cool: -0.5, neutral: 0, warm: 0.5, hot: 1 },
  ayurveda: { cooling: -0.7, heating: 0.7 },
  unani: { cold: -1, "cold-dry": -1, "cold-moist": -1, neutral: 0, hot: 1, "hot-dry": 1, "hot-moist": 1 },
};
const SYSTEMS = ["tcm", "ayurveda", "unani"];
export const SYSTEM_LABELS = { tcm: "TCM", ayurveda: "Ayurveda", unani: "Unani" };

/** Composite warmth in -1..1. Decorative + ordering only — never shown as a verdict. */
function compositeHeat(food) {
  const sum = SYSTEMS.reduce((n, sys) => n + (HEAT[sys][food.thermal[sys].verdict] ?? 0), 0);
  return Math.max(-1, Math.min(1, sum / 3 / 0.9));
}

// Thresholds sit on natural breaks in the dataset's distribution: the extremes are
// reserved for foods all three traditions agree on, so a lone dissenting tradition
// pulls a food into cool/warm rather than leaving it at cold/hot.
export function heatClass(heat) {
  if (heat <= -0.7) return "cold";
  if (heat <= -0.2) return "cool";
  if (heat < 0.2) return "neutral";
  if (heat < 0.7) return "warm";
  return "hot";
}

/** Per-system heat in -1..1, for placing the dot on a badge's gradient track. */
export function systemHeat(food, sys) {
  return HEAT[sys][food.thermal[sys].verdict] ?? 0;
}

/** True when traditions point in opposite directions (one warms, another cools). */
function hasConflict(food) {
  const dirs = SYSTEMS.map(s => Math.sign(systemHeat(food, s))).filter(Boolean);
  return new Set(dirs).size > 1;
}

const TAG_MARK = { "high-histamine": "H", liberator: "L", "other-amines": "A", "dao-blocker": "B" };

/**
 * How this food's histamine reading stands against the source the app cites.
 *
 * The thermal layer has carried `confidence` and `source` per tradition since
 * the beginning, which is why it can show a contested reading honestly and make
 * a feature of disagreement. The histamine layer had neither, so it cited SIGHI
 * and silently differed from it on 116 of the 187 foods SIGHI lists — including
 * the coffee mechanism that went to production wrong on 2026-08-17.
 *
 *   verified   SIGHI lists it and we agree on score and markers
 *   reasoned   SIGHI lists it, we differ, and the record says why
 *   unreviewed SIGHI lists it, we differ, and nobody has adjudicated it
 *   derived    SIGHI does not list it — most dishes and world foods
 */
function sourceState(food) {
  const { ref, sighi, tags, why } = food.histamine;
  if (!ref) return "derived";
  const mine = tags.map(t => TAG_MARK[t]).sort().join("");
  const theirs = [...ref.marks].sort().join("");
  if (sighi === ref.sighi && mine === theirs) return "verified";
  return why ? "reasoned" : "unreviewed";
}

/**
 * Reactive-day verdict, computed (never hand-curated) per data/README.md:
 * eat = SIGHI 0 and not a liberator; avoid = SIGHI >= 2, or liberator/DAO-blocker.
 */
function reactiveVerdict(food) {
  const { sighi, tags } = food.histamine;
  if (sighi >= 2 || tags.includes("liberator") || tags.includes("dao-blocker")) return "avoid";
  if (sighi === 0) return "eat";
  return null;
}

/**
 * Thermal remedy verdict \u2014 derived from the band, exactly as `reactive` is
 * derived from SIGHI, with any hand-written `remedy` winning outright.
 *
 * It used to be hand-only, and 22% of the strongly hot or cold foods simply
 * had no tag: nobody had written one, so they were invisible in the one screen
 * the app exists for. Deriving closes that by construction, and new data needs
 * no tagging pass to show up. The hand tags were already agreeing with the
 * bands \u2014 of 1,206 of them only 4 disagreed, all neutral-band foods where the
 * traditions genuinely split, which is precisely when an override earns its
 * place, so those keep winning.
 *
 * `eat` is generous and `avoid` is not, on purpose. "What can I have" wants
 * every cooling thing in the library; "what is working against me" wants the
 * foods that actually pull hard in the wrong direction, so it takes only the
 * far band and leaves the merely-warm out of it.
 */
function thermalRemedy(food, state, cls) {
  const hand = food.remedy?.[state];
  if (hand) return hand;
  if (state === "too-hot") return cls === "cold" || cls === "cool" ? "eat" : cls === "hot" ? "avoid" : null;
  return cls === "hot" || cls === "warm" ? "eat" : cls === "cold" ? "avoid" : null;
}

export const norm = s =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// ---- Index -----------------------------------------------------------------

export const foods = FOODS.map(food => {
  const heat = compositeHeat(food);
  const cls = heatClass(heat);
  const names = [food.name, ...food.aliases];
  return {
    ...food,
    heat,
    heatClass: cls,
    conflict: hasConflict(food),
    contested: SYSTEMS.some(s => food.thermal[s].confidence === "contested"),
    reactive: reactiveVerdict(food),
    sourceState: sourceState(food),
    remedies: {
      "too-hot": thermalRemedy(food, "too-hot", cls),
      "too-cold": thermalRemedy(food, "too-cold", cls),
    },
    _names: names.map(norm),
    _desc: norm(food.description),
  };
});

const byId = new Map(foods.map(f => [f.id, f]));
export const getFood = id => byId.get(id);
export const getFoods = ids => ids.map(getFood).filter(Boolean);

export const CATEGORIES = [
  { id: "fruit", label: "Fruits", emoji: "🍎" },
  { id: "vegetable", label: "Vegetables", emoji: "🥬" },
  { id: "grain", label: "Grains", emoji: "🌾" },
  { id: "spice", label: "Spices", emoji: "🌶️" },
  { id: "protein", label: "Proteins", emoji: "🍗" },
  { id: "dairy", label: "Dairy", emoji: "🧀" },
  { id: "drink", label: "Drinks", emoji: "🍵" },
  { id: "dish", label: "Dishes", emoji: "🍛" },
];

export const CUISINES = [
  { id: "south-asian", label: "South Asian" },
  { id: "arabic", label: "Arabic" },
  { id: "chinese", label: "Chinese" },
  { id: "western", label: "Western" },
  // Widened beyond the original four in batch 5. Grouped rather than split by
  // country: one entry per country would fragment the label on a food card
  // without telling the reader anything more useful.
  { id: "japanese", label: "Japanese" },
  { id: "korean", label: "Korean" },
  { id: "southeast-asian", label: "Southeast Asian" },
  { id: "latin-american", label: "Latin American" },
  { id: "persian-turkish", label: "Persian & Turkish" },
  { id: "african", label: "African" },
  { id: "eastern-european", label: "Eastern European" },
];

export const byCategory = cat => foods.filter(f => f.category === cat);

// ---- Search ----------------------------------------------------------------

// Lower tier = better match. Name beats alias; whole-string beats word-start
// beats substring; description is the last resort.
function tier(food, q) {
  const [name, ...aliases] = food._names;
  const starts = s => s.startsWith(q);
  const wordStart = s => s === q || s.startsWith(q) || s.includes(` ${q}`);
  if (name === q) return 0;
  if (aliases.includes(q)) return 1;
  if (starts(name)) return 2;
  if (aliases.some(starts)) return 3;
  if (wordStart(name)) return 4;
  if (aliases.some(wordStart)) return 5;
  if (name.includes(q)) return 6;
  if (aliases.some(a => a.includes(q))) return 7;
  if (food._desc.includes(q)) return 8;
  return Infinity;
}

/**
 * `pool` narrows the haystack — the category screen passes its own foods so a
 * search inside Dishes cannot surface a spice. Ranking is identical either way.
 */
export function search(query, limit = 80, pool = foods) {
  const q = norm(query);
  if (!q) return [];
  const hits = [];
  for (const food of pool) {
    const t = tier(food, q);
    if (t !== Infinity) hits.push({ food, t });
  }
  hits.sort((a, b) => a.t - b.t || a.food.commonness - b.food.commonness || a.food.name.localeCompare(b.food.name));
  return hits.slice(0, limit).map(h => h.food);
}

const bigrams = s => {
  const set = new Set();
  for (const word of s.split(" ")) for (let i = 0; i < word.length - 1; i++) set.add(word.slice(i, i + 2));
  return set;
};

/** Dice-coefficient "did you mean" for search misses — drives nearest-relative suggestions. */
export function fuzzySuggest(query, limit = 4) {
  const q = norm(query);
  if (q.length < 2) return [];
  const qb = bigrams(q);
  if (!qb.size) return [];
  const scored = foods
    .map(food => {
      let best = 0;
      for (const name of food._names) {
        const nb = bigrams(name);
        if (!nb.size) continue;
        let shared = 0;
        for (const g of qb) if (nb.has(g)) shared++;
        best = Math.max(best, (2 * shared) / (qb.size + nb.size));
      }
      return { food, score: best };
    })
    .filter(s => s.score >= 0.4);
  if (!scored.length) return [];
  // Only keep near-ties with the best match — otherwise a typo pulls in string
  // neighbours that mean nothing to a cook ("zucchinni" → dalchini → Cinnamon).
  const top = Math.max(...scored.map(s => s.score));
  return scored
    .filter(s => s.score >= top - 0.18)
    .sort((a, b) => b.score - a.score || a.food.commonness - b.food.commonness)
    .slice(0, limit)
    .map(s => s.food);
}

// ---- Remedy lists ----------------------------------------------------------

/**
 * Four pieces of copy per state, because each answers a different question and
 * swapping them is how this screen goes wrong:
 *
 *   label   THE PERSON, mid-sentence — "when you feel too hot".
 *   ask     THE PERSON, standing alone — a card title that must make sense with
 *           nothing above it, so it carries its own question mark.
 *   effect  WHAT A REMEDY DOES — the opposite of the complaint. A cooler is for
 *           when you feel too hot; tagging it "Too hot" reads as a hot drink.
 *   blurb   WHAT THE LIST HOLDS — names the foods, not the reader, and keeps the
 *           "traditionally" hedge the safety framing requires.
 *
 * Rule of thumb: text about the reader uses label/ask; anything attached to a
 * food or preparation uses effect/blurb.
 */
export const STATES = {
  "too-hot": {
    label: "Too hot",
    ask: "Too hot?",
    effect: "Cooling",
    blurb: "Foods traditionally used to cool down",
    emoji: "🔥",
    tone: "cold",
  },
  "too-cold": {
    label: "Too cold",
    ask: "Too cold?",
    effect: "Warming",
    blurb: "Foods traditionally used to warm up",
    emoji: "❄️",
    tone: "hot",
  },
  reactive: {
    label: "Reactive",
    ask: "Food reactions?",
    effect: "Low histamine",
    blurb: "Lowest-histamine foods first",
    emoji: "⚡",
    tone: "calm",
  },
};

/**
 * Foods to eat / avoid for a body state.
 * too-hot / too-cold come from curated `remedy` fields; reactive is computed.
 * Ranked by kitchen-commonness, with favourites floated to the top.
 */
export function remedyList(state, verdict, favorites = []) {
  const fav = new Set(favorites);
  const pick = state === "reactive" ? f => f.reactive : f => f.remedies[state];
  return foods
    .filter(f => pick(f) === verdict)
    .sort(
      (a, b) =>
        (fav.has(b.id) ? 1 : 0) - (fav.has(a.id) ? 1 : 0) ||
        a.commonness - b.commonness ||
        (verdict === "eat" ? a.heat - b.heat : b.heat - a.heat) * (state === "too-cold" ? -1 : 1) ||
        a.name.localeCompare(b.name),
    );
}

/** Coldest → hottest, for the spectrum explorer. */
export const spectrum = () => [...foods].sort((a, b) => a.heat - b.heat || a.name.localeCompare(b.name));

/**
 * Orderings offered wherever a list is long enough to need one.
 *
 * `heat` is the composite across all three traditions, the same number the
 * spectrum explorer ranks by — so "hottest first" here and the spectrum agree.
 * A thermal *filter* was considered and rejected (most cooked dishes read warm,
 * so filtering to "warm" barely shortens anything); ordering has no such
 * problem, because it moves the extremes to the top instead of partitioning.
 */
// Composite heat is an average of three verdicts drawn from small fixed sets,
// so it lands on very few distinct values — the "too hot / eat" list has 283
// foods across 8 of them, 66 tied at exactly -1. Breaking ties by name alone
// would open that list with 66 alphabetical entries and read as no sort at all,
// so every ranked order falls back to commonness first: among equally cold
// foods, the ones actually in a kitchen come up before the specialty shop.
const then = (a, b) => a.commonness - b.commonness || a.name.localeCompare(b.name);

export const SORTS = {
  staples: { label: "Everyday first", cmp: (a, b) => a.commonness - b.commonness || a.name.localeCompare(b.name) },
  hottest: { label: "Hottest first", band: "desc", cmp: (a, b) => b.heat - a.heat || then(a, b) },
  coolest: { label: "Coolest first", band: "asc", cmp: (a, b) => a.heat - b.heat || then(a, b) },
  gentlest: { label: "Lowest histamine", cmp: (a, b) => a.histamine.sighi - b.histamine.sighi || then(a, b) },
  az: { label: "A–Z", cmp: (a, b) => a.name.localeCompare(b.name) },
};

export const sortFoods = (list, sortId) =>
  [...list].sort((SORTS[sortId] ?? SORTS.staples).cmp);

export const BANDS = [
  { id: "cold", label: "Cold", blurb: "The deep coolers" },
  { id: "cool", label: "Cool", blurb: "Gently cooling" },
  { id: "neutral", label: "Neutral", blurb: "The traditions land near the middle" },
  { id: "warm", label: "Warm", blurb: "Gently warming" },
  { id: "hot", label: "Hot", blurb: "The real heaters" },
];

// ---- Histamine mechanisms --------------------------------------------------

/**
 * The three SIGHI mechanism tags, promoted from a label on a badge to something
 * the reader can actually open.
 *
 * They behave nothing alike — one delivers histamine, one triggers your own,
 * one blocks the enzyme that clears either — and the app rendered all three as
 * near-identical chips, which is the whole reason a DAO blocker scoring 1 read
 * as a mild entry. Copy stays in the traditional/reported register: what SIGHI
 * says the mechanism is, never what it will do to you.
 */
export const MECHANISMS = {
  liberator: {
    label: "Histamine liberators",
    short: "Liberator",
    glyph: "⚡",
    lede: "These foods don't contain much histamine. They make your body release the histamine it's already holding.",
    verdict: "Yes, these can set you off — and the food doesn't have to contain any histamine to do it.",
    body: "Your body keeps histamine in cells called mast cells. A liberator prompts those cells to let it go, so the histamine that hits you came from you, not off the plate. That means it makes no difference how fresh the food is or how well it was stored — it's the food itself doing it, not its condition.",
    implication: "This is why a bad day can follow a meal with nothing aged or fermented in it. Decaf coffee is the clearest case: take the caffeine out and it still does this.",
    missable: "Scores low, still a liberator",
    missableNote: "The score rates each food on its own, and these come out looking mild. They still do what this page describes.",
  },
  "high-histamine": {
    label: "High histamine",
    short: "High histamine",
    glyph: "●",
    lede: "The histamine is already in the food before you eat it.",
    verdict: "Yes, these can set you off. It's the most direct of the four — you're eating histamine.",
    body: "Bacteria make histamine as protein breaks down. So the amount goes up the longer a food sits, the warmer it's kept, and the more it's been aged, cured or fermented. This is the one where how you handle food matters as much as what you buy.",
    implication: "Fresh mozzarella and aged cheese come from the same milk, and one scores 0 while the other scores 3. It works the same way with fish, meat and last night's leftovers: how long it's been standing matters more than what it is.",
  },
  "other-amines": {
    label: "Other biogenic amines",
    short: "Other amines",
    glyph: "◆",
    lede: "Not histamine, but close relatives — tyramine, putrescine and phenylethylamine.",
    verdict: "Usually mild on their own. These add to the load rather than setting you off by themselves.",
    body: "These come from the same breakdown that makes histamine, and your body clears them with some of the same enzymes. So they queue for the same way out, and while they're using it, histamine leaves more slowly.",
    implication: "Most of these score low by themselves — banana is a 1, which means usually fine. They're on this page because they stack. One banana is not the same as a plate with three of these on it.",
    missable: "Scores low, still carries amines",
    missableNote: "The score only reports histamine, and these barely have any. The amines are a separate thing it isn't telling you about.",
  },
  "dao-blocker": {
    label: "DAO blockers",
    short: "DAO blocker",
    glyph: "⛔",
    lede: "These don't give you histamine. They stop you getting rid of it.",
    verdict: "Bad, and the easiest of the four to miss — nothing happens when you eat one, and the rest of the meal hits harder.",
    body: "DAO is the enzyme in your gut that breaks histamine down. These slow it. So a DAO blocker can do nothing to you on its own while making everything you eat around it worse than it would normally be.",
    implication: "Which is why one scoring 1 isn't the mild thing that score suggests. The score rates the food on its own. This mechanism is about everything else on the table.",
    missable: "Scores low, still blocks",
    missableNote: "Each of these is a 1 by itself. Every one of them lowers what you can handle from whatever comes next.",
  },
};


export const MECHANISM_IDS = Object.keys(MECHANISMS);

const byMechanism = new Map(MECHANISM_IDS.map(id => [id, []]));
for (const food of foods) for (const tag of food.histamine.tags) byMechanism.get(tag)?.push(food);

export const getMechanism = id => MECHANISMS[id];
export const foodsWithMechanism = id => byMechanism.get(id) ?? [];

// ---- Stimulants -------------------------------------------------------------

/**
 * What the four molecules actually do.
 *
 * The useful axis across caffeinated drinks is not dose — that swings an order
 * of magnitude with grind, steep and cup size — but which of these are present.
 * It is also the axis that connects to the histamine layer already built:
 * theobromine is the compound SIGHI names as inhibiting DAO, and the tea plant's
 * catechins are why every tea here carries a dao-blocker tag while coffee does
 * not. The same chemistry decides how a cup feels and what it does to clearance.
 */
export const COMPOUNDS = {
  caffeine: {
    label: "Caffeine",
    glyph: "◉",
    what: "Blocks adenosine, the molecule that accumulates through the day and makes you feel like sleeping. It does not add energy — it hides the signal that you are short of it.",
    feel: "Fast on, fast off. Peaks in about half an hour and is half gone in four to six, though that varies several-fold between people.",
    catch: "Tolerance builds within days. Much of the lift a regular drinker feels is climbing back out of their own withdrawal rather than gaining anything.",
  },
  theanine: {
    label: "L-theanine",
    glyph: "◍",
    what: "An amino acid found almost nowhere outside the tea plant. It crosses into the brain and is associated with a calmer, more settled kind of attention.",
    feel: "It does not stimulate. Paired with caffeine it takes the edge off — the same alertness with less of the jitter and less of the sharp drop.",
    catch: "This is why an equally caffeinated tea and coffee do not feel alike. It is the single biggest difference in this whole family.",
  },
  theobromine: {
    label: "Theobromine",
    glyph: "◎",
    what: "Cocoa's methylxanthine, and a much weaker stimulant than caffeine — mild, slow, and longer to clear.",
    feel: "Gentle and drawn out rather than sharp. It is why chocolate never feels like a coffee however much of it you eat.",
    catch: "It is also the compound SIGHI names as inhibiting DAO — so the mildest stimulant here is the one with the clearest effect on how you clear histamine.",
  },
  theophylline: {
    label: "Theophylline",
    glyph: "◌",
    what: "The third methylxanthine, present in small amounts in tea and mate. Stronger than theobromine, and used medically to open airways.",
    feel: "Too little in a normal cup to feel on its own. It contributes to mate's reputation for a steadier lift than coffee's.",
    catch: "Rarely the main event, but part of why mate sits apart from both coffee and tea.",
  },
};

/** Caffeinated entries, grouped by the profile they share. */
export const stimulantFamilies = () => {
  const key = f => f.stimulant.compounds.join("+") || "none";
  const map = new Map();
  for (const f of foods.filter(f => f.stimulant)) {
    if (!map.has(key(f))) map.set(key(f), []);
    map.get(key(f)).push(f);
  }
  return [...map.entries()]
    .map(([k, list]) => ({ compounds: k === "none" ? [] : k.split("+"), list: list.sort(byCommon) }))
    .sort((a, b) => b.list.length - a.list.length);
};

// ---- Bloating ---------------------------------------------------------------

/**
 * Why food bloats, grouped by mechanism.
 *
 * Deliberately NOT a fourth classification layer, and deliberately not tagged
 * per food. The clinical framework here is FODMAP, whose measured values are
 * Monash University's and are not ours to redistribute; more to the point,
 * FODMAP ratings are dose-defined — a quarter avocado is low and a whole one is
 * high — and this schema has one verdict per food and no concept of a portion.
 * Tagging foods would mean flattening a threshold into a verdict, which is the
 * false precision the product spec already declined once for dish verdicts.
 *
 * So this is a page about mechanisms, drawn from general nutrition knowledge,
 * pointing at foods the library already carries. It ends by saying it cannot
 * tell you which of these is yours, because that is true and because the
 * clinical method — remove, then reintroduce one group at a time — exists
 * precisely because no list can.
 */
export const BLOATING = [
  {
    id: "fermentable",
    title: "Fermentable carbohydrates",
    lede: "The big one. What your small intestine doesn't absorb, your gut bacteria ferment — and gas is the by-product.",
    groups: [
      { label: "Legumes", why: "Galacto-oligosaccharides. Soaking and long cooking reduce them; canned-and-rinsed is gentler than dried-and-boiled.",
        ids: "chickpeas kidney-beans black-beans toor-dal chana-dal urad-dal red-lentils mung-beans fava-beans black-eyed-peas" },
      { label: "Onion and garlic", why: "Fructans, and the reason so many people react to food they didn't cook themselves. Frying does not destroy them.",
        ids: "onion garlic leek shallots spring-onion garlic-powder onion-powder" },
      { label: "Wheat and rye", why: "Also fructans — which is why some people who feel better off bread are not reacting to gluten at all.",
        ids: "wheat roti naan white-bread pasta semolina bulgur couscous pita-bread" },
      { label: "Cruciferous vegetables", why: "Raffinose. The reputation is earned, though the dose it takes varies enormously.",
        ids: "cabbage cauliflower broccoli brussels-sprouts kale napa-cabbage bok-choy mustard-greens" },
      { label: "Fruit sugars", why: "Fructose in excess of glucose, which crosses the gut wall slowly.",
        ids: "apple mango honey watermelon pear dried-figs raisins" },
      { label: "Stone fruit", why: "Sorbitol, a polyol — the same class as the sweeteners below.",
        ids: "peach plum nectarine cherry apricot avocado" },
    ],
  },
  {
    id: "lactose",
    title: "Lactose",
    lede: "Milk sugar, undigested when you're short of lactase. Most of the world's adults are, to some degree.",
    groups: [
      { label: "Fresh dairy", why: "Lactose falls as dairy ages and ferments — bacteria eat it. So hard aged cheese is low in it, and fresh milk is not. Exactly the reverse of how histamine behaves.",
        ids: "milk ice-cream cream condensed-milk evaporated-milk milk-powder buffalo-milk khoya" },
    ],
  },
  {
    id: "polyols",
    title: "Sugar alcohols",
    lede: "Sorbitol, xylitol, mannitol, erythritol. Poorly absorbed by design — that's why they're low-calorie.",
    groups: [
      { label: "Where they hide", why: "Anything labelled sugar-free: gum, mints, protein bars, diet drinks, cough syrup. The library doesn't itemise them, so read the label.",
        ids: "protein-bar" },
    ],
  },
  {
    id: "gas",
    title: "Swallowed air",
    lede: "Not a food property at all, and often the actual answer.",
    groups: [
      { label: "Carbonation", why: "Fizzy drinks put gas in directly. Straws, chewing gum, eating fast and talking while eating all add more.",
        ids: "soda-water cola lemon-lime-soda beer tonic-water energy-drink" },
    ],
  },
];

// ---- Preparations & curated lists -----------------------------------------

export const preparations = PREPARATIONS;
export const getPreparation = id => PREPARATIONS.find(p => p.id === id);

/** What sort of thing it is, so the lane can't quietly become all drinks again. */
export const PREP_KINDS = { drink: "Drink", bowl: "Bowl", plate: "Plate", side: "Side", sweet: "Sweet" };

/**
 * Preparations, indexed the two ways the screens actually ask for them.
 *
 * By state, because the remedy screen is the whole product and the lane was
 * invisible from it — you could stand on "Feeling too hot" reading 614 cooling
 * foods with nothing telling you that fourteen ready-made cooling things exist
 * two taps away. By ingredient, because a food card that lists cucumber should
 * be able to say what cucumber is used in.
 */
const byState = new Map();
const byIngredient = new Map();
for (const p of PREPARATIONS) {
  if (!byState.has(p.state)) byState.set(p.state, []);
  byState.get(p.state).push(p);
  for (const id of p.ingredients) {
    if (!byIngredient.has(id)) byIngredient.set(id, []);
    byIngredient.get(id).push(p);
  }
}

/** Fastest first: the remedy screen's premise is "now", so time is the ranking. */
export const prepsForState = state => [...(byState.get(state) ?? [])].sort((a, b) => a.minutes - b.minutes);
export const prepsUsing = foodId => byIngredient.get(foodId) ?? [];

const byCommon = (a, b) => a.commonness - b.commonness || a.name.localeCompare(b.name);

export const LISTS = [
  {
    id: "sighi-divergence",
    title: "Where we differ from SIGHI",
    blurb: "The app cites the SIGHI list and departs from it here. Most of these have not been adjudicated.",
    tone: "calm",
    pick: () =>
      foods
        .filter(f => f.sourceState === "unreviewed" || f.sourceState === "reasoned")
        .sort((a, b) => Math.abs(b.histamine.sighi - b.histamine.ref.sighi) - Math.abs(a.histamine.sighi - a.histamine.ref.sighi) || a.name.localeCompare(b.name)),
  },
  {
    id: "top-cooling",
    title: "Top 10 cooling foods",
    blurb: "The coldest things most kitchens already have.",
    tone: "cold",
    pick: () => [...foods].filter(f => f.commonness <= 2).sort((a, b) => a.heat - b.heat).slice(0, 10),
  },
  {
    id: "heating-culprits",
    title: "Everyday heating culprits",
    blurb: "Staples the traditions agree run hot — the usual suspects behind a heat complaint.",
    tone: "hot",
    pick: () => [...foods].filter(f => f.commonness === 1).sort((a, b) => b.heat - a.heat).slice(0, 12),
  },
  {
    id: "histamine-safe",
    title: "Histamine-safe snacks",
    blurb: "SIGHI 0, no liberators, nothing aged or fermented.",
    tone: "calm",
    pick: () =>
      foods
        .filter(f => f.reactive === "eat" && f.commonness <= 2 && ["fruit", "vegetable", "grain", "protein"].includes(f.category))
        .sort(byCommon)
        .slice(0, 16),
  },
  {
    id: "famous-disagreements",
    title: "The famous disagreements",
    blurb: "Foods where the traditions genuinely split — mango, yogurt, ghee and friends.",
    tone: "neutral",
    pick: () => foods.filter(f => f.conflict && f.commonness <= 2).sort(byCommon),
  },
];

export const getList = id => LISTS.find(l => l.id === id);
