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

export const norm = s =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// ---- Index -----------------------------------------------------------------

export const foods = FOODS.map(food => {
  const heat = compositeHeat(food);
  const names = [food.name, ...food.aliases];
  return {
    ...food,
    heat,
    heatClass: heatClass(heat),
    conflict: hasConflict(food),
    contested: SYSTEMS.some(s => food.thermal[s].confidence === "contested"),
    reactive: reactiveVerdict(food),
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

export function search(query, limit = 80) {
  const q = norm(query);
  if (!q) return [];
  const hits = [];
  for (const food of foods) {
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
  const pick = state === "reactive" ? f => f.reactive : f => f.remedy?.[state];
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

export const BANDS = [
  { id: "cold", label: "Cold", blurb: "The deep coolers" },
  { id: "cool", label: "Cool", blurb: "Gently cooling" },
  { id: "neutral", label: "Neutral", blurb: "The traditions land near the middle" },
  { id: "warm", label: "Warm", blurb: "Gently warming" },
  { id: "hot", label: "Hot", blurb: "The real heaters" },
];

// ---- Preparations & curated lists -----------------------------------------

export const preparations = PREPARATIONS;
export const getPreparation = id => PREPARATIONS.find(p => p.id === id);

const byCommon = (a, b) => a.commonness - b.commonness || a.name.localeCompare(b.name);

export const LISTS = [
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
