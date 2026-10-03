import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { build } from 'vite'
import tailwindcss from '@tailwindcss/vite'

const base = '531a8be1c112d830f76d969b561c793678b19a3b', root = path.resolve('.git/design03'), manifest = []
fs.mkdirSync(root, { recursive: true })
const archive = execFileSync('git', ['archive', base, 'client'], { maxBuffer: 32 * 1024 * 1024 })
fs.writeFileSync(path.join(root, 'client.tar'), archive)
for (const side of process.argv.slice(2).length ? process.argv.slice(2) : ['base', 'head']) {
  const dir = path.join(root, side)
  fs.mkdirSync(path.join(dir, 'tests/fixtures'), { recursive: true })
  execFileSync('tar', ['-xf', path.join(root, 'client.tar'), '-C', dir])
  const overlay = ['src/shared/components/Button.tsx', 'src/shared/components/IconButton.tsx', 'src/shared/styles/primitives.css']
  if (side === 'head') for (const file of overlay) fs.copyFileSync('client/' + file, path.join(dir, 'client', file))
  fs.copyFileSync('tests/fixtures/button-migration-preview.tsx', path.join(dir, 'tests/fixtures/button-migration-preview.tsx'))
  const bootstrap = fs.readFileSync('tests/fixtures/spaces-visual-bootstrap.js', 'utf8'), observer = fs.readFileSync('tests/fixtures/final-observer.js', 'utf8')
  fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>SyncUp Button verification</title><script>${bootstrap}</script><script>${observer}</script></head><body><div id="root"></div><script type="module" src="./tests/fixtures/button-migration-preview.tsx"></script></body></html>`)
  await build({ configFile: false, root: dir, base: './', logLevel: 'error', plugins: [tailwindcss({ optimize: false })], build: { outDir: 'dist', emptyOutDir: true } })
  const hash = input => createHash('sha256').update(input).digest('hex')
  manifest.push({ side, base, archiveSHA256: hash(archive), fixtureSHA256: hash(fs.readFileSync('tests/fixtures/button-migration-preview.tsx')), bootstrapSHA256: hash(bootstrap), overlaySHA256: Object.fromEntries(overlay.map(file => [file, hash(fs.readFileSync(path.join(dir, 'client', file)))])), cssSHA256: Object.fromEntries(fs.readdirSync(path.join(dir, 'dist/assets')).filter(file => file.endsWith('.css')).map(file => [file, hash(fs.readFileSync(path.join(dir, 'dist/assets', file)))])) })
}
fs.writeFileSync(path.join(root, 'build-' + manifest.map(x => x.side).join('-') + '.json'), JSON.stringify(manifest, null, 2))
