"""Actual computed text/focus contrast, including selected and hovered rows."""
import json,re,sys
from pathlib import Path
directory=Path(sys.argv[sys.argv.index('--directory')+1] if '--directory' in sys.argv else 'docs/design-system/evidence-07/captures');rows=[]
def rgb(value):return [float(n) for n in re.findall(r'[\d.]+',value)][:3]
def luminance(values):
    values=[v/255 for v in values];values=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in values]
    return sum(v*w for v,w in zip(values,[.2126,.7152,.0722]))
def ratio(a,b):
    a,b=luminance(a),luminance(b);return (max(a,b)+.05)/(min(a,b)+.05)
for file in sorted(directory.glob('head-*.json')):
    state=json.loads(file.read_text(encoding='utf8'));nodes=sum(state['nodes'],[])
    parents={child['element']:index for index,node in enumerate(nodes) for child in node['children'] if 'element' in child}
    def background(index):
        while True:
            style={key:value for chunk in nodes[index]['style'] for key,value in chunk.items()}
            if style['background-color']!='rgba(0, 0, 0, 0)':return rgb(style['background-color'])
            index=parents[index]
    def ancestor(index,cls):
        while index in parents:
            if cls in nodes[index]['attributes'].get('class','').split():return True
            index=parents[index]
        return False
    for index,node in enumerate(nodes):
        if state['setup']['ownership'][index]=='UNOWNED' or node['bounds'][2]<=0:continue
        style={key:value for chunk in node['style'] for key,value in chunk.items()};classes=node['attributes'].get('class','').split()
        kind='name' if node['tag']=='STRONG' and ancestor(index,'chat-row-copy') else 'preview' if node['tag']=='SMALL' and ancestor(index,'chat-row-copy') else 'timestamp' if 'chat-row-meta' in classes else 'unread' if node['tag']=='B' or 'unread-pill' in classes else 'search' if node['tag']=='SPAN' and ancestor(index,'search-box') else 'draft' if 'draft-label' in classes else 'focus' if node['focus'] and node['tag']=='BUTTON' and style['outline-style']!='none' else None
        if kind:
            foreground=style['outline-color' if kind=='focus' else 'color'];bg=background(index);value=ratio(rgb(foreground),bg);minimum=3 if kind=='focus' else 4.5
            rows.append({'case':file.stem[5:],'node':index,'kind':kind,'foreground':foreground,'background':bg,'ratio':value,'minimum':minimum,'pass':value>=minimum})
output={'measurements':rows,'minimumByKind':{kind:min(row['ratio'] for row in rows if row['kind']==kind) for kind in sorted({row['kind'] for row in rows})},'failures':[row for row in rows if not row['pass']],'scope':'Sampled redesigned Inbox only; no whole-product compliance claim.'}
Path('docs/design-system/evidence-07/contrast-measured.json').write_text(json.dumps(output,indent=2)+'\n',encoding='utf8')
print(json.dumps(output['minimumByKind']))
if output['failures']:raise RuntimeError('STOP: sampled approved token pair fails contrast')
