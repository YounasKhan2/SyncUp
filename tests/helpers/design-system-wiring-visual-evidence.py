import base64,gzip,hashlib,json,runpy,sys
from pathlib import Path

compare=runpy.run_path('tests/helpers/spaces-visual-pixels.py')['compare']
source=Path(sys.argv[1] if len(sys.argv)>1 else '.git/design02/paired-captures');historic=Path('.git/design02/historical');out=Path('docs/design-system/evidence-02')
# Restore historical artifacts from checked-in immutable archives; never capture
# a replacement baseline. Every restored file is authenticated against its hash.
historic.mkdir(parents=True,exist_ok=True)
original=Path('docs/design-system/evidence')
with gzip.open(original/'baseline-rasters.ndjson.gz','rt') as f:rasters={r['sha256']:base64.b64decode(r['base64']) for r in map(json.loads,f)}
with gzip.open(original/'baseline-snapshots.ndjson.gz','rt') as f:
 for r in map(json.loads,f):
  target=historic/r['file'];target.parent.mkdir(parents=True,exist_ok=True)
  if not target.exists():target.write_bytes(r['text'].encode())
  assert hashlib.sha256(target.read_bytes()).hexdigest()==r['sha256']
with gzip.open(original/'baseline-manifest.json.gz','rt') as f:manifest=json.load(f)
for r in manifest:
 if r['file'].endswith('.jpg'):
  target=historic/r['file'];target.parent.mkdir(parents=True,exist_ok=True)
  if not target.exists():target.write_bytes(rasters[r['sha256']])
  assert hashlib.sha256(target.read_bytes()).hexdigest()==r['sha256']
rows=[];all_extra=set();total_nodes=0;total_properties=0

def nodes(state):
 result=sum(state['nodes'],[])
 assert all(isinstance(n,dict) for n in result)
 for n in result:
  assert all(isinstance(chunk,dict) and len(chunk)<=100 for chunk in n['style'])
 return result

def normalized(n):return {**n,'style':{k:v for chunk in n['style'] for k,v in chunk.items()}}

def tree_nodes(n):
 if not isinstance(n,dict):raise AssertionError('Truncated historical DOM')
 if 'tag' in n:
  yield n
  for child in n.get('children',[]):yield from tree_nodes(child)

def structure(n):
 if isinstance(n,dict):return {k:structure(v) for k,v in n.items() if k!='style'}
 if isinstance(n,list):return list(map(structure,n))
 return n

for base_file in sorted(historic.glob('*.json')):
 identity=base_file.stem
 head_file=source/(identity+'.json')
 if not head_file.exists():continue
 base=json.loads(base_file.read_text());head=json.loads(head_file.read_text())
 supplemental=json.loads((source/(identity+'-supplemental-base.json')).read_text());complete=json.loads((source/(identity+'-full-head.json')).read_text())
 left=nodes(supplemental);right=nodes(complete)
 assert len(left)==len(right),(identity,len(left),len(right))
 assert {k:v for k,v in supplemental.items() if k!='nodes'}=={k:v for k,v in complete.items() if k!='nodes'}
 full_props=0;extras=set()
 for i,(a,b) in enumerate(zip(left,right)):
  a=normalized(a);b=normalized(b)
  assert {k:v for k,v in a.items() if k!='style'}=={k:v for k,v in b.items() if k!='style'},(identity,i,'structure/bounds/focus')
  for key,value in a['style'].items():assert b['style'].get(key)==value,(identity,i,key,value,b['style'].get(key))
  for key in b['style'].keys()-a['style'].keys():assert key.startswith(('--ds-','--ui-')),(identity,key);extras.add(key)
  full_props+=len(a['style'])
 assert structure(base)==structure(head),(identity,'historical structural mismatch')
 recorded=0;truncated=[]
 def recorded_node(record,index,path='root'):
  global recorded
  if not isinstance(record,dict):truncated.append(path);return
  full=normalized(right[index])
  if 'tag' not in record:return
  for key in ['tag','attributes','value','bounds']:
   if key in record:assert record[key]==full[key],(identity,path,key)
  if isinstance(record.get('style'),dict):
   for key,value in record['style'].items():assert full['style'].get(key)==value,(identity,path,key,value,full['style'].get(key));recorded+=1
  else:truncated.append(path+'/style')
  children=[c for c in full['children'] if 'element' in c or c.get('type')==3]
  if isinstance(record.get('children'),list):
   assert len(record['children'])==len(children),(identity,path,'child count')
   for i,(old,child) in enumerate(zip(record['children'],children)):
    if 'element' in child:recorded_node(old,child['element'],path+'/'+str(i))
    elif isinstance(old,dict):assert old['text']==child['text'],(identity,path,'text')
  else:truncated.append(path+'/children')
 recorded_node(base['tree'],2)
 base['regions'].append({'label':'product-root','bounds':left[2]['bounds'],'display':normalized(left[2])['style']['display']})
 head['regions'].append({'label':'product-root','bounds':right[2]['bounds'],'display':normalized(right[2])['style']['display']})
 comparisons=[]
 for repeat in (1,2,3):comparisons.append(compare(historic/f'{identity}-{repeat}.jpg',source/f'{identity}-{repeat}.jpg',base,'historical-to-head'))
 for a,b in [(1,2),(1,3),(2,3)]:comparisons.append(compare(source/f'{identity}-{a}.jpg',source/f'{identity}-{b}.jpg',head,'same-unchanged-head'))
 if (source/f'paired-base-{identity}-1.jpg').exists():
  for repeat in (1,2,3):
   comparisons.append(compare(source/f'paired-base-{identity}-{repeat}.jpg',source/f'{identity}-{repeat}.jpg',base,'paired-current-base-to-head'))
   comparisons.append(compare(historic/f'{identity}-{repeat}.jpg',source/f'paired-base-{identity}-{repeat}.jpg',base,'historical-to-same-unchanged-base'))
  for a,b in [(1,2),(1,3),(2,3)]:comparisons.append(compare(source/f'paired-base-{identity}-{a}.jpg',source/f'paired-base-{identity}-{b}.jpg',base,'same-unchanged-base'))

 frames=json.loads((source/'warmups'/f'{identity}.json').read_text())['frames']
 for a,b in zip(frames,frames[1:]):comparisons.append(compare(source/a['file'],source/b['file'],head,'warmup'))
 comparisons.append(compare(source/frames[-1]['file'],source/f'{identity}-1.jpg',head,'warmup-to-final'))
 base_warmup=source/'warmups'/f'paired-base-{identity}.json'
 if base_warmup.exists():
  frames=json.loads(base_warmup.read_text())['frames']
  for a,b in zip(frames,frames[1:]):comparisons.append(compare(source/a['file'],source/b['file'],base,'base-warmup'))
  comparisons.append(compare(source/frames[-1]['file'],source/f'paired-base-{identity}-1.jpg',base,'base-warmup-to-final'))

 rows.append({'id':identity,'fullNodes':len(left),'fullExistingComputedProperties':full_props,'historicalRecordedComputedProperties':recorded,'historicalTruncatedLocations':truncated,'exactDOMClassesIDsARIAChildOrderValuesBoundsFocus':True,'exactExistingStyles':True,'addedInfrastructureVariables':sorted(extras),'comparisons':comparisons})
 total_nodes+=len(left);total_properties+=full_props;all_extra.update(extras)

assert len(rows)==64,'Complete 64-case evidence is required'
with gzip.open(out/'visual-comparisons.json.gz','wt',encoding='utf8') as f:json.dump(rows,f)
comparisons=[c for row in rows for c in row['comparisons']]
summary={'base':'d9324b16475783681aece801fcb5b0a7935ad77d','historicalRasterBase':'0c74acf8f54a7dc1a8a235eae43dea9893d264fd','cases':len(rows),'headFinalScreenshots':len(rows)*3,'completeElementObservationsPerSide':total_nodes,'comparedExistingComputedProperties':total_properties,'addedInfrastructureVariables':sorted(all_extra),'comparisons':len(comparisons),'byteEqual':sum(c['bytesEqual'] for c in comparisons),'pixelEqual':sum(c['changedPixels']==0 for c in comparisons),'differences':[c for c in comparisons if c['changedPixels']],'historicalLimitation':'Historical objects retained only first 200 properties and deep structures were truncated by serializer. Every recorded field is checked, supplemented by flat/chunked complete-style observations of unchanged required base. No historical raster regenerated.'}
(out/'visual-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:len(v) if isinstance(v,list) else v for k,v in summary.items()}))

# Preserve original raw observations and rasters, deduplicated by exact byte hash.
manifest=[];seen=set()
with gzip.open(out/'visual-rasters.ndjson.gz','wt') as rasters,gzip.open(out/'visual-snapshots.ndjson.gz','wt') as snapshots:
 for p in sorted(source.rglob('*')):
  if not p.is_file():continue
  data=p.read_bytes();digest=hashlib.sha256(data).hexdigest();name=p.relative_to(source).as_posix();manifest.append({'file':name,'sha256':digest,'bytes':len(data)})
  if p.suffix=='.jpg':
   if digest not in seen:rasters.write(json.dumps({'sha256':digest,'base64':base64.b64encode(data).decode()})+'\n');seen.add(digest)
  else:snapshots.write(json.dumps({'file':name,'sha256':digest,'text':data.decode()})+'\n')
with gzip.open(out/'visual-manifest.json.gz','wt') as f:json.dump(manifest,f)
