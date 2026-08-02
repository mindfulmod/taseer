// Shell: theme, hash router, delegated events, safety banner.
import { banner, favorites, theme, triggers } from "./store.js";
import { browseView, categoryView, foodView, homeView, searchView, stateView } from "./views.js";

const main = document.getElementById("main");
const topbar = document.querySelector(".topbar");

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

function renderBanner() {
  const slot = document.getElementById("banner-slot");
  if (!slot) return;
  slot.innerHTML = banner.dismissed()
    ? ""
    : `<div class="banner" role="note">
         <span aria-hidden="true">🌿</span>
         <span><strong>Traditional information, not medical advice.</strong>
         Taseer reports how healing traditions have classified foods. It doesn't diagnose or treat.
         Severe or persistent reactions deserve real care.</span>
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
    case "search": return { view: searchView(params), tab: "/search" };
    case "food": return { view: foodView(parts[1]), tab: null };
    case "browse": return { view: browseView(), tab: "/browse" };
    case "category": return { view: categoryView(parts[1]), tab: "/browse" };
    case "state": return { view: stateView(parts[1]), tab: "/" };
    default: return { view: { html: `<div class="empty">Nothing here.</div>` }, tab: null };
  }
}

let lastHash = null;

function render() {
  const route = parseHash();
  const { view, tab } = resolve(route);
  main.innerHTML = view.html;
  view.mount?.(main);

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
    act.textContent = `${on ? "♥" : "♡"} Favourite`;
  } else if (action === "trigger") {
    const on = triggers.toggle(id);
    act.setAttribute("aria-pressed", String(on));
    act.textContent = `⚠ ${on ? "One of my triggers" : "Mark as trigger"}`;
  } else if (action === "dismiss-banner") {
    banner.dismiss();
    renderBanner();
  } else if (action === "theme") {
    const resolved = document.documentElement.dataset.theme;
    theme.set(resolved === "dark" ? "light" : "dark");
    applyTheme();
  }
});

addEventListener("hashchange", render);
addEventListener("scroll", () => topbar.classList.toggle("scrolled", scrollY > 4), { passive: true });

applyTheme();
renderBanner();
render();
