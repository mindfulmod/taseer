#!/usr/bin/env python3
"""Recover transparency on the browse-category cut-outs.

    python3 scripts/key-category-art.py

Dev-time only, like cwebp — needs Pillow + numpy. Reads the flattened downloads
from assets/ui/categories/_raw/ and writes keyed, cropped, downscaled PNGs to
assets/ui/categories/.

The downloads arrived flattened (hasAlpha: no) with the preview checkerboard
baked in as pixels — a light-grey checker of roughly 235 and 254 on white.

Keying is an EDGE-SEEDED FLOOD FILL, not a luminance threshold. A global
"remove everything brighter than 225" would also delete the grey ceramic jug and
bowl in dairy.png and the glass of water in drink.png, which sit in the same
tonal range as the checker. Background is the region connected to the border;
interior light greys are enclosed by darker edges and survive.
"""
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFilter
    import numpy as np
except ImportError:
    sys.exit("Needs Pillow and numpy:  python3 -m pip install pillow numpy")

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "ui" / "categories"
RAW = OUT / "_raw"

SENTINEL = (255, 0, 255)   # magenta: absent from every painting in this set
THRESH = 48                # bridges the checker's two tones (~19 apart)
SIZE = 512                 # card art renders ~110px tall; 512 covers 3x
IDS = ["fruit", "vegetable", "grain", "spice", "protein", "dairy", "drink", "dish"]

if not RAW.is_dir():
    sys.exit(f"Put the original downloads in {RAW} first.")

done, skipped, total_kb = 0, [], 0

for food_id in IDS:
    src = RAW / f"{food_id}.png"
    if not src.exists():
        skipped.append(food_id)
        continue

    im = Image.open(src).convert("RGB")
    w, h = im.size

    # Seed from all four corners and the midpoint of each edge, so a subject
    # touching one corner cannot strand the background it is sitting in.
    marked = im.copy()
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
             (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    for seed in seeds:
        if marked.getpixel(seed) != SENTINEL:
            ImageDraw.floodfill(marked, seed, SENTINEL, thresh=THRESH)

    background = np.all(np.array(marked) == SENTINEL, axis=-1)
    alpha = np.where(background, 0, 255).astype(np.uint8)

    # Pull the matte in by one pixel before feathering. The flood stops partway
    # into anti-aliased edges, so the outermost ring of kept pixels is still
    # part-blended with white and would read as a bright fringe.
    a = Image.fromarray(alpha).filter(ImageFilter.MinFilter(3))
    a = a.filter(ImageFilter.GaussianBlur(0.7))

    out = im.convert("RGBA")
    out.putalpha(a)
    out = out.crop(out.getbbox())          # trim the dead transparent margin
    out.thumbnail((SIZE, SIZE), Image.LANCZOS)
    dst = OUT / f"{food_id}.png"
    out.save(dst, optimize=True)

    kb = dst.stat().st_size / 1024
    total_kb += kb
    print(f"  {food_id:<10} {out.size[0]}x{out.size[1]}  {kb:>6.0f} KB")
    done += 1

print(f"\nKeyed {done} cut-out(s) → {total_kb / 1024:.1f} MB total")
if skipped:
    print(f"Missing from _raw/: {', '.join(skipped)}")
