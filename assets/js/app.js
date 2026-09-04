// Shell: theme, hash router, delegated events, safety banner.
import { banner, favorites, misses, recent, theme, triggers } from "./store.js";
import {
  bloatingView, caffeineView, categoryView, gunaView, compareView, effectIndexView, effectView, findView, foodView, homeView, listView, listsView,
  mechanismIndexView, mechanismView, meView, prepView, spectrumView, stateView, notFound,
} from "./views.js";

const main = document.getElementById("main");

// ---- Theme ---------------------------------------------------------------

const systemDark = matchMedia("(prefers-color-scheme: dark)");

function applyTheme() {
  const pref = theme.get();
  const resolved = pref === "system" ? (systemDark.matches ? "dark" : "light") : pref;
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    getComputedStyle(document.body).getPropertyValue("--bg").trim(),
  );
  const btn = document.getElementById("theme-toggle");
  if (btn) {
    btn.textContent = resolved === "dark" ? "☀️" : "🌙";
    btn.setAttribute("aria-label", `Switch to ${resolved === "dark" ? "light" : "dark"} mode`);
  }
  return resolved;
}
systemDark.addEventListener("change", () => theme.get() === "system" && applyTheme());

// ---- Safety banner -------------------------------------------------------

// Compact by default — a bolded one-line summary plus the same disclosure
// pattern the documented-effects panel uses (`details.expander`) — because the
// full four-sentence notice was pushing Home's state cards and Find's "ways"
// list below the fold on first visit, on every single screen, until dismissed.
// Nothing is cut: the summary line is itself the notice's own opening
// sentence, and every remaining word is one tap away, never removed.
function renderBanner() {
  const slot = document.getElementById("banner-slot");
  if (!slot) return;
  slot.innerHTML = banner.dismissed()
    ? ""
    : `<div class="banner" role="note">
         <span aria-hidden="true">🌿</span>
         <details class="expander banner__note">
           <summary><strong>Traditional information, not medical advice.</strong></summary>
           <p>Taseer reports how healing traditions have classified foods. It doesn't diagnose or treat.
           Severe or persistent reactions deserve real care.</p>
         </details>
         <button class="iconbtn" data-act="dismiss-banner" aria-label="Dismiss">✕</button>
       </div>`;
}

// ---- Router --------------------------------------------------------------

function parseHash() {
  const raw = location.hash.slice(1) || "/";
  const [path, query] = raw.split("?");
  return {
    parts: path.split("/").filter(Boolean),
    params: Object.fromEntries(new URLSearchParams(query ?? "")),
  };
}

function resolve({ parts, params }) {
  switch (parts[0]) {
    case undefined: return { view: homeView(), tab: "/" };
    case "find": return { view: findView(params), tab: "/find" };
    // Search and Browse merged into Find. Both old routes still resolve: this
    // ships as an installed PWA, so people have them in history and on home
    // screens, and a shared #/search?q=… link has to keep working.
    case "search": return { view: findView(params), tab: "/find" };
    case "browse": return { view: findView({}), tab: "/find" };
    case "food": return { view: foodView(parts[1]), tab: null };
    case "category": return { view: categoryView(parts[1], params), tab: "/find" };
    case "lists": return { view: listsView(), tab: "/find" };
    case "bloating": return { view: bloatingView(), tab: "/find" };
    case "caffeine": return { view: caffeineView(), tab: "/find" };
    case "guna": return { view: gunaView(), tab: "/find" };
    // Bare /mechanism is the index; /mechanism/<tag> is one mechanism.
    case "mechanism": return { view: parts[1] ? mechanismView(parts[1], params) : mechanismIndexView(), tab: "/find" };
    // Bare /effect is the index; /effect/<tag> is one documented effect.
    case "effect": return { view: parts[1] ? effectView(parts[1], params) : effectIndexView(), tab: "/find" };
    case "list": return { view: listView(parts[1]), tab: "/find" };
    case "prep": return { view: prepView(parts[1]), tab: "/find" };
    case "compare": return { view: compareView(params), tab: "/find" };
    case "spectrum": return { view: spectrumView(params), tab: "/find" };
    case "me": return { view: meView(), tab: "/me" };
    case "state": return { view: stateView(parts[1], params), tab: "/" };
    default: return { view: notFound("page"), tab: null };
  }
}

// The screen's tone is the remedy's temperature, not the complaint's.
const wash = document.getElementById("wash");
let currentTone = null;
let washTimer;

function setTone(tone = null) {
  if (tone === currentTone) return;
  const swapping = Boolean(currentTone && tone);
  clearTimeout(washTimer);
  currentTone = tone;
  if (tone) document.documentElement.dataset.tone = tone;
  else delete document.documentElement.dataset.tone;
  if (!tone) {
    wash.classList.remove("on");
    return;
  }
  const paint = () => {
    wash.className = `wash t-${tone}`;
    requestAnimationFrame(() => wash.classList.add("on"));
  };
  if (swapping) {
    wash.classList.remove("on");
    washTimer = setTimeout(paint, 260);
  } else {
    paint();
  }
}

let lastHash = null;

function render() {
  const route = parseHash();
  const { view, tab } = resolve(route);
  main.innerHTML = view.html;
  view.mount?.(main);
  setTone(view.tone);

  for (const item of document.querySelectorAll(".tabbar__item")) {
    if (item.dataset.nav === tab) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  }

  if (location.hash !== lastHash) {
    lastHash = location.hash;
    window.scrollTo(0, 0);
  }
}

// ---- Delegated events ----------------------------------------------------

document.addEventListener("click", event => {
  const back = event.target.closest("[data-back]");
  if (back) {
    event.preventDefault();
    // Reached this screen from inside the app → go back to exactly where they
    // were: the search results, the category, the remedy list they tapped from.
    // Opened cold (deep link, shared URL, fresh PWA launch) there is no such
    // entry, so fall back to the value in data-back — the food's own category,
    // which is the most useful place to land.
    if (inAppNavs > 0) history.back();
    else location.hash = `#${back.dataset.back}`;
    return;
  }

  const nav = event.target.closest("[data-nav]");
  if (nav) {
    event.preventDefault();
    location.hash = `#${nav.dataset.nav}`;
    return;
  }

  const act = event.target.closest("[data-act]");
  if (!act) return;
  const { act: action, id } = act.dataset;

  if (action === "fav") {
    const on = favorites.toggle(id);
    act.setAttribute("aria-pressed", String(on));
    // The food card's heart is an icon button floating on the painting: it
    // shows its state with a class, and rewriting its text would eat the SVG.
    if (act.classList.contains("fhero__btn")) act.classList.toggle("is-on", on);
    else act.textContent = `${on ? "♥" : "♡"} Favourite`;
  } else if (action === "trigger") {
    const on = triggers.toggle(id);
    act.setAttribute("aria-pressed", String(on));
    act.textContent = `⚠ ${on ? "One of my triggers" : "Mark as trigger"}`;
  } else if (action === "dismiss-banner") {
    banner.dismiss();
    renderBanner();
  } else if (action === "show-banner") {
    banner.show();
    renderBanner();
    scrollTo({ top: 0, behavior: "smooth" });
  } else if (action === "clear-recent") {
    recent.clear();
    render();
  } else if (action === "clear-misses") {
    misses.clear();
    render();
  } else if (action === "copy-misses") {
    navigator.clipboard
      ?.writeText(misses.all().map(m => `${m.q}${m.n > 1 ? ` (${m.n}x)` : ""}`).join("\n"))
      .then(() => {
        act.textContent = "Copied";
        setTimeout(() => (act.textContent = "Copy"), 1600);
      });
  } else if (action === "install") {
    installPrompt?.prompt();
    installPrompt = null;
  } else if (action === "theme") {
    const resolved = document.documentElement.dataset.theme;
    theme.set(resolved === "dark" ? "light" : "dark");
    applyTheme();
  }
});

// How many in-app navigations have happened since load — tells the back button
// whether there is anything of ours to go back to.
let inAppNavs = 0;
addEventListener("hashchange", () => {
  inAppNavs++;
  render();
});

// ---- PWA -----------------------------------------------------------------

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  // app.js only runs after a dynamic import() from an inline module script
  // (index.html), which doesn't block window's "load" — by the time this line
  // executes, "load" has very often already fired, so a plain
  // addEventListener("load", …) here silently never calls register() at all.
  // Check readyState first and register immediately in that case.
  const registerSW = () => navigator.serviceWorker.register("./sw.js").catch(() => {});
  if (document.readyState === "complete") registerSW();
  else addEventListener("load", registerSW);
}

// Chromium fires this instead of showing its own prompt; we surface it on Me.
let installPrompt = null;
addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
  document.getElementById("install-slot")?.classList.add("is-ready");
});
addEventListener("appinstalled", () => {
  installPrompt = null;
  document.getElementById("install-slot")?.classList.remove("is-ready");
});

applyTheme();
renderBanner();
render();
