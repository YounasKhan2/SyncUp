"""Decode every raster and compare all RGB pixels with zero tolerance."""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

def compare(left, right, state, category):
    a = np.asarray(Image.open(left).convert('RGB'))
    b = np.asarray(Image.open(right).convert('RGB'))
    if a.shape != b.shape:
        raise RuntimeError(f'Raster size mismatch: {left} {right}')
    mask = np.any(a != b, axis=2)
    height, width = mask.shape
    changed = int(mask.sum())
    ys, xs = np.nonzero(mask)
    bbox = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1] if changed else None
    regions = []
    for region in state['regions']:
        x, y, w, h = region['bounds']
        if region['display'] == 'none' or w <= 0 or h <= 0:
            continue
        count = int(mask[max(0, int(np.floor(y))):min(height, int(np.ceil(y+h))), max(0, int(np.floor(x))):min(width, int(np.ceil(x+w)))].sum())
        if count:
            regions.append({'label': region['label'], 'changedPixels': count, 'bounds': region['bounds']})
    # Exact changed-pixel bounding box plus connected 32px tile regions; do not
    # hide tiny differences with a threshold or rounded percentage.
    tile_mask = np.zeros(((height + 31)//32, (width + 31)//32), dtype=bool)
    if changed:
        tile_mask[ys//32, xs//32] = True
    pending = set(map(tuple, np.argwhere(tile_mask)))
    boxes = []
    while pending:
        seed = pending.pop()
        component, stack = [seed], [seed]
        while stack:
            y, x = stack.pop()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    neighbour = (y + dy, x + dx)
                    if neighbour in pending:
                        pending.remove(neighbour)
                        component.append(neighbour)
                        stack.append(neighbour)
        boxes.append([int(min(p[1] for p in component)*32), int(min(p[0] for p in component)*32),
                      int(min(width, (max(p[1] for p in component)+1)*32)), int(min(height, (max(p[0] for p in component)+1)*32))])
    return {'category': category, 'left': left.name, 'right': right.name,
            'bytesEqual': left.read_bytes() == right.read_bytes(),
            'leftSHA256': hashlib.sha256(left.read_bytes()).hexdigest(),
            'rightSHA256': hashlib.sha256(right.read_bytes()).hexdigest(),
            'raster': [width, height], 'changedPixels': changed,
            'changedPercent': changed * 100 / (width * height), 'bbox': bbox,
            'connected32pxTileRegions': boxes, 'productRegionsTouched': regions,
            'touchesProductUI': bool(regions), 'maxChannelDifference': int(np.abs(a.astype(np.int16)-b.astype(np.int16)).max())}


def main():
    directory = Path(sys.argv[1])
    output = Path(sys.argv[2])
    output.mkdir(parents=True, exist_ok=True)
    rows = []
    warmup_rows = []


    for base_json in sorted(directory.glob('base-*.json')):
        identity = base_json.name[5:-5]
        base_state = json.loads(base_json.read_text())
        head_state = json.loads((directory / f'head-{identity}.json').read_text())
        if base_state != head_state:
            raise RuntimeError(f'Exact DOM/style/bounds/focus mismatch: {identity}')
        if base_state['dpr'] != 1.190000057220459:
            raise RuntimeError(f'DPR mismatch: {identity}')
        comparisons = []
        for repeat in (1, 2, 3):
            comparisons.append(compare(directory/f'base-{identity}-{repeat}.jpg', directory/f'head-{identity}-{repeat}.jpg', base_state, 'base-versus-head'))
        for side, state in (('base', base_state), ('head', head_state)):
            for first, second in ((1, 2), (1, 3), (2, 3)):
                comparisons.append(compare(directory/f'{side}-{identity}-{first}.jpg', directory/f'{side}-{identity}-{second}.jpg', state, f'same-{side}-build'))
        rows.append({'id': identity, 'exactDOMStyleBoundsFocusEqual': True, 'theme': base_state['theme'],
                     'appearance': base_state['appearance'], 'systemDark': base_state['systemDark'],
                     'systemLight': base_state['systemLight'], 'viewport': base_state['viewport'],
                     'dpr': base_state['dpr'], 'diagnostics': base_state['diagnostics'], 'comparisons': comparisons})

    comparisons = [comparison for row in rows for comparison in row['comparisons']]
    for report in sorted((directory/'warmups').glob('*.json')):
        identity = report.stem
        state = json.loads((directory/f'{identity}.json').read_text())
        frames = json.loads(report.read_text())['frames']
        for first, second in zip(frames, frames[1:]):
            warmup_rows.append(compare(directory/first['file'], directory/second['file'], state, 'same-build-warmup'))
        warmup_rows.append(compare(directory/frames[-1]['file'], directory/f'{identity}-1.jpg', state, 'last-warmup-versus-final'))
    summary = {'cases': len(rows), 'screenshots': len(rows)*6, 'exactDOMStyleBoundsFocusPairs': len(rows),
               'decodedComparisons': len(comparisons), 'byteIdenticalComparisons': sum(c['bytesEqual'] for c in comparisons),
               'decodedPixelIdenticalComparisons': sum(c['changedPixels'] == 0 for c in comparisons),
               'crossBuildPixelDifferences': [c for c in comparisons if c['category'] == 'base-versus-head' and c['changedPixels']],
               'sameBuildPixelDifferences': [c for c in comparisons if c['category'] != 'base-versus-head' and c['changedPixels']],
               'warmupComparisons': len(warmup_rows), 'warmupPixelDifferences': [c for c in warmup_rows if c['changedPixels']],
               'algorithm': 'RGB decoded pixels; any unequal channel counts one changed pixel; zero tolerance; all pixels included'}
    (output/'pixel-comparisons.json').write_text(json.dumps(rows, indent=2)+'\n')
    (output/'warmup-comparisons.json').write_text(json.dumps(warmup_rows, indent=2)+'\n')
    (output/'summary.json').write_text(json.dumps(summary, indent=2)+'\n')
    print(json.dumps({k: len(v) if isinstance(v, list) else v for k, v in summary.items()}, indent=2))


if __name__ == "__main__":
    main()
