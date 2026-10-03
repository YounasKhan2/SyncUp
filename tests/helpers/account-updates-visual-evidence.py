"""Package unmodified dialog captures and prove exact same-build raster recurrence."""
import base64
import gzip
import hashlib
import json
import shutil
from pathlib import Path

work = Path('.git/account-updates-visual')
analysis = Path('.git/phase06/pixels')
out = Path('docs/architecture/component-phase-06-evidence')
out.mkdir(parents=True, exist_ok=True)
summary = json.loads((analysis/'summary.json').read_text())
same = summary['sameBuildPixelDifferences'] + summary['warmupPixelDifferences']
proof = []
for cross in summary['crossBuildPixelDifferences']:
    repeats = [row for row in same if {row['leftSHA256'], row['rightSHA256']} == {cross['leftSHA256'], cross['rightSHA256']}]
    proof.append({'crossBuild': cross, 'exactSameBuildHashPairRepeats': repeats})
with gzip.open(out/'complete-visual-summary.json.gz', 'wt', encoding='utf-8') as zipped:
    zipped.write(json.dumps(summary, indent=2)+'\n')
compact = {key: len(value) if isinstance(value, list) else value for key, value in summary.items()}
compact['exactSameBuildHashPairReproductions'] = sum(bool(row['exactSameBuildHashPairRepeats']) for row in proof)
compact['crossBuildDifferenceDetails'] = [{**{key: row[key] for key in ['left', 'right', 'changedPixels', 'changedPercent', 'bbox', 'connected32pxTileRegions', 'touchesProductUI']},
    'productRegionLabels': [region['label'] for region in row['productRegionsTouched']], 'exactSameBuildReproduced': any({repeat['leftSHA256'], repeat['rightSHA256']} == {row['leftSHA256'], row['rightSHA256']} for repeat in same)} for row in summary['crossBuildPixelDifferences']]
(out/'visual-summary.json').write_text(json.dumps(compact, indent=2)+'\n')
for filename in ['pixel-comparisons.json', 'warmup-comparisons.json']:
    with gzip.open(out/(filename+'.gz'), 'wb') as zipped:
        zipped.write((analysis/filename).read_bytes())
with gzip.open(out/'same-build-repeat-proof.json.gz', 'wt', encoding='utf-8') as zipped:
    zipped.write(json.dumps(proof, indent=2)+'\n')
manifest = {'format': 'Unmodified raw frames, snapshots and warmup manifests; raster deduplication by exact byte hash only', 'files': []}
seen = set()
with gzip.open(out/'rasters.ndjson.gz', 'wt', encoding='utf-8') as images, gzip.open(out/'snapshots.ndjson.gz', 'wt', encoding='utf-8') as snapshots:
    for file in sorted((work/'captures').rglob('*')):
        if not file.is_file():
            continue
        data = file.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        identity = str(file.relative_to(work/'captures')).replace('\\', '/')
        manifest['files'].append({'file': identity, 'sha256': digest, 'bytes': len(data)})
        if file.suffix == '.jpg':
            if digest not in seen:
                seen.add(digest)
                images.write(json.dumps({'sha256': digest, 'base64': base64.b64encode(data).decode('ascii')})+'\n')
        else:
            snapshots.write(json.dumps({'file': identity, 'sha256': digest, 'text': data.decode('utf-8')})+'\n')
manifest['uniqueRasterHashes'] = len(seen)
with gzip.open(out/'artifact-manifest.json.gz', 'wt', encoding='utf-8') as zipped:
    zipped.write(json.dumps(manifest, indent=2)+'\n')
for side in ['base', 'head']:
    shutil.copyfile(work/f'{side}-manifest.json', out/f'{side}-build-manifest.json')
    for identity in ['desktop-dark-light-account-sessions', 'mobile-dark-light-updates-items']:
        shutil.copyfile(work/'captures'/f'{side}-{identity}-1.jpg', out/f'{side}-{identity}.jpg')
gates = []
with gzip.open(out/'verification-logs.ndjson.gz', 'wt', encoding='utf-8') as zipped:
    for stage in ['baseline', 'final']:
        for row in json.loads(Path(f'.git/phase06/{stage}-gates.json').read_text()):
            gates.append({'stage': stage, **row})
            zipped.write(json.dumps({'stage': stage, 'command': row['command'], 'exit': row['exit'], 'log': Path(row['log']).read_text(encoding='utf-8')})+'\n')
    for file in sorted(Path('.git/phase06').glob('*focused.log')):
        zipped.write(json.dumps({'stage': file.stem, 'log': file.read_text(encoding='utf-8-sig')})+'\n')
(out/'verification-ledger.json').write_text(json.dumps(gates, indent=2)+'\n')
print(json.dumps({'indexedArtifacts': len(manifest['files']), 'uniqueRasters': len(seen), 'exactSameBuildReproductions': len(proof)}, indent=2))
