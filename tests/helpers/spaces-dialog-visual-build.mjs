import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import { build } from 'vite'

const base = '558d9764a44fafe2b991315c20bd7a16e86f5325'
const side = process.argv[2]
if (!['base', 'head'].includes(side)) throw new Error('Specify base or head')
const work = path.resolve('.git/spaces-dialog-visual'), dir = path.join(work, side)
fs.mkdirSync(path.join(dir, 'tests/fixtures'), { recursive: true })
const archive = execFileSync('git', ['archive', base, 'client'], { maxBuffer: 32 * 1024 * 1024 })
fs.writeFileSync(path.join(work, `${side}.tar`), archive)
execFileSync('tar', ['-xf', path.join(work, `${side}.tar`), '-C', dir])
if (side === 'head') fs.cpSync('client', path.join(dir, 'client'), { recursive: true, filter: source => !source.includes('node_modules') && !source.includes(`${path.sep}dist`) })
for (const file of ['spaces-dialog-preview.tsx', 'spaces-visual-bootstrap.js', 'final-observer.js']) fs.copyFileSync(`tests/fixtures/${file}`, path.join(dir, 'tests/fixtures', file))
const bootstrap = fs.readFileSync('tests/fixtures/spaces-visual-bootstrap.js', 'utf8'), observer = fs.readFileSync('tests/fixtures/final-observer.js', 'utf8')
fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Spaces dialog verification</title><script>${bootstrap}</script><script>${observer}</script></head><body><div id="root"></div><script type="module" src="./tests/fixtures/spaces-dialog-preview.tsx"></script></body></html>`)
await build({ configFile: false, root: dir, base: './', logLevel: 'error', plugins: [{ name: 'isolated-spaces-dialog-presentation', transform(source, id) {
  if (!id.replaceAll('\\', '/').endsWith('/features/spaces/SpacesPage.tsx')) return
  const tree = ts.createSourceFile(id, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), edits = []
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(tree) === 'useState') {
      edits.push([node.initializer.getStart(tree), node.initializer.end, `useVisualState(${JSON.stringify(node.name.elements[0].getText(tree))}, ${node.initializer.arguments[0].getText(tree)})`])
    }
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useEffect') edits.push([node.getStart(tree), node.end, 'void 0'])
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return `import { useVisualState } from '../../../../tests/fixtures/spaces-dialog-preview'\n` + edits.sort((a, b) => b[0] - a[0]).reduce((value, [start, end, replacement]) => value.slice(0, start) + replacement + value.slice(end), source)
} }], build: { outDir: 'dist', emptyOutDir: true } })
const hash = data => createHash('sha256').update(data).digest('hex')
fs.writeFileSync(path.join(work, `${side}-manifest.json`), JSON.stringify({ base, side, productionSourceSHA256: hash(fs.readFileSync(path.join(dir, 'client/src/features/spaces/SpacesPage.tsx'))), bootstrapSHA256: hash(bootstrap), fixtureSHA256: hash(fs.readFileSync('tests/fixtures/spaces-dialog-preview.tsx')), htmlSHA256: hash(fs.readFileSync(path.join(dir, 'index.html'))) }, null, 2)+'\n')
