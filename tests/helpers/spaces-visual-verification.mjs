import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { read, hash } from './spaces-presentation-parity.mjs'
import { load } from './foundation-harness.mjs'
import { stableRaster } from './spaces-visual-capture.mjs'

test('Spaces visual correction keeps the original pre-refactor fixture and frozen header rather than blessing HEAD', () => {
  const original = read('tests/fixtures/spaces-presentation-base.tsx')
  assert.equal(hash(original), 'fc5dec8e8a6a5c1b2239a7e7ed229b0c3e7e9ac5e6120a30a329f9f581faacae')
  const frozen = JSON.parse(read('tests/fixtures/spaces-presentation-baseline.json')).header
  assert.ok(original.includes(frozen.original))
  const reconstructed = read('tests/fixtures/spaces-presentation-preview.tsx')
    .replace("import { SpaceChannelHeader } from '../../client/src/features/spaces/components/SpaceChannelHeader'\n", '')
    .replace(frozen.replacement, frozen.original)
    .replaceAll('/spaces/components/SpaceVoiceChannelView', '/spaces/SpaceVoiceChannelView')
    .replaceAll('/spaces/components/SpaceLegacyHistoryView', '/spaces/SpaceLegacyHistoryView')
  assert.equal(reconstructed, original)
})

test('Spaces visual bootstrap stabilizes both color-scheme queries before real theme initialization despite native preference changes', () => {
  for (const preference of ['light', 'dark', 'system']) for (const os of ['light', 'dark']) {
    let nativeDark = false
    const root = { dataset: {}, style: {} }
    const globals = { window: { matchMedia: query => ({ matches: query.includes('dark') ? nativeDark : query.includes('light') ? !nativeDark : true }) },
      document: { documentElement: root }, URLSearchParams, location: { search: `?theme=${preference}&os=${os}` } }
    vm.runInNewContext(read('tests/fixtures/spaces-visual-bootstrap.js'), globals)
    const appearance = load('client/src/shared/appearance.ts', {}, globals)
    for (const changedNativePreference of [true, false, true]) {
      nativeDark = changedNativePreference
      appearance.applyAppearancePreference(preference)
      assert.equal(globals.window.matchMedia('(prefers-color-scheme: dark)').matches, os === 'dark')
      assert.equal(globals.window.matchMedia('(prefers-color-scheme: light)').matches, os === 'light')
      assert.equal(globals.window.matchMedia('(prefers-reduced-motion: reduce)').matches, true)
      assert.equal(root.dataset.theme, preference === 'system' ? os : preference)
      assert.equal(root.dataset.appearance, preference)
      assert.equal(root.style.colorScheme, root.dataset.theme)
      assert.equal(root.dataset.visualSystemDark, String(os === 'dark'))
    }
  }
})

test('Spaces raster stabilization does not accept two identical transient frames and retains every warmup', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'syncup-visual-verification-'))
  const frames = ['transient', 'transient', 'stable', 'stable', 'stable']
  let index = 0
  await stableRaster({ screenshot: async () => Buffer.from(frames[index++]) }, directory, 'unit')
  const report = JSON.parse(await fs.readFile(path.join(directory, 'warmups/unit.json'), 'utf8'))
  assert.equal(index, 5)
  assert.equal(report.frames.length, 5)
  assert.equal(report.consecutive, 3)
  for (let frame = 1; frame <= 5; frame++) assert.equal(await fs.readFile(path.join(directory, `warmups/unit-${frame}.jpg`), 'utf8'), frames[frame - 1])
})
