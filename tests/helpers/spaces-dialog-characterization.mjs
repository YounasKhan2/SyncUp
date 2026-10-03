import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { spacesPage, space, channel, settle } from './spaces-harness.mjs'
import { nodes } from './ui-harness.mjs'
import { dialogBaseline, digest, restoreSpacesDialogs } from './spaces-dialog-parity.mjs'

const plain = value => JSON.parse(JSON.stringify(value))
const baseline = dialogBaseline()
const serialize = node => {
  if (Array.isArray(node)) return node.map(serialize)
  if (!node || typeof node !== 'object') return node
  return { type: typeof node.type === 'symbol' ? String(node.type) : node.type,
    props: Object.fromEntries(Object.entries(node.props).filter(([k, v]) => k !== 'children' && typeof v !== 'function').map(([k, v]) => [k, plain(v)])), children: serialize(node.props.children) }
}
const make = (kind, overrides = {}, original = false, api) => spacesPage({
  seed: { space, channelId: channel.id, channelDialogOpen: kind === 'channel', categoryDialogOpen: kind === 'category', channelName: 'design-feedback', channelTopic: 'Prepared topic', channelCategoryId: 'category', categoryName: 'Design', ...overrides },
  pageSource: original ? baseline.source : undefined, api,
})
const dialog = view => view.find(n => n.props.role === 'dialog')

test('Spaces controlled creation dialogs retain exact original root/child/ARIA/values/options/error/busy/role visibility', () => {
  for (const kind of ['channel', 'category']) for (const role of ['owner', 'admin', 'moderator', 'member', 'guest']) for (const busy of [false, true]) for (const type of ['discussion', 'announcement', 'private', 'voice']) {
    const overrides = { space: { ...space, role }, busy, error: busy ? 'Original error' : '', channelType: type }
    const actual = make(kind, overrides), original = make(kind, overrides, true)
    assert.deepEqual(dialog(actual) ? plain(serialize(dialog(actual))) : null, dialog(original) ? plain(serialize(dialog(original))) : null)
    assert.equal(Boolean(dialog(actual)), role === 'owner' || role === 'admin')
    if (!dialog(actual)) continue
    assert.equal(dialog(actual).props['aria-modal'], 'true')
    assert.equal(nodes(dialog(actual), n => n.type === 'input' && n.props.autoFocus).length, 1)
    assert.equal(nodes(dialog(actual), n => n.type === 'button').length, 2)
  }
})

test('Spaces creation dialogs preserve backdrop target gating, close-only behavior and controlled updates without new Escape/Cancel', () => {
  for (const kind of ['channel', 'category']) {
    const view = make(kind), overlay = view.cls('space-dialog-overlay'), stateKey = `${kind}DialogOpen`
    overlay.props.onMouseDown({ target: {}, currentTarget: {} }); assert.equal(view.state[stateKey], true)
    const same = {}; overlay.props.onMouseDown({ target: same, currentTarget: same }); assert.equal(view.state[stateKey], false)
    assert.equal(view.state[kind === 'channel' ? 'channelName' : 'categoryName'], kind === 'channel' ? 'design-feedback' : 'Design')
    view.state[stateKey] = true; view.aria('Close').props.onClick(); assert.equal(view.state[stateKey], false)
    assert.equal(overlay.props.onKeyDown, undefined)
    assert.equal(nodes(dialog(view), n => n.type === 'button' && n.props.children === 'Cancel').length, 0)
    if (kind === 'channel') {
      const inputs = nodes(dialog(view), n => n.type === 'input')
      inputs[0].props.onChange({ target: { value: '  DESIGN !!! feedback--  ' } }); assert.equal(view.state.channelName, 'design-feedback-')
      inputs[1].props.onChange({ target: { value: 'New topic' } }); assert.equal(view.state.channelTopic, 'New topic')
      const selects = nodes(dialog(view), n => n.type === 'select')
      selects[0].props.onChange({ target: { value: 'new-category' } }); assert.equal(view.state.channelCategoryId, 'new-category')
      selects[1].props.onChange({ target: { value: 'voice' } }); assert.equal(view.state.channelType, 'voice')
    } else {
      nodes(dialog(view), n => n.type === 'input')[0].props.onChange({ target: { value: ' Untouched spaces ' } }); assert.equal(view.state.categoryName, ' Untouched spaces ')
    }
    assert.equal(view.requests.length, 0)
  }
})

test('Spaces creation submit callbacks retain exact payload/reset/close/refresh ordering on success and errors', async () => {
  for (const kind of ['channel', 'category']) for (const fails of [false, true]) {
    const exercise = async original => {
      const view = make(kind, {}, original, async (path, options) => {
        if (fails && options?.method === 'POST') throw new Error('Creation failed')
        return options?.method === 'POST' ? { channelId: 'created-channel', category: { id: 'created-category' } } : path === '/api/spaces' ? { spaces: [space] } : { space }
      })
      nodes(dialog(view), n => n.type === 'form')[0].props.onSubmit({ preventDefault() { view.trace.push(['preventDefault']) } })
      await settle(); return view
    }
    const actual = await exercise(false), original = await exercise(true)
    assert.deepEqual(plain(actual.trace), plain(original.trace)); assert.deepEqual(plain(actual.requests), plain(original.requests))
    assert.equal(actual.state.busy, false); assert.equal(actual.state[`${kind}DialogOpen`], fails)
    assert.equal(actual.state.error, fails ? 'Creation failed' : '')
    assert.deepEqual(JSON.parse(actual.requests[0][1].body), kind === 'channel' ? { name: 'design-feedback', type: 'discussion', categoryId: 'category', topic: 'Prepared topic' } : { name: 'Design' })
  }
})

test('Spaces creation opening retains category initialization and permission gating without moving root decisions', () => {
  const view = spacesPage({ seed: { space, channelId: channel.id, channelCategoryId: '', error: 'Old error' } })
  view.aria('Create channel in Project').props.onClick()
  assert.equal(view.state.channelCategoryId, 'category'); assert.equal(view.state.channelDialogOpen, true)
  assert.equal(view.state.error, '')
  const original = spacesPage({ seed: { space, channelId: channel.id, channelCategoryId: '', error: 'Old error' }, pageSource: baseline.source })
  original.aria('Create channel in Project').props.onClick()
  assert.deepEqual(plain(view.trace), plain(original.trace))
})

test('Spaces dialogs preserve every root byte outside frozen approved JSX/imports, including state/effects/refs/functions/API/permissions', () => {
  const source = fs.readFileSync(new URL('../../client/src/features/spaces/SpacesPage.tsx', import.meta.url), 'utf8')
  assert.equal(digest(restoreSpacesDialogs(source)), baseline.sourceDigest)
})
