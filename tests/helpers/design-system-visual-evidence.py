import base64,gzip,hashlib,json,runpy
from pathlib import Path
compare=runpy.run_path('tests/helpers/spaces-visual-pixels.py')['compare']
source=Path('.git/design01/captures');out=Path('docs/design-system/evidence');rows=[];manifest=[];seen=set()
for p in sorted(source.glob('*.json')):
 state=json.loads(p.read_text(encoding='utf-8'));identity=p.stem;comparisons=[]
 for a,b in [(1,2),(1,3),(2,3)]:comparisons.append(compare(source/f'{identity}-{a}.jpg',source/f'{identity}-{b}.jpg',state,'same-unchanged-main'))
 frames=json.loads((source/'warmups'/f'{identity}.json').read_text(encoding='utf-8'))['frames']
 for a,b in zip(frames,frames[1:]):comparisons.append(compare(source/a['file'],source/b['file'],state,'warmup'))
 comparisons.append(compare(source/frames[-1]['file'],source/f'{identity}-1.jpg',state,'warmup-to-final'))
 rows.append({'id':identity,'theme':state['theme'],'appearance':state['appearance'],'viewport':state['viewport'],'dpr':state['dpr'],'comparisons':comparisons})
with gzip.open(out/'baseline-comparisons.json.gz','wt',encoding='utf-8') as f:f.write(json.dumps(rows))
with gzip.open(out/'baseline-rasters.ndjson.gz','wt',encoding='utf-8') as imgs,gzip.open(out/'baseline-snapshots.ndjson.gz','wt',encoding='utf-8') as snapshots:
 for p in sorted(source.rglob('*')):
  if not p.is_file():continue
  data=p.read_bytes();digest=hashlib.sha256(data).hexdigest();name=p.relative_to(source).as_posix();manifest.append({'file':name,'sha256':digest,'bytes':len(data)})
  if p.suffix=='.jpg':
   if digest not in seen:imgs.write(json.dumps({'sha256':digest,'base64':base64.b64encode(data).decode()})+'\n');seen.add(digest)
  else:snapshots.write(json.dumps({'file':name,'sha256':digest,'text':data.decode('utf-8')})+'\n')
with gzip.open(out/'baseline-manifest.json.gz','wt',encoding='utf-8') as f:f.write(json.dumps(manifest))
allrows=[c for r in rows for c in r['comparisons']];summary={'base':'0c74acf8f54a7dc1a8a235eae43dea9893d264fd','cases':len(rows),'finalScreenshots':len(rows)*3,'comparisons':len(allrows),'byteEqual':sum(c['bytesEqual'] for c in allrows),'pixelEqual':sum(c['changedPixels']==0 for c in allrows),'differences':[c for c in allrows if c['changedPixels']],'uniqueRasters':len(seen),'indexedArtifacts':len(manifest),'limitations':'Isolated presentation fixtures. No authenticated runtime or CallsWindow/LiveKit media session. No production edits, so these are preserved pre-migration captures, not a migration before/after claim.'}
(out/'baseline-summary.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:len(v) if isinstance(v,list) else v for k,v in summary.items()}))
