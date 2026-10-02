import test from 'node:test'
import assert from 'node:assert/strict'
import { spacesPage, space, channel, permissions, settle } from './helpers/spaces-harness.mjs'
import { plain } from './helpers/foundation-harness.mjs'

const selected = seed => spacesPage({ seed: { space, channelId: 'text', channelSettingsTab: 'overview', ...seed } })
function openPermissions(view) { view.text('Permissions').props.onClick(); view.render() }

test('Spaces permission initialization clones all existing rows and missing rows retain error without defaults', () => {
  const view = selected(); openPermissions(view)
  assert.deepEqual(plain(view.state.permissionDraft), permissions)
  assert.notEqual(view.state.permissionDraft[0], permissions[0])
  const missing = selected({ space: { ...space, channels: [{ ...channel, permissions: null }] }, permissionDraft: [{ role: 'guest', can_view: false }] })
  openPermissions(missing)
  assert.equal(missing.state.error, 'Unable to load this channel’s role permissions.')
  assert.equal(missing.state.permissionDraft.length, 1)
  assert.equal(missing.text('Save permissions').props.disabled, true)
})

test('Spaces disabling View also disables Send/Speak without changing other roles or granting on re-enable', () => {
  const view = selected(); openPermissions(view)
  view.aria('member can view').props.onChange({ target: { checked: false } }); view.render()
  assert.deepEqual(plain(view.state.permissionDraft[1]), { role: 'member', can_view: false, can_send: false, can_speak: false })
  assert.deepEqual(plain(view.state.permissionDraft[0]), permissions[0])
  assert.equal(view.aria('member can send messages').props.disabled, true)
  view.aria('member can view').props.onChange({ target: { checked: true } })
  assert.equal(view.state.permissionDraft[1].can_send, false)
  assert.equal(view.state.permissionDraft[1].can_speak, false)
})

test('Spaces voice permissions edit can_speak; text permissions edit can_send and preserve three-row save payload', async () => {
  for (const type of ['voice', 'discussion']) {
    const view = selected({ space: { ...space, channels: [{ ...channel, type }] } }); openPermissions(view)
    const speak = type === 'voice'
    view.aria(`member can ${speak ? 'speak' : 'send messages'}`).props.onChange({ target: { checked: false } }); view.render()
    assert.equal(view.state.permissionDraft[1][speak ? 'can_speak' : 'can_send'], false)
    assert.equal(view.state.permissionDraft[1][speak ? 'can_send' : 'can_speak'], true)
    assert.equal(view.text('Save permissions').props.disabled, false)
    view.all(node => node.type === 'form').at(-1).props.onSubmit({ preventDefault() {} }); await settle()
    assert.equal(view.requests[0][0], '/api/spaces/space/channels/text/permissions')
    assert.equal(view.requests[0][1].method, 'PATCH')
    assert.equal(JSON.parse(view.requests[0][1].body).permissions.length, 3)
    assert.equal(view.requests[1][0], '/api/spaces/space')
    assert.equal(view.state.channelSettingsTab, null)
  }
})

test('Spaces server can_send controls composer and settings stay restricted to owner/admin', () => {
  const view = selected({ space: { ...space, role: 'member', channels: [{ ...channel, can_send: false }] } })
  assert.equal(view.aria('Message #general').props.disabled, true)
  assert.equal(view.aria('Send channel message').props.disabled, true)
  assert.equal(view.aria('Insert a mention').props.disabled, true)
  assert.equal(view.aria('Space settings'), undefined)
  assert.equal(view.text('Edit channel'), undefined)
  assert.equal(view.aria('Channel settings sections'), undefined)
})
