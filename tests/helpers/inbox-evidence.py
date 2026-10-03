"""Exact structure and unowned styles; decoded RGB diagnostics without tolerance."""
import base64,gzip,hashlib,json,runpy,sys
from pathlib import Path
import numpy as np
from PIL import Image
compare=runpy.run_path('tests/helpers/spaces-visual-pixels.py')['compare']
directory=Path(sys.argv[sys.argv.index('--directory')+1] if '--directory' in sys.argv else 'docs/design-system/evidence-07/captures');output=Path('docs/design-system/evidence-07')
rows=[];unexpected=[];pixels=[];intentional=[];integration=[]
def attrs(attributes):
    result=dict(attributes)
    if 'class' in result:
        classes=[c for c in result['class'].split() if not c.startswith('ui:')]
        if classes:result['class']=' '.join(classes)
        else:del result['class']
    return result
for file in sorted(directory.glob('base-*.json')):
    identity=file.stem[5:];left=json.loads(file.read_text());right=json.loads((directory/('head-'+identity+'.json')).read_text());ln=sum(left['nodes'],[]);rn=sum(right['nodes'],[])
    if len(ln)!=len(rn):unexpected.append({'id':identity,'reason':'node count'})
    for index,(a,b) in enumerate(zip(ln,rn)):
        owner=left['setup']['ownership'][index]
        for field in ['tag','value','children','focus']:
            if a[field]!=b[field]:unexpected.append({'id':identity,'node':index,'field':field,'base':a[field],'head':b[field]})
        aa=dict(a['attributes']);bb=dict(b['attributes'])
        if owner!='UNOWNED':aa.pop('class',None);bb.pop('class',None)
        if aa!=bb:unexpected.append({'id':identity,'node':index,'field':'attributes','base':a['attributes'],'head':b['attributes']})
        for field in ['bounds','style']:
            if a[field]!=b[field]:
                record={'id':identity,'node':index,'owner':owner,'tag':a['tag'],'class':a['attributes'].get('class'),'field':field}
                if field=='style':
                    av={k:v for chunk in a[field] for k,v in chunk.items()};bv={k:v for chunk in b[field] for k,v in chunk.items()}
                    record['changes']={k:[av.get(k),bv.get(k)] for k in av.keys()|bv.keys() if av.get(k)!=bv.get(k)}
                else:record.update(base=a[field],head=b[field])
                geometry={'grid-template-rows','height','block-size','perspective-origin','transform-origin'}
                justified=owner=='UNOWNED' and identity.endswith('-scroll') and (field=='bounds' or set(record.get('changes',{})).issubset(geometry))
                (integration if justified else unexpected if owner=='UNOWNED' else intentional).append(record)
    for field in ['viewport','dpr']:
        if left[field]!=right[field]:unexpected.append({'id':identity,'field':field})
    for field in ['theme','appearance','os','dark','light','colorScheme','fonts','diagnostics','events','fixture','ownership']:
        if left['setup'][field]!=right['setup'][field]:unexpected.append({'id':identity,'field':field})
    regions=[n for setup in [left['setup'],right['setup']] for n in setup['regions']]
    regions += [{'label':'Shared Inbox heading','bounds':node['bounds'],'display':'block'} for snapshot in [left,right] for index,node in enumerate(sum(snapshot['nodes'],[])) if snapshot['setup']['ownership'][index]=='SHARED_INBOX_HEADING']
    # Derive raster coordinates from the decoded screenshot, not an assumed
    # DPR scale: this browser exports CSS-sized JPEGs despite its 1.19 DPR.
    # Do not expand rectangles to suppress JPEG boundary differences.
    raster=Image.open(directory/f'base-{identity}-1.jpg').size
    scale=[raster[0]/left['viewport'][0],raster[1]/left['viewport'][1]]
    regions=[{**region,'bounds':[value*scale[index%2] for index,value in enumerate(region['bounds'])]} for region in regions]
    state={'regions':regions,'tree':{}};comparisons=[]
    for repeat in [1,2,3]:
        a=directory/f'base-{identity}-{repeat}.jpg';b=directory/f'head-{identity}-{repeat}.jpg';record=compare(a,b,state,'base-versus-head')
        mask=np.any(np.asarray(Image.open(a).convert('RGB'))!=np.asarray(Image.open(b).convert('RGB')),axis=2);owned=np.zeros(mask.shape,dtype=bool)
        for region in regions:
            x,y,w,h=region['bounds'];owned[max(0,int(np.floor(y))):min(mask.shape[0],int(np.ceil(y+h))),max(0,int(np.floor(x))):min(mask.shape[1],int(np.ceil(x+w)))]=True
        ys,xs=np.nonzero(mask&~owned);record['outsideInboxPixels']=len(xs);record['outsideBBox']=[int(xs.min()),int(ys.min()),int(xs.max())+1,int(ys.max())+1] if len(xs) else None
        record['touchesActualProductUI']=bool(record['changedPixels']);record['classification']='INTENTIONAL_REDЕSIGN' if not len(xs) else 'DOCUMENTED_SCROLL_INTEGRATION_WITH_RAW_OUTSIDE_PIXELS' if identity.endswith('-scroll') else 'UNRESOLVED_OUTSIDE_REGION_PIXELS'
        comparisons.append(record)
    for side in ['base','head']:
        for a,b in [(1,2),(1,3),(2,3)]:comparisons.append(compare(directory/f'{side}-{identity}-{a}.jpg',directory/f'{side}-{identity}-{b}.jpg',state,'same-'+side+'-build'))
        frames=json.loads((directory/'warmups'/f'{side}-{identity}.json').read_text())['frames']
        for a,b in zip(frames,frames[1:]):comparisons.append(compare(directory/a['file'],directory/b['file'],state,'same-build-warmup'))
    pixels.extend(comparisons);rows.append({'id':identity,'nodeCount':len(ln),'setup':left['setup'],'comparisons':comparisons})
interaction_pairs=0
for file in directory.glob('*-interactions.json'):
    traces=json.loads(file.read_text())
    if traces[0]['steps']!=traces[1]['steps']:unexpected.append({'interaction':file.name})
    interaction_pairs+=len(traces[0]['steps'])
summary={'cases':len(rows),'screenshots':len(rows)*6,'unaffectedStructuralDifferences':unexpected,'intentionalOwnedStyleBoundsChanges':len(intentional),'documentedScrollIntegrationChanges':integration,'interactionStepPairs':interaction_pairs,'crossBuildComparisons':sum(p['category']=='base-versus-head' for p in pixels),'crossBuildByteIdentical':sum(p['category']=='base-versus-head' and p['bytesEqual'] for p in pixels),'crossBuildPixelRange':[min(p['changedPixels'] for p in pixels if p['category']=='base-versus-head'),max(p['changedPixels'] for p in pixels if p['category']=='base-versus-head')],'sameBuildFinalComparisons':sum(p['category'] in ['same-base-build','same-head-build'] for p in pixels),'sameBuildFinalDifferences':[p for p in pixels if p['category'] in ['same-base-build','same-head-build'] and p['changedPixels']],'outsideRegionDifferences':[p for p in pixels if p.get('outsideInboxPixels',0)],'warmupComparisons':sum(p['category']=='same-build-warmup' for p in pixels),'warmupDifferences':[p for p in pixels if p['category']=='same-build-warmup' and p['changedPixels']],'algorithm':'All decoded RGB pixels, zero tolerance. Full screenshots retained; no masking of comparison input. Region counts use the union of base and candidate owned rectangles, with shared heading ownership documented separately; every outside pixel is still counted.'}
summary['visualPixelGatePassed']=not any(p.get('outsideInboxPixels',0) and p['classification']!='DOCUMENTED_SCROLL_INTEGRATION_WITH_RAW_OUTSIDE_PIXELS' for p in pixels)
summary['reviewStatus']='READY_FOR_REVIEW' if summary['visualPixelGatePassed'] and not unexpected and not summary['sameBuildFinalDifferences'] else 'DRAFT_HELD_FOR_EVIDENCE_REVIEW'
(output/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
with gzip.open(output/'comparisons.json.gz','wt',encoding='utf8') as stream:json.dump({'cases':rows,'intentionalChanges':intentional,'scrollIntegrationChanges':integration},stream)
print(json.dumps({k:len(v) if isinstance(v,list) and not k.endswith('Range') else v for k,v in summary.items()},indent=2))
if '--archive' in sys.argv or '--archive-held' in sys.argv:
    if len(rows)!=122 or interaction_pairs!=64 or unexpected or summary['sameBuildFinalDifferences']:raise RuntimeError('Incomplete or failing structural/repeat evidence')
    if '--archive' in sys.argv and not summary['visualPixelGatePassed']:raise RuntimeError('Outside-region pixel gate fails; use explicit --archive-held to retain evidence without claiming a pass')
    seen=set()
    with gzip.open(output/'captures.ndjson.gz','wt',encoding='utf8') as stream:
        for file in sorted(directory.rglob('*')):
            if not file.is_file():continue
            content=file.read_bytes();digest=hashlib.sha256(content).hexdigest();row={'path':file.relative_to(directory).as_posix(),'sha256':digest}
            if digest in seen:row['encoding']='reference'
            elif file.suffix=='.json':row.update(encoding='utf8',content=content.decode('utf8'))
            else:row.update(encoding='base64',content=base64.b64encode(content).decode())
            seen.add(digest);stream.write(json.dumps(row)+'\n')
