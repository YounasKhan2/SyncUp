import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import { build } from 'vite'

const base = 'b27a48aab156d02ad39331eb18bb8ad1f0e0a358'
const side = process.argv[2]
if (!['base', 'head'].includes(side)) throw new Error('Specify base or head')
const work = path.resolve('.git/account-updates-visual'), dir = path.join(work, side)
fs.mkdirSync(path.join(dir, 'tests/fixtures'), { recursive: true })
const archive = execFileSync('git', ['archive', base, 'client'], { maxBuffer: 32 * 1024 * 1024 })
fs.writeFileSync(path.join(work, `${side}.tar`), archive)
execFileSync('tar', ['-xf', path.join(work, `${side}.tar`), '-C', dir])
if (side === 'head') fs.cpSync('client', path.join(dir, 'client'), { recursive: true, filter: source => !source.includes('node_modules') && !source.includes(`${path.sep}dist`) })
for (const file of ['account-updates-preview.tsx', 'spaces-visual-bootstrap.js', 'final-observer.js']) fs.copyFileSync(`tests/fixtures/${file}`, path.join(dir, 'tests/fixtures', file))
const bootstrap = fs.readFileSync('tests/fixtures/spaces-visual-bootstrap.js', 'utf8'), observer = fs.readFileSync('tests/fixtures/final-observer.js', 'utf8')
fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Spaces dialog verification</title><script>${bootstrap}</script><script>${observer}</script></head><body><div id="root"></div><script type="module" src="./tests/fixtures/account-updates-preview.tsx"></script></body></html>`)
await build({ configFile: false, root: dir, base: './', logLevel: 'error', plugins: [{ name: 'isolated-account-updates-presentation', transform(source, id) {
  const owner = id.replaceAll('\\', '/').match(/\/features\/(?:account|spaces)\/(AccountPanel|SafetySettings|UpdatesPage)\.tsx$/)?.[1]
  if (!owner) return
  const tree = ts.createSourceFile(id, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), edits = []
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(tree) === 'useState') {
      edits.push([node.initializer.getStart(tree), node.initializer.end, `useVisualState(${JSON.stringify(owner + ':' + node.name.elements[0].getText(tree))}, ${node.initializer.arguments[0].getText(tree)})`])
    }
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect') edits.push([node.getStart(tree), node.end, 'void 0'])
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return `import { useVisualState } from '../../../../tests/fixtures/account-updates-preview'\n` + edits.sort((a, b) => b[0] - a[0]).reduce((value, [start, end, replacement]) => value.slice(0, start) + replacement + value.slice(end), source)
} }], build: { outDir: 'dist', emptyOutDir: true } })
const hash = data => createHash('sha256').update(data).digest('hex')
fs.writeFileSync(path.join(work, `${side}-manifest.json`), JSON.stringify({ base, side, productionSources: Object.fromEntries(['client/src/features/account/AccountPanel.tsx', 'client/src/features/account/SafetySettings.tsx', 'client/src/features/account/api.ts', 'client/src/features/spaces/UpdatesPage.tsx', 'client/src/features/account/components/AccountSessionsSection.tsx', 'client/src/features/spaces/components/UpdateItem.tsx'].filter(file => fs.existsSync(path.join(dir, file))).map(file => [file, hash(fs.readFileSync(path.join(dir, file)))])), bootstrapSHA256: hash(bootstrap), fixtureSHA256: hash(fs.readFileSync('tests/fixtures/account-updates-preview.tsx')), htmlSHA256: hash(fs.readFileSync(path.join(dir, 'index.html'))) }, null, 2)+'\n')
