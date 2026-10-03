"""Measure actual computed label, badge and selected-focus token pairs."""
import json,re
from pathlib import Path
directory=Path('docs/design-system/evidence-06/captures');rows=[]
def rgb(value):return [float(n) for n in re.findall(r'[\d.]+',value)][:3]
def luminance(values):
    values=[v/255 for v in values]
    values=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in values]
    return sum(v*w for v,w in zip(values,[.2126,.7152,.0722]))
def ratio(a,b):
    a,b=luminance(a),luminance(b)
    return (max(a,b)+.05)/(min(a,b)+.05)
for size in ['desktop','mobile']:
    for theme in ['light','dark']:
        state=json.loads((directory/f'head-{size}-{theme}-light-focus.json').read_text());nodes=sum(state['nodes'],[])
        parents={child['element']:index for index,node in enumerate(nodes) for child in node['children'] if 'element' in child}
        def background(index):
            while True:
                style={key:value for chunk in nodes[index]['style'] for key,value in chunk.items()}
                if style['background-color']!='rgba(0, 0, 0, 0)':return rgb(style['background-color'])
                index=parents[index]
        for index,node in enumerate(nodes):
            if state['setup']['ownership'][index]!='NAVIGATION_OWNED' or node['bounds'][2]<=0:continue
            style={key:value for chunk in node['style'] for key,value in chunk.items()}
            label=node['tag']=='SPAN' and any(child.get('text') in ['Chats','Calls','Updates','Spaces','You'] for child in node['children'])
            badge='navigation-badge' in node['attributes'].get('class','').split()
            kind='badge' if badge else 'label' if label else 'focus' if node['focus'] and node['tag']=='BUTTON' else None
            if kind:
                foreground=style['outline-color' if kind=='focus' else 'color'];bg=background(index);value=ratio(rgb(foreground),bg);minimum=3 if kind=='focus' else 4.5
                rows.append({'size':size,'theme':theme,'node':index,'kind':kind,'foreground':foreground,'background':bg,'ratio':value,'minimum':minimum,'pass':value>=minimum})
Path('docs/design-system/evidence-06/contrast-measured.json').write_text(json.dumps(rows,indent=2)+'\n')
if any(not row['pass'] for row in rows):raise RuntimeError('STOP: approved token pair fails sampled shell contrast')
print(json.dumps({kind:min(row['ratio'] for row in rows if row['kind']==kind) for kind in ['label','badge','focus']}))
