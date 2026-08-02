// localStorage personal layer. No accounts, no backend — everything stays on device.
const KEY = "taseer.";
const listeners = new Set();

function read(name, fallback) {
  try {
    const raw = localStorage.getItem(KEY + name);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(name, value) {
  try {
    localStorage.setItem(KEY + name, JSON.stringify(value));
  } catch {
    /* private mode / quota — the app still works, it just forgets */
  }
  listeners.forEach(fn => fn(name));
}

export const onChange = fn => (listeners.add(fn), () => listeners.delete(fn));

const listStore = name => ({
  all: () => read(name, []),
  has: id => read(name, []).includes(id),
  toggle(id) {
    const next = this.has(id) ? this.all().filter(x => x !== id) : [id, ...this.all()];
    write(name, next);
    return next.includes(id);
  },
  remove(id) {
    write(name, this.all().filter(x => x !== id));
  },
  clear: () => write(name, []),
});

export const favorites = listStore("favorites");
export const triggers = listStore("triggers");

const RECENT_MAX = 24;
export const recent = {
  all: () => read("recent", []),
  push(id) {
    write("recent", [id, ...read("recent", []).filter(x => x !== id)].slice(0, RECENT_MAX));
  },
  clear: () => write("recent", []),
};

// Search misses drive the next data batch (data spec § miss log).
const MISS_MAX = 200;
export const misses = {
  all: () => read("misses", []),
  log(query) {
    const q = query.trim();
    if (q.length < 2) return;
    const list = read("misses", []);
    const existing = list.find(m => m.q.toLowerCase() === q.toLowerCase());
    if (existing) {
      existing.n = (existing.n ?? 1) + 1;
      existing.t = Date.now();
      write("misses", list);
    } else {
      write("misses", [{ q, t: Date.now(), n: 1 }, ...list].slice(0, MISS_MAX));
    }
  },
  clear: () => write("misses", []),
};

export const theme = {
  get: () => read("theme", "system"),
  set: value => write("theme", value),
};

export const banner = {
  dismissed: () => read("banner-dismissed", false),
  dismiss: () => write("banner-dismissed", true),
  show: () => write("banner-dismissed", false),
};
