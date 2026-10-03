import './helpers/spaces-presentation-characterization.mjs'
import './helpers/spaces-visual-verification.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import { spacesPage, space, channel, message, legacy, settle } from './helpers/spaces-harness.mjs'
import { plain } from './helpers/foundation-harness.mjs'

const selected = seed => spacesPage({ seed: { space, channelId: 'text', ...seed } })
const event = value => ({ target: { value }, currentTarget: { value }, preventDefault() {} })

test('Spaces overview opens Space and selects first channel while retaining a valid selection', async () => {
  const view = spacesPage({ seed: { spaces: [{ ...space, channel_count: 1 }] } })
  view.cls('space-list-card').props.onClick()
  await settle()
  assert.equal(view.requests[0][0], '/api/spaces/space')
  assert.equal(view.state.space.id, 'space')
  assert.equal(view.state.channelId, 'text')
  view.state.space = null; view.state.channelId = 'text'; view.render()
  view.cls('space-list-card').props.onClick(); await settle()
  assert.equal(view.state.channelId, 'text')
  view.find(node => node.props?.className === 'spaces-back').props.onClick()
  assert.deepEqual(view.trace.at(-1), ['back'])
})

test('Spaces update target loads another Space then sets channel/cursor/highlight; same Space avoids fetch', async () => {
  const view = spacesPage({ props: { openTarget: { spaceId: 'space', channelId: 'text', messageId: 'target' } } })
  view.effects[0].callback(); await settle()
  assert.equal(view.requests[0][0], '/api/spaces/space')
  assert.deepEqual(view.trace.filter(([kind]) => kind === 'state').map(([, name]) => name), ['space', 'channelId', 'historyCursor', 'highlightedMessageId'])
  assert.equal(view.state.highlightedMessageId, 'target')
  view.render(); const count = view.requests.length; view.effects[0].callback()
  assert.equal(view.requests.length, count)
  assert.equal(view.state.historyCursor, null)
})

test('Spaces no-channel/text/voice views retain composition and both voice callbacks forward exact payload', () => {
  const noChannel = selected({ channelId: null })
  assert.equal(noChannel.cls('space-no-channel').props.children, 'Choose a channel to get started.')
  assert.ok(selected().cls('space-message-composer'))
  const voiceChannel = { ...channel, type: 'voice', can_speak: false }
  const view = selected({ space: { ...space, channels: [voiceChannel] } })
  assert.ok(view.cls('space-voice-welcome'))
  assert.equal(view.cls('space-message-composer'), undefined)
  const buttons = view.all(node => node.type === 'button' && JSON.stringify(node.props.children).includes('Join voice'))
  assert.equal(buttons.length, 2)
  for (const button of buttons) button.props.onClick()
  const expected = { id: 'text', chatId: 'text', callType: 'audio', title: 'Project · general', isVoiceRoom: true, voiceSpaceId: 'space', voiceChannelId: 'text', canPublish: false }
  assert.deepEqual(plain(view.trace.filter(([kind]) => kind === 'voice').map(([, call]) => call)), [expected, expected])
})

test('Spaces legacy view retains sender fallbacks, deleted text, non-preview attachments and aggregated reactions', () => {
  const view = selected({ space: { ...space, channels: [{ ...channel, has_encrypted_history: true }] }, legacyHistory: { channelId: 'text', messages: [
    { ...legacy, attachments: [{ id: 'preview', is_preview: true }, { id: 'file', is_preview: false }], reactions: [{ emoji: '👍' }, { emoji: '👍' }] },
    { ...legacy, id: 'deleted', deleted_at: 'now', text: 'must not show', sender_id: 'unknown' },
  ], hasMore: true, loading: false, error: '' } })
  const tree = JSON.stringify(view.render())
  assert.ok(tree.includes('Earlier encrypted history'))
  assert.ok(tree.includes('Earlier message'))
  assert.ok(tree.includes('This message was deleted.'))
  assert.ok(tree.includes('Group member'))
  assert.equal(tree.includes('must not show'), false)
  assert.equal(view.all(node => node.type === 'MessageAttachment').length, 1)
  assert.equal(view.find(node => node.type === 'MessageAttachment').props.attachment.id, 'file')
  assert.ok(view.aria('👍, 2 reactions'))
  assert.equal(view.text('Load earlier').props.disabled, false)
})

test('Spaces legacy loading/error/empty presentation preserves pagination visibility and status copy', () => {
  for (const [loading, error, expected] of [[true, '', 'Loading earlier messages…'], [false, 'cannot load', 'cannot load'], [false, '', 'No earlier messages in this group.']]) {
    const view = selected({ space: { ...space, channels: [{ ...channel, has_encrypted_history: true }] }, legacyHistory: { channelId: 'text', messages: [], hasMore: true, loading, error } })
    assert.ok(JSON.stringify(view.render()).includes(expected))
    const button = loading ? view.text('Loading…') : view.text('Load earlier')
    assert.equal(button.props.disabled, loading)
  }
})

test('Spaces search open resets results/submitted but retains filters; close preserves query and filters mutually clear', () => {
  const view = selected({ searchQuery: 'retain', searchHas: 'file', searchObjectType: 'poll', searchResults: [{ id: 'old' }], searchSubmitted: true })
  view.aria('Search Project').props.onClick(); view.render()
  assert.equal(view.state.searchOpen, true)
  assert.equal(view.state.searchResults.length, 0)
  assert.equal(view.state.searchSubmitted, false)
  assert.equal(view.state.searchQuery, 'retain')
  const selects = view.all(node => node.type === 'select')
  selects.find(node => node.props.value === 'file').props.onChange(event('image'))
  assert.equal(view.state.searchObjectType, '')
  view.render()
  view.cls('space-search-filters').props.children[4].props.children[1].props.onChange(event('event'))
  assert.equal(view.state.searchHas, '')
  view.aria('Close search').props.onClick(); view.render()
  assert.equal(view.state.searchOpen, false)
  assert.equal(view.state.searchQuery, 'retain')
})

test('Spaces file panel open loads files; close preserves listing; category collapse toggles independently', async () => {
  const view = selected()
  view.aria('Files in general').props.onClick(); await settle(); view.render()
  assert.equal(view.state.filePanelOpen, true)
  assert.equal(view.requests[0][0], '/api/spaces/space/channels/text/files')
  view.aria('Close files').props.onClick(); view.render()
  assert.equal(view.state.filePanelOpen, false)
  assert.equal(view.state.channelFiles.length, 0)
  view.cls('space-category-toggle').props.onClick(); view.render()
  assert.equal(view.state.collapsedCategories.category, true)
  assert.equal(view.cls('space-channel-list'), undefined)
  view.cls('space-category-toggle').props.onClick(); view.render()
  assert.equal(view.state.collapsedCategories.category, false)
  assert.ok(view.cls('space-channel-list'))
})

test('Spaces shared-object callbacks preserve canManage and reach response/state owners with refresh', async () => {
  const object = { id: 'object', chat_id: 'text', message_id: message.id, created_by: 'other' }
  const view = selected({ messages: [message], sharedObjects: [object] })
  const card = view.find(node => node.type === 'SharedObjectCard')
  assert.equal(card.props.canManage, true)
  card.props.onRespond(object, { optionIds: ['one'] }); await settle()
  card.props.onStateChange(object, 'closed'); await settle()
  assert.deepEqual(view.requests.map(([path]) => path), ['/api/spaces/space/channels/text/objects/object/respond', '/api/spaces/space/channels/text/messages', '/api/spaces/space/channels/text/objects', '/api/spaces/space/channels/text/objects/object/state', '/api/spaces/space/channels/text/messages', '/api/spaces/space/channels/text/objects'])
  assert.equal(view.requests[0][1].body, '{"optionIds":["one"]}')
  assert.equal(view.requests[3][1].method, 'PATCH')
  const guest = selected({ space: { ...space, role: 'guest' }, messages: [message], sharedObjects: [object] })
  assert.equal(guest.find(node => node.type === 'SharedObjectCard').props.canManage, false)
})
