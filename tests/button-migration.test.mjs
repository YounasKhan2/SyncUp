import {restoreSharedPrimitives} from './helpers/shared-primitives-parity.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { execFileSync } from 'node:child_process'
import postcss from 'postcss'
import { buildProof } from './helpers/design-system-wiring-proof.mjs'
import { restoreAvatarMigration } from './helpers/avatar-migration-parity.mjs'
const fixture = JSON.parse(fs.readFileSync('tests/fixtures/button-migration-baseline.json', 'utf8'))
const read = file => fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n')

test('Button migration changes only static primitive class mappings and exact owned CSS', () => {
  for (const [file, record] of Object.entries(fixture.files)) {
    assert.equal(record.before, execFileSync('git', ['show', `${fixture.base}:${file}`], { encoding: 'utf8' }))
    assert.equal(restoreSharedPrimitives(file,read(file)), record.after)
    if (file.endsWith('.tsx')) {
      const normalize = source => source.replace(/'ui-(?:icon-)?button[^']*'/, "'primitive-classes'")
      assert.equal(normalize(record.after), normalize(record.before), 'Props, refs, children and handlers cannot change')
      assert.doesNotMatch(record.after, /#[\da-f]{3,8}\b|ui:[\w-]+-\[|!important|ui:.*!/i)
      const classes = record.after.match(/'ui-(?:icon-)?button([^']*)'/)[1].trim().split(' ')
      assert.ok(classes.length > 0 && classes.every(value => value.startsWith('ui:')))
    }
  }
})

test('Button migration leaves every other tracked production source and configuration unchanged', () => {
  const files = execFileSync('git', ['ls-tree', '-r', '--name-only', fixture.base], { encoding: 'utf8' }).trim().split('\n').filter(file => file.startsWith('client/') || file.startsWith('server/') || ['package.json', 'package-lock.json'].includes(file))
  for (const file of files) if (!fixture.files[file]) assert.equal(restoreAvatarMigration(file,restoreSharedPrimitives(file,fs.readFileSync(file).toString().replaceAll('\r\n', '\n'))), execFileSync('git', ['show', `${fixture.base}:${file}`], { encoding: 'utf8' }).replaceAll('\r\n', '\n'), file)
})

test('Removed primitive declarations cannot return and unrelated dialog CSS stays exact', () => {
  const file = 'client/src/shared/styles/primitives.css', before = postcss.parse(fixture.files[file].before), after = postcss.parse(restoreSharedPrimitives(file,read(file)))
  const rules = css => { const map = {}; css.walkRules(rule => { map[rule.selector] = rule.nodes.map(n => n.toString()) }); return map }
  const old = rules(before), next = rules(after)
  for (const selector of ['.ui-dialog-overlay', '.ui-dialog', '.ui-button span']) assert.deepEqual(next[selector], old[selector])
  assert.equal(next['.ui-button:disabled'], undefined)
  for (const selector of ['.ui-button', '.ui-icon-button']) for (const declaration of next[selector]) assert.doesNotMatch(declaration, /^(?:display|color|background|cursor|align-items|justify-content|place-items):/)
  assert.deepEqual(next['.ui-button:hover:not(:disabled)'], ['transform: translateY(-1px)'])
})

test('Production source detection emits every migrated primitive utility', async () => {
  const result = await buildProof('.git/design03/utility-proof')
  for (const file of Object.keys(fixture.files).filter(file => file.endsWith('.tsx'))) {
    for (const name of read(file).match(/'ui-(?:icon-)?button([^']*)'/)[1].trim().split(' ')) {
      const escaped = name.replace(/([^\w-])/g, '\\$1')
      assert.ok(result.css.includes('.' + escaped), `Missing compiled ${name}`)
    }
  }
})
