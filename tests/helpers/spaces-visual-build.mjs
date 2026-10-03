import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { build } from 'vite'

const root = process.cwd()
const work = path.join(root, '.git/spaces-visual-correction')
const base = 'c8ae377c756038992dd0f02fe303e66f83a6c698'
const head = '5ec4e3532df83b68be3f695f961f115598b3761a'
const hash = value => createHash('sha256').update(value).digest('hex')
const frozen = JSON.parse(fs.readFileSync('tests/fixtures/spaces-presentation-baseline.json', 'utf8'))
const original = execFileSync('git', ['show', `${base}:client/src/features/spaces/SpacesPage.tsx`], { encoding: 'utf8' }).replace(/\r\n/g, '\n')
if (!original.includes(frozen.header.original)) throw new Error('Frozen header differs from base commit')
const manifest = { base, head, frozenBaselineSHA256: hash(fs.readFileSync('tests/fixtures/spaces-presentation-baseline.json')), builds: [] }
for (const [side, revision, fixture] of [['base', base, 'spaces-presentation-base.tsx'], ['head', head, 'spaces-presentation-preview.tsx']]) {
  const dir = path.join(work, side)
  fs.mkdirSync(path.join(dir, 'tests/fixtures'), { recursive: true })
  const archive = execFileSync('git', ['archive', revision, 'client'], { maxBuffer: 32 * 1024 * 1024 })
  fs.writeFileSync(path.join(work, `${side}.tar`), archive)
  execFileSync('tar', ['-xf', path.join(work, `${side}.tar`), '-C', dir])
  const input = fs.readFileSync(`tests/fixtures/${fixture}`, 'utf8').replace(/\r\n/g, '\n')
  // Same verification-only modifications, without changing any production CSS.
  const adapted = input.replace('<nav aria-label="Fixture controls"', '<nav hidden aria-label="Fixture controls"')
    .replace('applyAppearancePreference(initialTheme) },[])', `applyAppearancePreference(initialTheme); document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => { document.documentElement.dataset.visualReady = 'true' }))) },[])`)
  if (adapted === input || !adapted.includes('visualReady')) throw new Error('Fixture adaptation missing')
  fs.writeFileSync(path.join(dir, 'tests/fixtures/fixture.tsx'), adapted)
  const bootstrap = fs.readFileSync('tests/fixtures/spaces-visual-bootstrap.js', 'utf8')
  const observer = fs.readFileSync('tests/fixtures/final-observer.js', 'utf8')
  const html = `<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Spaces visual verification</title><script>${bootstrap}</script><script>${observer}</script></head><body><div id="root"></div><script type="module" src="./tests/fixtures/fixture.tsx"></script></body></html>`
  fs.writeFileSync(path.join(dir, 'index.html'), html)
  // Immutable production snapshots; dependencies resolve from the workspace.
  await build({ configFile: false, root: dir, base: './', logLevel: 'warn', build: { outDir: 'dist', emptyOutDir: true } })
  manifest.builds.push({ side, revision, gitArchiveSHA256: hash(archive), fixtureSHA256: hash(input), adaptedFixtureSHA256: hash(adapted), bootstrapSHA256: hash(bootstrap), htmlSHA256: hash(html) })
}
fs.writeFileSync(path.join(work, 'build-manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify(manifest, null, 2))
