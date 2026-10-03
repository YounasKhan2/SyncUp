import {execFileSync} from 'node:child_process'
import { restoreButtonMigration } from './helpers/button-migration-parity.mjs'
import { restoreAvatarMigration } from './helpers/avatar-migration-parity.mjs'
import { restoreAccountUpdates } from './helpers/account-updates-parity.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import ts from 'typescript'
import postcss from 'postcss'
import { restoreSpacesDialogs } from './helpers/spaces-dialog-parity.mjs'

const root = new URL('../', import.meta.url)
const currentFile = file => file.replace('/spaces/SpaceLegacyHistoryView.tsx', '/spaces/components/SpaceLegacyHistoryView.tsx')
const read = file => fs.readFileSync(new URL(currentFile(file), root), 'utf8').replace(/\r\n/gu, '\n')
const exists = file => fs.existsSync(new URL(file, root))
const digest = text => createHash('sha256').update(text).digest('hex')
const baseline = JSON.parse(read('tests/fixtures/ownership-baseline.json'))
const owner = 'client/src/features/spaces/types.ts'
const migrated = exists(owner)
const parse = file => ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true)
const walk = dir => fs.readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`])
const cssImports = file => [...read(file).matchAll(/@import\s+['"]([^'"]+)['"];\s*\n?/gu)].map(m => path.posix.normalize(path.posix.join(path.posix.dirname(file), m[1])))
const appFiles = () => cssImports('client/src/App.css')
const platform = () => appFiles().slice(0, -1).map(file => restoreAvatarMigration(file, read(file))).join('')

test('Ownership: all baseline type declarations retain exact fields, unions, optionality and intersections without duplicate owners', () => {
  const declarations = [...parse('client/src/shared/types.ts').statements, ...(migrated ? parse(owner).statements : [])]
  assert.ok(declarations.every(ts.isTypeAliasDeclaration), 'type modules must contain type aliases only')
  assert.equal(declarations.length, Object.keys(baseline.types).length)
  for (const [name, value] of Object.entries(baseline.types)) {
    const matching = declarations.filter(n => n.name.text === name)
    assert.equal(matching.length, 1, name)
    assert.equal(matching[0].getText(), value.declaration, name)
    const selected = name.startsWith('Space')
    assert.equal(parse(migrated && selected ? owner : 'client/src/shared/types.ts').statements.some(n => n.name?.text === name), true, name)
  }
  const selectedOwners = new Map(Object.keys(baseline.types).filter(n => n.startsWith('Space')).map(name => [name, []]))
  for (const file of walk('client/src').filter(f => /\.tsx?$/u.test(f))) {
    for (const n of parse(file).statements) if ((ts.isTypeAliasDeclaration(n) || ts.isInterfaceDeclaration(n)) && selectedOwners.has(n.name.text)) selectedOwners.get(n.name.text).push(file)
  }
  for (const [name, owners] of selectedOwners) assert.deepEqual(owners, [migrated ? owner : 'client/src/shared/types.ts'], name)
})

test('Ownership: every selected baseline consumer imports the contract directly from its current owner, never a compatibility barrel', () => {
  for (const [name, value] of Object.entries(baseline.types).filter(([name]) => name.startsWith('Space'))) {
    for (const file of value.importers) {
      const imports = parse(file).statements.filter(ts.isImportDeclaration)
      const matching = imports.filter(n => n.importClause?.namedBindings?.elements?.some(s => (s.propertyName ?? s.name).text === name))
      assert.equal(matching.length, 1, `${file}: ${name}`)
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(currentFile(file)), matching[0].moduleSpecifier.text))
      assert.equal(target, (migrated ? owner : 'client/src/shared/types.ts').replace(/\.ts$/u, ''))
      assert.equal(matching[0].importClause.isTypeOnly, true)
    }
  }
  assert.equal(parse('client/src/shared/types.ts').statements.some(ts.isExportDeclaration), false)
})

test('Ownership: selected consumer emitted JavaScript remains identical after type-import migration', () => {
  for (const [file, hash] of Object.entries(baseline.emittedConsumers)) {
    // Phase 02 relocates Workspace presentation imports in the Spaces fixture.
    // Canonicalize only those approved paths; preserve the frozen Phase 10 hash.
    let input = ['WorkspaceRail', 'MobileNavigation'].reduce((text, name) =>
      text.replaceAll(`/features/workspace/components/${name}`, `/features/workspace/${name}`), read(file))
    input = restoreAccountUpdates(file, input)
    // Phase 04 reconstructs only the frozen approved header and relocation imports.
    // The original Phase 10 emitted-JavaScript digests remain unchanged.
    if (file.endsWith('/SpacesPage.tsx')) {
      input = restoreSpacesDialogs(input)
      const header = JSON.parse(read('tests/fixtures/spaces-presentation-baseline.json')).header
      assert.ok(input.includes(header.replacement))
      input = input.replace(header.replacement, header.original)
        .replace("import { SpaceChannelHeader } from './components/SpaceChannelHeader'\n", '')
        .replace('Megaphone, Plus', 'Megaphone, Mic, Plus')
        .replaceAll("'./components/SpaceVoiceChannelView'", "'./SpaceVoiceChannelView'")
        .replaceAll("'./components/SpaceLegacyHistoryView'", "'./SpaceLegacyHistoryView'")
    }
    if (file.endsWith('/SpaceLegacyHistoryView.tsx')) input = input.replaceAll("'../../messaging/", "'../messaging/").replaceAll("'../../../shared/", "'../../shared/")
    if (file.endsWith('/spaces-preview.tsx')) for (const name of ['SpaceVoiceChannelView', 'SpaceLegacyHistoryView']) input = input.replaceAll('/spaces/components/' + name, '/spaces/' + name)
    const js = ts.transpileModule(input, { fileName: file, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
    assert.equal(digest(js), hash, file)
  }
})

test('Ownership: shared TypeScript cannot import feature modules and selected type owner has no runtime or cyclic dependencies', () => {
  for (const file of walk('client/src/shared').filter(f => /\.tsx?$/u.test(f))) {
    for (const n of parse(file).statements.filter(n => ts.isImportDeclaration(n) || ts.isExportDeclaration(n))) {
      if (n.moduleSpecifier) assert.doesNotMatch(n.moduleSpecifier.text, /(?:^|\/)features\//u, file)
    }
  }
  if (migrated) {
    const sf = parse(owner)
    assert.ok(sf.statements.every(ts.isTypeAliasDeclaration))
    assert.equal(ts.transpileModule(read(owner), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText.trim(), 'export {};')
  }
})

test('Ownership: ordered expanded platform CSS is byte-identical to frozen baseline, including all conflicting selectors and at-rules', () => {
  assert.equal(digest(platform()), baseline.css.digest)
  assert.equal(appFiles().at(-1), 'client/src/shared/styles/primitives.css')
  if (exists('client/src/features/spaces/spaces.css')) {
    assert.deepEqual(appFiles(), ['client/src/shared/styles/platform-shell.css', 'client/src/features/spaces/spaces.css', 'client/src/shared/styles/platform.css', 'client/src/shared/styles/primitives.css'])
    assert.equal(digest(read('client/src/features/spaces/spaces.css')), baseline.css.regionDigest)
    assert.doesNotMatch(read('client/src/shared/styles/platform.css'), /^\.spaces-page \{/mu)
    assert.doesNotMatch(read('client/src/features/spaces/spaces.css'), /^\.(?:auth-page|call-dialog|conversation-pane|primary-rail)\s*\{/mu)
  }
})

test('Ownership: complete CSS rule/declaration inventory retains multiplicity, media/container nesting and keyframes', () => {
  const css = postcss.parse(platform())
  let rules = 0, declarations = 0
  css.walkRules(() => rules++); css.walkDecls(() => declarations++)
  assert.equal(rules, baseline.css.rules)
  assert.equal(declarations, baseline.css.declarations)
  // Exact expanded text also protects baseline intentional duplicates and prevents
  // a missing rule being masked by a newly duplicated rule with the same count.
  assert.equal(digest(css.toString()), baseline.css.digest)
})

test('Ownership: legacy token values, primitives and token-before-App import graph remain frozen', () => {
  // Phase 02 authorizes canonical infrastructure, while every historical legacy
  // variable and non-custom root declaration must still resolve identically.
  const original = execFileSync('git', ['show', 'd9324b16475783681aece801fcb5b0a7935ad77d:client/src/shared/styles/tokens.css'], {encoding:'utf8'})
  assert.equal(digest(original), baseline.css.tokensDigest)
  const declarations = (input, selector) => {
    const values = {}; const css = postcss.parse(input)
    css.walkRules(':root', rule => rule.walkDecls(d => {values[d.prop] = d.value}))
    if (selector !== ':root') css.walkRules(selector, rule => rule.walkDecls(d => {values[d.prop] = d.value}))
    return values
  }
  const resolve = (name, values, seen = []) => {
    assert.ok(!seen.includes(name), 'Token cycle: '+name)
    assert.ok(name in values, 'Missing token: '+name)
    return values[name].replace(/var\((--[\w-]+)\)/g, (_, ref) => resolve(ref, values, [...seen, name]))
  }
  for (const selector of [':root', ':root[data-theme="dark"]', ':root:not([data-theme])']) {
    const old = declarations(original, selector), current = declarations(read('client/src/shared/styles/tokens.css'), selector)
    for (const [name, value] of Object.entries(old)) assert.equal(name.startsWith('--') ? resolve(name,current) : current[name], name.startsWith('--') ? resolve(name,old) : value, selector+' '+name)
  }
  assert.equal(digest(restoreButtonMigration('client/src/shared/styles/primitives.css', read('client/src/shared/styles/primitives.css'))), baseline.css.primitivesDigest)
  assert.equal(cssImports('client/src/index.css')[0], 'client/src/shared/styles/tokens.css')
  assert.ok(read('client/src/main.tsx').indexOf("import './index.css'") < read('client/src/main.tsx').indexOf("import App from './App.tsx'"))
})

test('Ownership: CSS composition stays explicit in App with no shared-to-feature or cross-feature stylesheet import', () => {
  for (const file of walk('client/src').filter(f => f.endsWith('.css'))) {
    for (const target of cssImports(file)) {
      if (file.startsWith('client/src/shared/')) assert.equal(target.startsWith('client/src/features/'), false, file)
      const feature = file.match(/^client\/src\/features\/([^/]+)\//u)?.[1]
      if (feature && target.startsWith('client/src/features/')) assert.equal(target.split('/')[3], feature)
    }
  }
})
