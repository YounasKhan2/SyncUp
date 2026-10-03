import fs from 'node:fs'
import path from 'node:path'
import {build} from 'vite'
import tailwindcss from '@tailwindcss/vite'

export const proofClasses = [
  'ui:bg-canvas', 'ui:bg-surface', 'ui:bg-brand', 'ui:bg-brand-hover',
  'ui:text-primary', 'ui:text-secondary', 'ui:text-muted', 'ui:text-brand-foreground',
  'ui:border-default', 'ui:border-strong', 'ui:ring-focus',
  ...['display','h1','h2','h3','body-lg','body','body-sm','label','caption','overline'].map(x=>`ui:text-${x}`),
  'ui:p-1', 'ui:gap-panel', 'ui:rounded-xs', 'ui:rounded-full', 'ui:shadow-raised', 'ui:shadow-modal',
  'ui:duration-fast', 'ui:duration-normal', 'ui:duration-slow', 'ui:ease-standard', 'ui:z-call-overlay', 'ui:z-a11y',
  'ui:two-pane:bg-canvas', 'ui:workspace-wide:p-7',
]

export async function buildProof(directory = '.git/design02/proof') {
  const root = path.resolve(directory)
  fs.mkdirSync(root, {recursive:true})
  const entry = path.relative(root, path.resolve('client/src/index.css')).replaceAll('\\','/')
  fs.writeFileSync(path.join(root,'entry.css'), `@import '${entry}';\n@source './proof.tsx';\n`)
  fs.writeFileSync(path.join(root,'proof.tsx'), `export const classes = ${JSON.stringify(proofClasses)}\n`)
  const probes = proofClasses.map((name,index)=>`<div id="probe-${index}" class="${name}">Proof ${index}</div>`).join('')
  // Test-only fixture: OS preference is stabilized before imports, then the
  // unchanged production appearance function resolves the selected preference.
  const bootstrap = fs.readFileSync('tests/fixtures/spaces-visual-bootstrap.js','utf8')
  const appearance = path.relative(root,path.resolve('client/src/shared/appearance.ts')).replaceAll('\\','/')
  fs.writeFileSync(path.join(root,'entry.ts'), `import {applyAppearancePreference} from '${appearance}';const p=new URLSearchParams(location.search);applyAppearancePreference(p.get('theme')??'light');document.documentElement.dataset.proofReady='true';`)
  fs.writeFileSync(path.join(root,'index.html'),`<!doctype html><html><head><meta charset="UTF-8"><script>${bootstrap}</script><link rel="stylesheet" href="./entry.css"></head><body>${probes}<script type="module" src="./entry.ts"></script></body></html>`)
  await build({configFile:false,root,base:'./',plugins:[tailwindcss({optimize:false})],logLevel:'error',build:{outDir:'dist',emptyOutDir:true,cssMinify:false}})
  const files=fs.readdirSync(path.join(root,'dist/assets')).filter(x=>x.endsWith('.css'))
  return {root,classes:proofClasses,css:files.map(x=>fs.readFileSync(path.join(root,'dist/assets',x),'utf8')).join('\n')}
}

if (process.argv[1]?.endsWith('design-system-wiring-proof.mjs')) {
  const result=await buildProof()
  fs.writeFileSync('docs/design-system/evidence-02/utility-proof.css',result.css)
  console.log(JSON.stringify({classes:result.classes.length,root:result.root}))
}
