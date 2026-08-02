// Rasterises the Taseer mark to PNG at the sizes a PWA needs. Pure Node (zlib
// only) so there is no image dependency and the icons are reproducible.
//   node scripts/build-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "assets");

// ART.md §2 — the thermal ramp. No colour here may be invented.
const TILE = [
  [0.0, [0x26, 0x70, 0x6e]],
  [0.52, [0xb3, 0x95, 0x66]],
  [1.0, [0xb4, 0x50, 0x3a]],
];
const RAMP = [
  [0.0, [0x26, 0x70, 0x6e]],
  [0.28, [0x57, 0x96, 0x8f]],
  [0.5, [0xb3, 0x95, 0x66]],
  [0.74, [0xce, 0x8a, 0x4e]],
  [1.0, [0xb4, 0x50, 0x3a]],
];
const CREAM = [0xfa, 0xf5, 0xec];
const BLEED = [0xb3, 0x95, 0x66];

const lerp = (a, b, t) => a + (b - a) * t;

function sample(stops, t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [p0, c0] = stops[i - 1];
      const [p1, c1] = stops[i];
      const k = (t - p0) / (p1 - p0 || 1);
      return c0.map((c, j) => Math.round(lerp(c, c1[j], k)));
    }
  }
  return stops.at(-1)[1];
}

// Signed distance functions, evaluated in the art's 0..1 space. Coverage is
// converted to pixels by the caller — feathering in unit space would smear every
// edge across half the icon.
function sdRoundRect(x, y, x0, y0, w, h, r) {
  const cx = Math.abs(x - (x0 + w / 2)) - (w / 2 - r);
  const cy = Math.abs(y - (y0 + h / 2)) - (h / 2 - r);
  return Math.min(Math.max(cx, cy), 0) + Math.hypot(Math.max(cx, 0), Math.max(cy, 0)) - r;
}

const sdCircle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r;

/** Distance (unit space) → pixel coverage, one pixel of antialiasing. */
const cover = (d, pxPerUnit) => Math.max(0, Math.min(1, 0.5 - d * pxPerUnit));

const over = (dst, src, a) => dst.map((c, i) => Math.round(lerp(c, src[i], a)));

/** Draws the mark into an RGBA buffer. `pad` insets the art for maskable icons. */
function renderIcon(size, pad = 0) {
  const inset = size * pad;
  const art = size - inset * 2;
  const px = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ax = (x + 0.5 - inset) / art;
      const ay = (y + 0.5 - inset) / art;

      // Maskable icons bleed to the edges; plain icons keep transparent corners.
      let rgb = pad ? BLEED : CREAM;
      let alpha = pad ? 1 : 0;

      const tileA = cover(sdRoundRect(ax, ay, 0, 0, 1, 1, 114 / 512), art);
      if (tileA > 0) {
        rgb = over(rgb, sample(TILE, (ax + ay) / 2), tileA);
        alpha = Math.max(alpha, tileA);
      }

      const plateA = cover(sdCircle(ax, ay, 0.5, 0.5, 150 / 512), art);
      if (plateA > 0) {
        rgb = over(rgb, CREAM, plateA);
        alpha = Math.max(alpha, plateA);
      }

      const barA = cover(sdRoundRect(ax, ay, 166 / 512, 242 / 512, 180 / 512, 28 / 512, 14 / 512), art);
      if (barA > 0) rgb = over(rgb, sample(RAMP, (ax - 166 / 512) / (180 / 512)), barA);

      const i = (y * size + x) * 4;
      px[i] = rgb[0];
      px[i + 1] = rgb[1];
      px[i + 2] = rgb[2];
      px[i + 3] = Math.round(alpha * 255);
    }
  }
  return px;
}

// ---- Minimal PNG encoder --------------------------------------------------

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

const paeth = (a, b, c) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/**
 * Filters one scanline with each candidate filter and keeps the one with the
 * smallest absolute sum — the standard heuristic. Smooth gradients compress
 * an order of magnitude better filtered than stored raw.
 */
function filterRow(cur, prev, bpp, out) {
  const n = cur.length;
  let best = null;
  for (const type of [0, 1, 2, 3, 4]) {
    const line = Buffer.alloc(n);
    let score = 0;
    for (let i = 0; i < n; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      const pred = type === 0 ? 0 : type === 1 ? a : type === 2 ? b : type === 3 ? (a + b) >> 1 : paeth(a, b, c);
      const v = (cur[i] - pred) & 0xff;
      line[i] = v;
      score += v < 128 ? v : 256 - v;
    }
    if (!best || score < best.score) best = { type, line, score };
  }
  out.push(Buffer.from([best.type]), best.line);
}

function encodePng(px, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour + alpha
  const stride = size * 4;
  const parts = [];
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < size; y++) {
    const cur = Buffer.from(px.buffer, y * stride, stride);
    filterRow(cur, prev, 4, parts);
    prev = cur;
  }
  const raw = Buffer.concat(parts);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- Build ---------------------------------------------------------------

mkdirSync(outDir, { recursive: true });
const targets = [
  ["icon-192.png", 192, 0],
  ["icon-512.png", 512, 0],
  ["icon-maskable-512.png", 512, 0.14],
  ["apple-touch-icon.png", 180, 0],
];

for (const [name, size, pad] of targets) {
  const png = encodePng(renderIcon(size, pad), size);
  writeFileSync(join(outDir, name), png);
  console.log(`${name.padEnd(24)} ${size}×${size}  ${(png.length / 1024).toFixed(1)} KB`);
}
