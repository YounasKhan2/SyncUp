"""Preserve every frame and snapshot, deduplicating only identical raster bytes."""
import base64
import gzip
import hashlib
import json
import shutil
from pathlib import Path

work = Path('.git/spaces-visual-correction')
out = Path('docs/architecture/component-phase-04-evidence/visual-correction')
out.mkdir(parents=True, exist_ok=True)
manifest = {'format': 'Every file is indexed by stage/path/SHA256; rasters are stored once by hash. No masking, crop, tolerance, or image editing.', 'files': []}
known_rasters = set()
with gzip.open(out/'rasters.ndjson.gz', 'wt', encoding='utf-8') as images, gzip.open(out/'snapshots.ndjson.gz', 'wt', encoding='utf-8') as snapshots:
    for stage, folder in [('first-pass', 'raw-first-pass'), ('stabilized', 'stabilized-captures'), ('observation-world-attempt', 'initial-observation-world-attempt'), *[(f'recheck-{i}', f'recheck-{i}') for i in range(1, 4)]]:
        for file in sorted((work/folder).rglob('*')):
            if not file.is_file() or file.suffix not in ('.json', '.jpg'):
                continue
            data = file.read_bytes()
            digest = hashlib.sha256(data).hexdigest()
            identity = str(file.relative_to(work/folder)).replace('\\', '/')
            manifest['files'].append({'stage': stage, 'file': identity, 'sha256': digest, 'bytes': len(data)})
            if file.suffix == '.jpg':
                if digest not in known_rasters:
                    known_rasters.add(digest)
                    images.write(json.dumps({'sha256': digest, 'base64': base64.b64encode(data).decode('ascii')})+'\n')
            else:
                snapshots.write(json.dumps({'stage': stage, 'file': identity, 'sha256': digest, 'text': data.decode('utf-8')})+'\n')
manifest['uniqueRasters'] = len(known_rasters)
with gzip.open(out/'artifact-manifest.json.gz', 'wt', encoding='utf-8') as zipped:
    zipped.write(json.dumps(manifest, indent=2)+'\n')
shutil.copyfile(work/'build-manifest.json', out/'build-manifest.json')
shutil.copyfile(work/'raw-first-pass-analysis/summary.json', out/'first-pass-summary.json')
for folder, filename in [(out, 'pixel-comparisons.json'), (out, 'warmup-comparisons.json'), (work/'raw-first-pass-analysis', 'pixel-comparisons.json')]:
    target = out/(('first-pass-' if folder != out else '')+filename+'.gz')
    if (folder/filename).exists():
        with gzip.open(target, 'wb') as zipped:
            zipped.write((folder/filename).read_bytes())
if (out/'navigation-repeat-comparisons.json').exists():
    with gzip.open(out/'navigation-repeat-comparisons.json.gz', 'wb') as zipped:
        zipped.write((out/'navigation-repeat-comparisons.json').read_bytes())
for i in range(1, 4):
    source = work/f'recheck-{i}-analysis'
    shutil.copyfile(source/'summary.json', out/f'recheck-{i}-summary.json')
    for filename in ['pixel-comparisons.json', 'warmup-comparisons.json']:
        with gzip.open(out/f'recheck-{i}-{filename}.gz', 'wb') as zipped:
            zipped.write((source/filename).read_bytes())
for name in ['base-desktop-dark-light-text-1.jpg', 'head-desktop-dark-light-text-1.jpg', 'base-mobile-dark-light-text-1.jpg', 'head-mobile-dark-light-text-1.jpg']:
    shutil.copyfile(work/'stabilized-captures'/name, out/name)
print(json.dumps({'filesIndexed': len(manifest['files']), 'uniqueRasters': len(known_rasters)}, indent=2))
if (work/'gates.json').exists():
    shutil.copyfile(work/'gates.json', out/'final-gates.json')
    with gzip.open(out/'final-gate-logs.ndjson.gz', 'wt', encoding='utf-8') as zipped:
        for gate in json.loads((work/'gates.json').read_text()):
            zipped.write(json.dumps({'command': gate['command'], 'exit': gate['exit'], 'log': Path(gate['log']).read_text(encoding='utf-8')})+'\n')
