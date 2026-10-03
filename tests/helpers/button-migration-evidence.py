"""Exact structural and decoded RGB comparison; preserve every raw capture."""
import gzip
import hashlib
import json
import runpy
import sys
from pathlib import Path
compare = runpy.run_path('tests/helpers/spaces-visual-pixels.py')['compare']
directory = Path('.git/design03/captures')
output = Path('docs/design-system/evidence-03')
output.mkdir(parents=True, exist_ok=True)
rows, differences, pixels = [], [], []
for base_file in sorted(directory.glob('base-*.json')):
    if base_file.name == 'base-interactions.json':
        continue
    identity = base_file.name[5:-5]
    base = json.loads(base_file.read_text())
    head = json.loads((directory / ('head-' + identity + '.json')).read_text())
    bn, hn = sum(base['nodes'], []), sum(head['nodes'], [])
    if len(bn) != len(hn):
        differences.append({'id': identity, 'nodes': [len(bn), len(hn)]})
    for index, (left, right) in enumerate(zip(bn, hn)):
        for key in left:
            a, b = left[key], right[key]
            if key == 'attributes':
                a, b = a.copy(), b.copy()
                if {'ui-button', 'ui-icon-button'} & set(a.get('class', '').split()):
                    original = a.pop('class')
                    migrated = b.pop('class')
                    # Remove only ui: tokens; retain the primitive marker and every consumer extension/order.
                    if original != ' '.join(value for value in migrated.split() if not value.startswith('ui:')):
                        differences.append({'id': identity, 'node': index, 'consumerClass': [original, migrated]})
            if a != b:
                differences.append({'id': identity, 'node': index, 'field': key, 'base': a, 'head': b})
    if base['setup'] != head['setup'] or base['viewport'] != head['viewport'] or base['dpr'] != head['dpr']:
        differences.append({'id': identity, 'setup': [base['setup'], head['setup']]})
    regions = []
    for node in bn:
        styles = {key: value for chunk in node['style'] for key, value in chunk.items()}
        if node['tag'] != 'HTML' and styles.get('display') != 'none':
            regions.append({'label': node['attributes'].get('id') or node['attributes'].get('class') or node['tag'], 'bounds': node['bounds'], 'display': styles.get('display')})
    state = {'regions': regions, 'tree': {}}
    comparisons = []
    for repeat in (1, 2, 3):
        comparisons.append(compare(directory / f'base-{identity}-{repeat}.jpg', directory / f'head-{identity}-{repeat}.jpg', state, 'base-versus-head'))
    for side in ('base', 'head'):
        for first, second in ((1, 2), (1, 3), (2, 3)):
            comparisons.append(compare(directory / f'{side}-{identity}-{first}.jpg', directory / f'{side}-{identity}-{second}.jpg', state, f'same-{side}-build'))
        frames = json.loads((directory / 'warmups' / f'{side}-{identity}.json').read_text())['frames']
        for first, second in zip(frames, frames[1:]):
            comparisons.append(compare(directory / first['file'], directory / second['file'], state, 'same-build-warmup'))
    pixels.extend(comparisons)
    rows.append({'id': identity, 'nodes': len(bn), 'setup': base['setup'], 'viewport': base['viewport'], 'dpr': base['dpr'], 'comparisons': comparisons})
summary = {'cases': len(rows), 'screenshots': len(rows) * 6, 'structuralDifferences': differences, 'decodedComparisons': len(pixels), 'byteIdenticalComparisons': sum(row['bytesEqual'] for row in pixels), 'crossBuildComparisons': sum(row['category'] == 'base-versus-head' for row in pixels), 'crossBuildDifferences': [row for row in pixels if row['category'] == 'base-versus-head' and row['changedPixels']], 'sameBuildDifferences': [row for row in pixels if row['category'] != 'base-versus-head' and row['changedPixels']], 'algorithm': 'Decode every RGB pixel; any unequal channel counts one changed pixel; zero tolerance, no masking/cropping.'}
(output / 'summary.json').write_text(json.dumps(summary, indent=2) + '\n')
with gzip.open(output / 'comparisons.json.gz', 'wt', encoding='utf-8') as stream:
    json.dump(rows, stream)
if '--archive' in sys.argv:
    if len(rows) != 64 or differences or summary['crossBuildDifferences']:
        raise RuntimeError('Cannot finalize incomplete or failing evidence')
    import base64
    seen = set()
    with gzip.open(output / 'captures.ndjson.gz', 'wt', encoding='utf-8') as stream:
        for file in sorted(directory.rglob('*')):
            if file.is_file():
                content = file.read_bytes()
                digest = hashlib.sha256(content).hexdigest()
                row = {'path': file.relative_to(directory).as_posix(), 'sha256': digest}
                if digest in seen:
                    row['encoding'] = 'reference'
                elif file.suffix == '.json':
                    row.update(encoding='utf8', content=content.decode('utf8'))
                else:
                    row.update(encoding='base64', content=base64.b64encode(content).decode())
                seen.add(digest)
                stream.write(json.dumps(row) + '\n')
print(json.dumps({key: len(value) if isinstance(value, list) else value for key, value in summary.items()}, indent=2))
