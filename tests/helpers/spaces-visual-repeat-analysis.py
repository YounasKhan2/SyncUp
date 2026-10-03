"""Quantify unchanged-build navigation variability; preserve every comparison."""
import importlib.util
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('pixels', Path(__file__).with_name('spaces-visual-pixels.py'))
pixels = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pixels)
work = Path('.git/spaces-visual-correction')
out = Path('docs/architecture/component-phase-04-evidence/visual-correction')
stages = ['raw-first-pass', 'stabilized-captures', 'recheck-1', 'recheck-2', 'recheck-3']
rows = []
for scene in ['announcement', 'private']:
    identity = f'desktop-system-dark-{scene}'
    for side in ['base', 'head']:
        for i, first in enumerate(stages):
            for second in stages[i+1:]:
                state = json.loads((work/first/f'{side}-{identity}.json').read_text())
                row = pixels.compare(work/first/f'{side}-{identity}-1.jpg', work/second/f'{side}-{identity}-1.jpg', state, 'same-unchanged-build-across-navigation')
                row.update(scene=scene, side=side, firstStage=first, secondStage=second)
                rows.append(row)
(out/'navigation-repeat-comparisons.json').write_text(json.dumps(rows, indent=2)+'\n')
print(json.dumps({'comparisons': len(rows), 'identical': sum(row['changedPixels'] == 0 for row in rows), 'differences': [{'scene': r['scene'], 'side': r['side'], 'first': r['firstStage'], 'second': r['secondStage'], 'pixels': r['changedPixels'], 'percent': r['changedPercent'], 'bbox': r['bbox']} for r in rows if r['changedPixels']]}, indent=2))
