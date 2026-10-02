import test from 'node:test'
import assert from 'node:assert/strict'
import { load } from './helpers/foundation-harness.mjs'

function environment(saved = null, dark = false, blocked = false) {
  const listeners = new Set()
  const root = { dataset: {}, style: {} }
  const media = { matches: dark, addEventListener: (_event, fn) => listeners.add(fn),
    removeEventListener: (_event, fn) => listeners.delete(fn) }
  const values = new Map(saved ? [['syncup-appearance', saved]] : [])
  const appearance = load('client/src/shared/appearance.ts', {}, {
    document: { documentElement: root }, window: {
      matchMedia: () => media,
      localStorage: { getItem(key) { if (blocked) throw new Error('blocked'); return values.get(key) ?? null },
        setItem: (key, value) => values.set(key, value) },
    },
  })
  return { appearance, root, values, listeners, system(value) { media.matches = value; for (const fn of listeners) fn() } }
}

test('Given bootstrap outside Workspace, then system changes update root theme and color scheme', () => {
  const e = environment()
  const stop = e.appearance.startAppearanceLifecycle()
  assert.equal(e.root.dataset.theme, 'light')
  e.system(true)
  assert.equal(e.root.dataset.theme, 'dark')
  assert.equal(e.root.style.colorScheme, 'dark')
  assert.equal(e.root.dataset.appearance, 'system')
  e.system(false)
  assert.equal(e.root.dataset.theme, 'light')
  stop()
  assert.equal(e.listeners.size, 0)
})

for (const mode of ['light', 'dark']) test(`Given saved ${mode}, then bootstrap and subsequent OS changes preserve explicit choice`, () => {
  const e = environment(mode, mode !== 'dark')
  e.appearance.startAppearanceLifecycle()
  e.system(true); e.system(false)
  assert.equal(e.root.dataset.theme, mode)
  assert.equal(e.root.style.colorScheme, mode)
  assert.equal(e.values.get('syncup-appearance'), mode)
})

test('Given a changed persisted preference, then the root listener respects it and can return to system', () => {
  const e = environment('system')
  e.appearance.startAppearanceLifecycle()
  e.appearance.saveAppearancePreference('light')
  e.appearance.applyAppearancePreference('light')
  e.system(true)
  assert.equal(e.root.dataset.theme, 'light')
  e.appearance.saveAppearancePreference('system')
  e.appearance.applyAppearancePreference('system')
  assert.equal(e.root.dataset.theme, 'dark')
  e.system(false)
  assert.equal(e.root.dataset.theme, 'light')
})

test('Given unavailable localStorage reads, then bootstrap safely follows system', () => {
  const e = environment(null, true, true)
  e.appearance.startAppearanceLifecycle()
  assert.equal(e.root.dataset.theme, 'dark')
  e.system(false)
  assert.equal(e.root.dataset.theme, 'light')
})
