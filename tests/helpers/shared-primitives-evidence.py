"""Compare exact node/style/bounds/native state and every decoded RGB pixel."""
import base64,gzip,hashlib,json,runpy,sys
from pathlib import Path
compare=runpy.run_path('tests/helpers/spaces-visual-pixels.py')['compare']
directory=Path('.git/design05/captures');output=Path('docs/design-system/evidence-05');differences=[];rows=[];pixels=[]
utilities={'ui-dialog-overlay':{'ui:fixed','ui:z-overlay','ui:grid','ui:place-items-center','ui:bg-overlay'},'ui-dialog':{'ui:box-border'}}
def normalize(state):
    for node in sum(state['nodes'],[]):
        classes=node['attributes'].get('class','').split()
        for marker,allowed in utilities.items():
            if marker in classes:
                node['attributes']['class']=' '.join(c for c in classes if c not in allowed)
    return state
for file in sorted(directory.glob('base-*.json')):
    identity=file.name[5:-5]
    if identity.endswith('interactions'):continue
    base=json.loads(file.read_text());head=json.loads((directory/('head-'+identity+'.json')).read_text());bn=sum(base['nodes'],[])
    if normalize(base)!=normalize(head):
        for index,(left,right)in enumerate(zip(sum(base['nodes'],[]),sum(head['nodes'],[]))):
            for key in left:
                if left[key]!=right[key]:differences.append({'id':identity,'node':index,'field':key,'base':left[key],'head':right[key]})
        for key in ['native','setup','viewport','dpr']:
            if base[key]!=head[key]:differences.append({'id':identity,'field':key,'base':base[key],'head':head[key]})
        if len(sum(base['nodes'],[]))!=len(sum(head['nodes'],[])):differences.append({'id':identity,'nodeCount':'different'})
    regions=[]
    for node in bn:
        styles={key:value for chunk in node['style'] for key,value in chunk.items()}
        if node['tag']!='HTML' and styles.get('display')!='none':regions.append({'label':node['attributes'].get('id') or node['attributes'].get('class') or node['tag'],'bounds':node['bounds'],'display':styles.get('display')})
    state={'regions':regions,'tree':{}};comparisons=[]
    for repeat in [1,2,3]:comparisons.append(compare(directory/f'base-{identity}-{repeat}.jpg',directory/f'head-{identity}-{repeat}.jpg',state,'base-versus-head'))
    for side in ['base','head']:
        for a,b in [(1,2),(1,3),(2,3)]:comparisons.append(compare(directory/f'{side}-{identity}-{a}.jpg',directory/f'{side}-{identity}-{b}.jpg',state,'same-'+side+'-build'))
        frames=json.loads((directory/'warmups'/f'{side}-{identity}.json').read_text())['frames']
        for a,b in zip(frames,frames[1:]):comparisons.append(compare(directory/a['file'],directory/b['file'],state,'same-build-warmup'))
    pixels.extend(comparisons);rows.append({'id':identity,'nodes':len(bn),'setup':base['setup'],'comparisons':comparisons})
steps=0
for size in ['desktop','mobile']:
    left=json.loads((directory/f'base-{size}-interactions.json').read_text());right=json.loads((directory/f'head-{size}-interactions.json').read_text())
    for trace in [left,right]:
        for step in trace:normalize(step['structure'])
    for a,b in zip(left,right):
        if a!=b:differences.append({'interaction':size,'step':a['step'],'base':a,'head':b})
    if len(left)!=len(right):differences.append({'interaction':size,'length':'different'})
    steps+=len(left)
summary={'cases':len(rows),'screenshots':len(rows)*6,'interactionPairs':steps,'structuralDifferences':differences,'decodedComparisons':len(pixels),'byteIdenticalComparisons':sum(p['bytesEqual'] for p in pixels),'crossBuildComparisons':sum(p['category']=='base-versus-head' for p in pixels),'crossBuildDifferences':[p for p in pixels if p['category']=='base-versus-head' and p['changedPixels']],'sameBuildDifferences':[p for p in pixels if p['category']!='base-versus-head' and p['changedPixels']],'algorithm':'All RGB pixels, zero tolerance, no masking or cropping.'}
summary.update(finalComparisons=sum(p['category']!='same-build-warmup' for p in pixels),finalByteIdenticalComparisons=sum(p['category']!='same-build-warmup' and p['bytesEqual'] for p in pixels),sameBuildFinalDifferences=[p for p in pixels if p['category'].startswith('same-') and p['category']!='same-build-warmup' and p['changedPixels']],warmupComparisons=sum(p['category']=='same-build-warmup' for p in pixels),warmupDifferences=[p for p in pixels if p['category']=='same-build-warmup' and p['changedPixels']])
(output/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
with gzip.open(output/'comparisons.json.gz','wt',encoding='utf8')as stream:json.dump(rows,stream)
if '--archive' in sys.argv:
    if len(rows)!=32 or differences or summary['crossBuildDifferences'] or summary['sameBuildFinalDifferences']:raise RuntimeError('Incomplete or failing final evidence')
    seen=set()
    with gzip.open(output/'captures.ndjson.gz','wt',encoding='utf8')as stream:
        for file in sorted(directory.rglob('*')):
            if not file.is_file():continue
            content=file.read_bytes();digest=hashlib.sha256(content).hexdigest();row={'path':file.relative_to(directory).as_posix(),'sha256':digest}
            if digest in seen:row['encoding']='reference'
            elif file.suffix=='.json':row.update(encoding='utf8',content=content.decode('utf8'))
            else:row.update(encoding='base64',content=base64.b64encode(content).decode())
            seen.add(digest);stream.write(json.dumps(row)+'\n')
print(json.dumps({k:len(v) if isinstance(v,list) else v for k,v in summary.items()},indent=2))
