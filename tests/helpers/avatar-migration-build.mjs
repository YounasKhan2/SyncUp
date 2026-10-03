import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { build } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import ts from 'typescript'

const base = 'aabff6a4e15cfa73c33fd30287e1771914c3c60f', root = path.resolve('.git/design04'), manifest = []
fs.mkdirSync(root, { recursive: true })
const archive = execFileSync('git', ['archive', base, 'client'], { maxBuffer: 32 * 1024 * 1024 })
fs.writeFileSync(path.join(root, 'client.tar'), archive)
for (const side of process.argv.slice(2).length ? process.argv.slice(2) : ['base', 'head']) {
 for (const family of ['workspace', 'conversation', 'custom']) {
  const dir = path.join(root, side, family)
  fs.mkdirSync(path.join(dir, 'tests/fixtures'), { recursive: true })
  execFileSync('tar', ['-xf', path.join(root, 'client.tar'), '-C', dir])
  const overlay = ['src/shared/components/Avatar.tsx', 'src/shared/styles/platform.css']
  if (side === 'head') for (const file of overlay) fs.copyFileSync('client/' + file, path.join(dir, 'client', file))
  fs.copyFileSync('tests/fixtures/avatar-migration-preview.tsx', path.join(dir, 'tests/fixtures/avatar-migration-preview.tsx'))
  let fixture = 'avatar-migration-preview'
  if (family !== 'custom') {
    fixture = family + '-preview'
    let source = fs.readFileSync('tests/fixtures/' + fixture + '.tsx', 'utf8').replace('<nav aria-label="Fixture controls"', '<nav hidden aria-label="Fixture controls"')
    const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64"><rect width="96" height="64" fill="#76546f"/><circle cx="48" cy="25" r="15" fill="#fffcf8"/><path d="M20 64a28 28 0 0 1 56 0" fill="#d2b8cb"/></svg>')
    source = source.replace("display_name: 'Sam Rivera'", "avatar_url: " + JSON.stringify(image) + ", display_name: 'Sam Rivera'")
      .replace("display_title: 'Alex Chen'", "peer_avatar_url: '/broken-avatar', display_title: 'Alex Chen'")
      .replace("caller_name: 'Alex Chen'", "caller_avatar_url: " + JSON.stringify(image) + ", caller_name: 'Alex Chen'")
      .replace("other_name: 'Alex Chen'", "other_avatar_url: " + JSON.stringify(image) + ", other_name: 'Alex Chen'")
      .replace("displayName: 'Alex Chen'", "avatar_url: '/broken-avatar', displayName: 'Alex Chen'")
      .replace("if (initialScene === 'details')", "if (initialScene === 'details' || initialScene === 'group-details')").replace('isGroup={false} members={members}', "isGroup={initialScene === 'group-details'} members={members}")
      .replace('title="Alex Chen" subtitle=', 'title="Alex Chen" avatarUrl={' + JSON.stringify(image) + '} subtitle=')
    fs.writeFileSync(path.join(dir, 'tests/fixtures', fixture + '.tsx'), source)
  }
  const bootstrap = fs.readFileSync('tests/fixtures/spaces-visual-bootstrap.js', 'utf8'), observer = fs.readFileSync('tests/fixtures/final-observer.js', 'utf8').replace("window.addEventListener('error', (event) => record(", "window.addEventListener('error', (event) => { if (event.target instanceof HTMLImageElement && event.target.getAttribute('src') === '/broken-avatar') return; record(").replace("|| 'unknown'), true)", "|| 'unknown') }, true)")
  fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>SyncUp Avatar verification</title><script>${bootstrap}</script><script>${observer}</script></head><body><div id="root"></div><script type="module" src="./tests/fixtures/entry.ts"></script></body></html>`)
  fs.writeFileSync(path.join(dir,'tests/fixtures/entry.ts'), `import './${fixture}'\ndocument.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => { document.documentElement.dataset.visualReady = 'true' })))`)
  const isolate = {name:'avatar-fixture-only-effects', transform(source,id) {
    const owner = id.replaceAll('\\','/').match(/\/features\/(?:calls|messaging)\/(CallWindow|SearchDialog|RequestsPanel)\.tsx$/)?.[1]
    if (!owner) return
    const tree=ts.createSourceFile(id,source,99,true,ts.ScriptKind.TSX), edits=[]
    function visit(node) {
      if (ts.isCallExpression(node) && node.expression.getText(tree)==='useEffect') edits.push([node.getStart(tree),node.end,'void 0'])
      if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(tree)==='useState') edits.push([node.initializer.getStart(tree),node.initializer.end,`useAvatarState(${JSON.stringify(owner+':'+node.name.elements[0].getText(tree))}, ${node.initializer.arguments[0].getText(tree)})`])
      ts.forEachChild(node,visit)
    }
    visit(tree)
    return `import {useAvatarState} from '../../../../tests/fixtures/avatar-migration-preview'\n`+edits.sort((a,b)=>b[0]-a[0]).reduce((text,[a,b,value])=>text.slice(0,a)+value+text.slice(b),source)
  }}
  await build({ configFile: false, root: dir, base: './', logLevel: 'error', plugins: [tailwindcss({ optimize: false }), isolate], build: { outDir: 'dist', emptyOutDir: true } })
  const hash = input => createHash('sha256').update(input).digest('hex')
  manifest.push({ side, family, base, archiveSHA256: hash(archive), fixtureSHA256: hash(fs.readFileSync('tests/fixtures/avatar-migration-preview.tsx')), bootstrapSHA256: hash(bootstrap), overlaySHA256: Object.fromEntries(overlay.map(file => [file, hash(fs.readFileSync(path.join(dir, 'client', file)))])), cssSHA256: Object.fromEntries(fs.readdirSync(path.join(dir, 'dist/assets')).filter(file => file.endsWith('.css')).map(file => [file, hash(fs.readFileSync(path.join(dir, 'dist/assets', file)))])) })
 }
}
fs.writeFileSync(path.join(root, 'build-' + [...new Set(manifest.map(x => x.side))].join('-') + '.json'), JSON.stringify(manifest, null, 2))
