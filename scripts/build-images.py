#!/usr/bin/env python3
"""Build the shipped image derivatives from the painted sources.

    python3 scripts/build-images.py [--force]

Reads 1280x854 sources from assets/food-images/_raw/ and writes two sets:

  assets/food-images/<id>.webp   640px wide, 3:2   — food-card hero
  assets/food-thumbs/<id>.webp   320px square      — rows, rails, tiles

Replaces the sips-based build-thumbs.mjs (which needed two passes to work
around sips computing its resize ratio from pre-crop dimensions) and does not
need cwebp, which optimise-images.mjs required and which is not installed here.
Pillow handles both the crop and the WebP encode.

The 3:2 sources stay in _raw/ and are NOT deployed — GitHub Pages uploads the
whole repo, and 44 MB of unreferenced originals would ship with it.
"""
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Needs Pillow:  python3 -m pip install pillow")

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "assets" / "food-images" / "_raw"
HERO_DIR = ROOT / "assets" / "food-images"
THUMB_DIR = ROOT / "assets" / "food-thumbs"

HERO_W = 640
HERO_Q = 72
HERO_MAX_KB = 45      # ART.md §8
THUMB = 320
THUMB_Q = 70

force = "--force" in sys.argv

if not RAW.is_dir():
    sys.exit(f"No sources in {RAW}.")

THUMB_DIR.mkdir(parents=True, exist_ok=True)

sources = sorted(p for p in RAW.iterdir() if p.suffix.lower() in {".jpg", ".jpeg", ".png"})
if not sources:
    sys.exit(f"No images in {RAW}.")

built = skipped = 0
hero_kb = thumb_kb = 0
oversized = []

for src in sources:
    food_id = src.stem
    hero = HERO_DIR / f"{food_id}.webp"
    thumb = THUMB_DIR / f"{food_id}.webp"

    if not force and hero.exists() and thumb.exists():
        skipped += 1
        hero_kb += hero.stat().st_size / 1024
        thumb_kb += thumb.stat().st_size / 1024
        continue

    im = Image.open(src).convert("RGB")

    h = im.copy()
    h.thumbnail((HERO_W, HERO_W), Image.LANCZOS)
    h.save(hero, "WEBP", quality=HERO_Q, method=6)
    kb = hero.stat().st_size / 1024
    hero_kb += kb
    if kb > HERO_MAX_KB:
        oversized.append(f"{food_id} — {kb:.0f} KB")

    # Centre square. The §8 recipe centres every subject at 60–70% of a 3:2
    # frame, so one crop rule is safe across the whole set.
    w, ht = im.size
    side = min(w, ht)
    box = ((w - side) // 2, (ht - side) // 2, (w + side) // 2, (ht + side) // 2)
    t = im.crop(box).resize((THUMB, THUMB), Image.LANCZOS)
    t.save(thumb, "WEBP", quality=THUMB_Q, method=6)
    thumb_kb += thumb.stat().st_size / 1024

    built += 1

n = built + skipped
print(f"Heroes  {n} → {hero_kb / 1024:.1f} MB  (~{hero_kb / n:.0f} KB each)")
print(f"Thumbs  {n} → {thumb_kb / 1024:.1f} MB  (~{thumb_kb / n:.0f} KB each)")
print(f"{built} built, {skipped} already current")
if oversized:
    print(f"\n{len(oversized)} hero(es) over the {HERO_MAX_KB} KB budget (ART.md §8):")
    for o in oversized[:10]:
        print("  -", o)
