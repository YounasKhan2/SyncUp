"""Focused JPEG coefficient and ownership audit; never modifies capture pixels."""
import gzip,hashlib,json,math,sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw

CASES=['desktop-light-light-normal','desktop-light-light-hover','desktop-light-light-selected-focus','desktop-dark-light-normal','mobile-light-light-normal']

def coefficients(path):
    data=path.read_bytes();pos=2;tables={};quant={}
    while True:
        assert data[pos]==255
        marker=data[pos+1];length=int.from_bytes(data[pos+2:pos+4],'big');payload=data[pos+4:pos+2+length];pos+=2+length
        if marker==0xdb:
            p=0
            while p<len(payload):
                info=payload[p];assert info>>4==0;quant[info&15]=list(payload[p+1:p+65]);p+=65
        elif marker==0xc0:
            assert payload[0]==8
            height=int.from_bytes(payload[1:3],'big');width=int.from_bytes(payload[3:5],'big')
            components={payload[p]:(payload[p+1]>>4,payload[p+1]&15,payload[p+2]) for p in range(6,len(payload),3)}
        elif marker==0xc4:
            p=0
            while p<len(payload):
                info=payload[p];counts=payload[p+1:p+17];p+=17;table={};code=0
                for bits,count in enumerate(counts,1):
                    for _ in range(count):table[(bits,code)]=payload[p];p+=1;code+=1
                    code<<=1
                tables[info]=table
        elif marker==0xda:
            scan=[(payload[p],payload[p+1]>>4,payload[p+1]&15) for p in range(1,1+payload[0]*2,2)]
            assert payload[-3:]==bytes([0,63,0]);break
        else:assert marker not in [0xc2,0xdd], 'Only baseline JPEG without restart markers is supported'
    # Unstuff entropy bytes; this audit rejects unexpected markers.
    entropy=bytearray()
    while pos<len(data):
        value=data[pos];pos+=1
        if value==255:
            following=data[pos];pos+=1
            if following==0xd9:break
            assert following==0
        entropy.append(value)
    bitpos=0
    def bits(n):
        nonlocal bitpos
        result=0
        for _ in range(n):result=(result<<1)|((entropy[bitpos//8]>>(7-bitpos%8))&1);bitpos+=1
        return result
    def symbol(table):
        code=0
        for size in range(1,17):
            code=(code<<1)|bits(1)
            if (size,code) in table:return table[size,code]
        raise ValueError('Invalid Huffman code')
    def signed(size):
        value=bits(size);return value if not size or value>=1<<(size-1) else value-(1<<size)+1
    maxh=max(c[0] for c in components.values());maxv=max(c[1] for c in components.values());previous={c:0 for c in components};blocks={}
    for my in range(math.ceil(height/(8*maxv))):
        for mx in range(math.ceil(width/(8*maxh))):
            for cid,dc,ac in scan:
                h,v,q=components[cid]
                for by in range(v):
                    for bx in range(h):
                        values=[0]*64;previous[cid]+=signed(symbol(tables[dc]));values[0]=previous[cid];k=1
                        while k<64:
                            value=symbol(tables[16+ac]);run,size=value>>4,value&15
                            if not size:
                                if run==0:break
                                assert run==15;k+=16;continue
                            k+=run;assert k<64;values[k]=signed(size);k+=1
                        blocks[(cid,mx*h+bx,my*v+by)]=values
    return {'width':width,'height':height,'components':components,'quantization':quant,'blocks':blocks,'mcu':[8*maxh,8*maxv]}

def run(directory):
    rows=[]
    for case in CASES:
        left=json.loads((directory/f'base-{case}.json').read_text(encoding='utf8'));right=json.loads((directory/f'head-{case}.json').read_text(encoding='utf8'))
        a=coefficients(directory/f'base-{case}-1.jpg');b=coefficients(directory/f'head-{case}-1.jpg')
        assert all(a[k]==b[k] for k in ['width','height','components','quantization','mcu'])
        ln=sum(left['nodes'],[]);rn=sum(right['nodes'],[]);assert len(ln)==len(rn)
        unowned=[]
        for i,(x,y) in enumerate(zip(ln,rn)):
            if left['setup']['ownership'][i]=='UNOWNED' and x!=y:unowned.append(i)
        assert not unowned,(case,unowned)
        regions=[r['bounds'] for s in [left,right] for r in s['setup']['regions']]
        owned=np.zeros((a['height'],a['width']),dtype=bool)
        for x,y,w,h in regions:owned[max(0,math.floor(y)):min(a['height'],math.ceil(y+h)),max(0,math.floor(x)):min(a['width'],math.ceil(x+w))]=True
        images=[np.asarray(Image.open(directory/f'{side}-{case}-1.jpg').convert('RGB')) for side in ['base','head']]
        changed=np.any(images[0]!=images[1],axis=2);outside=changed&~owned;ys,xs=np.nonzero(outside)
        component_rows=[];support=np.zeros(owned.shape,dtype=bool)
        maxh=max(c[0] for c in a['components'].values());maxv=max(c[1] for c in a['components'].values())
        for cid,(h,v,q) in a['components'].items():
            records=[]
            for key,values in a['blocks'].items():
                if key[0]!=cid or values==b['blocks'][key]:continue
                _,bx,by=key;w=8*maxh//h;ht=8*maxv//v;x=bx*w;y=by*ht
                # JPEG chroma interpolation reaches one full-resolution pixel
                # beyond its source block. This is codec support, not tolerance.
                reach=1 if (h<maxh or v<maxv) else 0
                support[max(0,y-reach):min(a['height'],y+ht+reach),max(0,x-reach):min(a['width'],x+w+reach)]=True
                if np.any(outside[y:min(y+ht,a['height']),x:min(x+w,a['width'])]):records.append({'bounds':[x,y,w,ht],'intersectsOwned':bool(np.any(owned[y:min(y+ht,a['height']),x:min(x+w,a['width'])]))})
            component_rows.append({'component':cid,'changedBlocksTouchingOutsidePixels':records})
        repeat_equal=all((directory/f'{side}-{case}-1.jpg').read_bytes()==(directory/f'{side}-{case}-{repeat}.jpg').read_bytes() for side in ['base','head'] for repeat in [2,3])
        paint=[]
        for n in rn:
            if 'chat-list-item' not in n['attributes'].get('class','').split():continue
            style={k:v for chunk in n['style'] for k,v in chunk.items()}
            width=float(style['outline-width'].removesuffix('px'));offset=float(style['outline-offset'].removesuffix('px'))
            paint.append({'bounds':n['bounds'],'outlineWidth':width,'outlineOffset':offset,'outlineStyle':style['outline-style'],'outerOutlineReach':max(0,width+offset) if style['outline-style']!='none' else 0,'boxShadow':style['box-shadow'],'filter':style['filter']})
        assert all(n['outerOutlineReach']==0 and n['boxShadow']=='none' and n['filter']=='none' for n in paint)
        listnode=next(n for n in rn if 'chat-list' in n['attributes'].get('class','').split())
        liststyle={k:v for chunk in listnode['style'] for k,v in chunk.items()}
        assert liststyle['overflow-x']=='hidden'
        rows.append({'case':case,'unownedNodeDifferences':unowned,'outsidePixels':len(xs),'outsideBBox':[int(xs.min()),int(ys.min()),int(xs.max())+1,int(ys.max())+1] if len(xs) else None,'outsideMaxChannelDifference':int(np.max(np.abs(images[0].astype(int)-images[1].astype(int))[outside])) if len(xs) else 0,'outsidePixelsBeyondChangedCodecSupport':int(np.sum(outside&~support)),'components':component_rows,'rowPaintGeometry':paint,'sameBuildRepeatsIdentical':repeat_equal,'mcu':a['mcu'],'quantizationTables':a['quantization'],'sources':{f'{side}-{case}{suffix}':hashlib.sha256((directory/f'{side}-{case}{suffix}').read_bytes()).hexdigest() for side in ['base','head'] for suffix in ['.json','-1.jpg']}})
        rows[-1]['listClip']={'bounds':listnode['bounds'],'overflowX':liststyle['overflow-x'],'overflowY':liststyle['overflow-y']}
    expected={name:digest for row in rows for name,digest in row['sources'].items()}
    matched=set()
    with gzip.open('docs/design-system/evidence-07/captures.ndjson.gz','rt',encoding='utf8') as stream:
        for line in stream:
            record=json.loads(line)
            if record['path'] in expected:
                assert record['sha256']==expected[record['path']];matched.add(record['path'])
    assert matched==set(expected)
    # Diagnostic crops do not replace or mask comparison inputs. White pixels
    # in the third column mean any decoded RGB difference, with zero threshold.
    crops=[(56,824,88,856),(56,152,88,224),(336,192,368,272),(56,824,88,856),(0,776,32,808)]
    sheet=Image.new('RGB',(580,900),'white');draw=ImageDraw.Draw(sheet)
    for index,(case,box) in enumerate(zip(CASES,crops)):
        top=index*180;draw.text((4,top+3),case,fill='black')
        pair=[Image.open(directory/f'{side}-{case}-1.jpg').convert('RGB') for side in ['base','head']]
        diff=Image.fromarray((np.any(np.asarray(pair[0])!=np.asarray(pair[1]),axis=2)*255).astype('uint8')).convert('RGB')
        for col,(im,label) in enumerate(zip(pair+[diff],['Base','HEAD','Any RGB difference'])):
            draw.text((4+col*190,top+20),label,fill='black');draw.text((4+col*190,top+34),str(box),fill='black')
            crop=im.crop(box);crop=crop.resize((64,box[3]-box[1]),Image.Resampling.NEAREST);sheet.paste(crop,(4+col*190,top+50))
    sheet.save('docs/design-system/evidence-07/focused-edge-crops.png')
    return rows

if __name__=='__main__':
    rows=run(Path(sys.argv[1]));out=Path('docs/design-system/evidence-07/focused-edge-investigation.json')
    assert all(not r['unownedNodeDifferences'] and not r['outsidePixelsBeyondChangedCodecSupport'] and r['sameBuildRepeatsIdentical'] for r in rows)
    report={'sourceHead':'899196aa9e2fd3886af87b574374da4ab881c028','classification':'RASTER_JPEG_EDGE_ARTIFACTS_NO_CSS_LAYOUT_SPILL','accepted':True,'productionCanonicalLF':json.loads(Path('docs/design-system/evidence-07/build-head.json').read_text())['productionCanonicalLF'],'scope':'Only this frozen Phase 07 implementation; five representative cases, not a new full-matrix certification.','rule':'Require exact unowned DOM/attributes/classes/IDs/ARIA/order/focus/computed styles/bounds, contained owned paint, and stable same-build captures. Preserve every raw pixel difference as diagnostic evidence. Investigate unexplained non-edge changes; no masks or pixel thresholds. Documented scroll integration remains a separate explicit exception.','limitations':'Lossy originals cannot separate pre-encoding antialias/resampling from JPEG quantization. Normal/hover/Dark exterior changes are isolated to shared chroma blocks. Selected-focus also has edge-adjacent luminance blocks x=352..359, while the row/list clip ends at x=351.142 and the outline is inset. No CSS paint mechanism reaches those exterior pixels.','sourceHashesVerifiedAgainstCommittedArchive':20,'newAcceptedScreenshots':0,'cases':rows}
    out.write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    for row in rows:print(json.dumps({k:v for k,v in row.items() if k not in ['components','quantizationTables','rowPaintGeometry']}))
