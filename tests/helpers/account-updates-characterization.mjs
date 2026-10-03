import test from 'node:test'
import assert from 'node:assert/strict'
import { presentation, accountPath, updatesPath, sessions, object, tick, plain, serialized } from './account-updates-harness.mjs'
import { baseline, hash, read, restoreAccountUpdates } from './account-updates-parity.mjs'
const frozen = baseline()
const original = (path, options) => presentation(path, { ...options, source: frozen.files[path].source })
const tree = view => plain(serialized(view.render()))

test('Account session presentation preserves full original DOM/current-device gating/order/timestamps/empty/error states', () => {
  for (const rows of [[], sessions, [...sessions].reverse()]) for (const currentSessionId of ['current', 'other /?é', 'missing']) for (const sessionsError of ['', 'Unable to load sessions.']) {
    const options = { seed: { sessions: rows, currentSessionId, sessionsError } }, actual = presentation(accountPath, options), before = original(accountPath, options)
    assert.deepEqual(tree(actual), tree(before))
    assert.equal(actual.all(n => n.type === 'button' && n.props.children === 'Revoke').length, rows.filter(row => row.id !== currentSessionId).length)
    assert.equal(Boolean(actual.find(n => n.type === 'p' && n.props.children === 'No active sessions found.')), rows.length === 0 && !sessionsError)
  }
})

test('Account session Refresh/Revoke forwards exact encoded target, ordering and failure state; appearance and Close stay parent-owned', async () => {
  for (const fails of [false, true]) {
    const exercise = async before => {
      const options = { seed: { sessions, currentSessionId: 'current', sessionsError: 'Old error' }, api: async (path, options) => { if (fails && options?.method === 'POST') throw new Error('Revoke denied'); return { sessions, currentSessionId: 'current' } } }
      const view = before ? original(accountPath, options) : presentation(accountPath, options)
      view.find(n => n.type === 'button' && n.props.children === 'Refresh').props.onClick(); await tick()
      view.find(n => n.type === 'button' && n.props.children === 'Revoke').props.onClick(); await tick()
      view.find(n => n.type === 'select').props.onChange({ currentTarget: { value: 'dark' } })
      view.find(n => n.props['aria-label'] === 'Close profile').props.onClick()
      return view
    }
    const actual = await exercise(false), before = await exercise(true)
    assert.deepEqual(plain(actual.trace), plain(before.trace)); assert.deepEqual(plain(actual.requests), plain(before.requests))
    assert.equal(actual.requests[1][0], '/api/auth/sessions/other%20%2F%3F%C3%A9/revoke')
    assert.equal(actual.state.sessionsError, fails ? 'Revoke denied' : '')
  }
})

test('Account effects retain mounted session guard, exact dependencies and avatar URL cleanup without timers/storage migration', async () => {
  for (const cancelled of [false, true]) {
    const exercise = async before => {
      const options = { seed: { avatarPreview: 'blob:preview' } }, view = before ? original(accountPath, options) : presentation(accountPath, options)
      const urlCleanup = view.effects[0].callback(), cleanup = view.effects[1].callback()
      if (cancelled) cleanup()
      await tick(); urlCleanup(); return view
    }
    const actual = await exercise(false), before = await exercise(true)
    assert.deepEqual(plain(actual.trace), plain(before.trace)); assert.equal(actual.effects.length, 2)
    assert.deepEqual(plain(actual.effects.map(e => e.dependencies)), [['blob:preview'], []]); assert.equal(actual.timers.length, 0)
    assert.equal(Boolean(actual.state.currentSessionId), !cancelled)
  }
})

test('Updates retains original section/item/call order/counts/empty states/filters and exact Open in channel/call targets', () => {
  for (const populated of [false, true]) for (const filter of ['all', 'spaces']) {
    const objects = ['poll', 'event', 'checklist', 'decision'].map((object_type, i) => ({ ...object, id: String(i), object_type }))
    const calls = [{ id: 'direct', title: 'Direct', space_id: null, call_type: 'video', status: 'ringing' }, { id: 'space-call', title: 'Project', space_id: 'space', call_type: 'audio', status: 'active' }]
    const options = { seed: { stacks: { needsYou: populated ? objects : [], happening: [], decided: [] }, activeCalls: populated ? calls : [], filter } }
    const actual = presentation(updatesPath, options), before = original(updatesPath, options)
    assert.deepEqual(tree(actual), tree(before))
    actual.all(n => n.props.className === 'updates-open-source').forEach(n => n.props.onClick())
    before.all(n => n.props.className === 'updates-open-source').forEach(n => n.props.onClick())
    actual.all(n => n.type === 'button' && ['Open channel', 'Open chat'].includes(n.props.children)).forEach(n => n.props.onClick())
    before.all(n => n.type === 'button' && ['Open channel', 'Open chat'].includes(n.props.children)).forEach(n => n.props.onClick())
    assert.deepEqual(plain(actual.trace), plain(before.trace))
    if (populated) assert.deepEqual(plain(actual.trace[0]), ['target', 'space', 'channel', 'message'])
  }
})

test('Updates initial load/guard and action refresh move Needs You to Decided with identical response/state/search traces and no invented polling', async () => {
  for (const fails of [false, true]) for (const action of ['respond', 'state']) {
    const exercise = async before => {
      const options = { seed: { stacks: { needsYou: [object], happening: [], decided: [] }, query: ' plan / ' }, api: async (path, options) => { if (options && fails) throw new Error('Update denied'); return { stacks: { needsYou: [], happening: [], decided: [{ ...object, state: 'closed' }] }, activeCalls: [] } } }
      const view = before ? original(updatesPath, options) : presentation(updatesPath, options)
      const card = view.find(n => n.type === 'SharedObjectCard')
      if (action === 'respond') card.props.onRespond(object, { type: 'poll', optionIds: ['a'] }); else card.props.onStateChange(object, 'closed')
      await tick(); view.render(); return view
    }
    const actual = await exercise(false), before = await exercise(true)
    assert.deepEqual(plain(actual.trace), plain(before.trace)); assert.deepEqual(tree(actual), tree(before)); assert.equal(actual.timers.length, 0)
    assert.equal(actual.state.busy, false); assert.equal(actual.state.error, fails ? 'Update denied' : '')
    if (!fails) { assert.equal(actual.state.stacks.needsYou.length, 0); assert.equal(actual.state.stacks.decided.length, 1); assert.equal(actual.requests[1][0], '/api/spaces/updates?q=plan%20%2F') }
  }
  for (const cancelled of [false, true]) {
    const view = presentation(updatesPath), cleanup = view.effects[0].callback(); if (cancelled) cleanup(); await tick()
    assert.equal(view.effects.length, 1); assert.deepEqual(plain(view.effects[0].dependencies), []); assert.equal(view.timers.length, 0)
    assert.equal(view.trace.filter(row => row[0] === 'state').length, cancelled ? 0 : 2)
  }
})

test('Account and Updates entire source outside approved presentation/imports, API and SafetySettings retain frozen bytes', () => {
  for (const [path, entry] of Object.entries(frozen.files)) assert.equal(hash(restoreAccountUpdates(path, read(path))), entry.sourceDigest, path)
})
