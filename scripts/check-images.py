"""Validate required food art. Pillow is a build/test dependency, never shipped JS."""
import json
from pathlib import Path
import sys
from PIL import Image

root = Path(__file__).resolve().parent.parent
foods = [food for path in (root / 'data/foods').glob('*.json') for food in json.loads(path.read_text())]
food_ids = {food['id'] for food in foods}
preps = json.loads((root / 'data/preparations.json').read_text())
art = json.loads((root / 'data/preparation-art.json').read_text())
prep_ids = {a['id'] for a in art if a['source'] == 'generated'}
errors = []
if len(art) != len(preps) or {a['id'] for a in art} != {p['id'] for p in preps}:
    errors.append('Preparation artwork must map every preparation exactly once')
for a in art:
    if a['review'] != 'reviewed': errors.append(f"{a['id']}: artwork needs review")
    if a['source'] not in {'food', 'generated'}: errors.append(f"{a['id']}: invalid artwork source")
    if a['source'] == 'food' and a['assetId'] not in food_ids: errors.append(f"{a['id']}: invalid reused food")
    folder = 'food' if a['source'] == 'food' else 'prep'
    for size, suffix in [('hero','images'), ('thumb','thumbs')]:
        expected = f"assets/{folder}-{suffix}/{a['assetId']}.webp"
        if a[size] != expected or not (root / expected).is_file(): errors.append(f"{a['id']}: invalid {size} mapping")

for folder, dimensions, budget in [
    ('food-images', {(640, 426), (640, 427)}, 45 * 1024),
    ('food-thumbs', {(320, 320)}, 24 * 1024),
    ('prep-images', {(640, 427)}, 45 * 1024),
    ('prep-thumbs', {(320, 320)}, 24 * 1024),
]:
    ids = prep_ids if folder.startswith('prep') else food_ids
    paths = {path.stem: path for path in (root / 'assets' / folder).glob('*.webp')}
    for missing in sorted(ids - paths.keys()):
        errors.append(f'{folder}/{missing}.webp: required asset missing')
    for extra in sorted(paths.keys() - ids):
        errors.append(f'{folder}/{extra}.webp: unknown food id')
    for path in paths.values():
        try:
            with Image.open(path) as image:
                if image.format != 'WEBP' or image.size not in dimensions:
                    errors.append(f'{folder}/{path.name}: unexpected format/dimensions {image.format} {image.size}')
                image.load()  # Decode pixels: a plausible header alone is not a valid image.
            if path.stat().st_size > budget:
                errors.append(f'{folder}/{path.name}: exceeds {budget // 1024} KiB budget')
        except Exception as error:
            errors.append(f'{folder}/{path.name}: cannot decode ({error})')
    print(f'{folder}: {len(ids & paths.keys())}/{len(ids)} required images')
if errors:
    print('\n'.join(errors), file=sys.stderr)
    sys.exit(1)
print('Artwork complete, decodable, correctly sized, and within budget.')
