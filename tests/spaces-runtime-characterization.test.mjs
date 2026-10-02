import test from 'node:test'
import assert from 'node:assert/strict'
import { spacesPage, space, channel, message, legacy, settle } from './helpers/spaces-harness.mjs'
import { plain } from './helpers/foundation-harness.mjs'

const event = { preventDefault() {} }
const selected = options => spacesPage({ ...options, seed: { space, channelId: 'text', ...options?.seed } })

test('Spaces metadata polling retains 15000 ms, active guards, errors and cleanup', async () => {
  let release
  const view = selected({ api: () => new Promise(resolve => { release = resolve }) })
  const cleanup = view.effects[2].callback()
  const timer = [...view.timers.values()][0]
  assert.equal(timer.delay, 15000)
  timer.callback(); assert.equal(view.requests[0][0], '/api/spaces/space')
  cleanup(); release({ space: { ...space, name: 'Late' } }); await settle()
  assert.equal(view.state.space.name, 'Project')
  assert.equal(view.timers.size, 0)
  const failed = selected({ api: async () => { throw new Error('offline') } })
  const stop = failed.effects[2].callback(); [...failed.timers.values()][0].callback(); await settle()
  assert.equal(failed.state.error, 'offline'); stop()
})

test('Spaces channel runtime preserves parallel endpoint order, cursor, SSE events, mention, 5000 ms and cleanup', async () => {
  const view = selected({ seed: { historyCursor: { channelId: 'text', beforeSeq: '8' } }, api: async path => path.includes('/messages') ? { messages: [message] } : { objects: [{ id: 'object' }] } })
  const cleanup = view.effects[3].callback(); await settle()
  assert.deepEqual(view.requests.map(([path]) => path), ['/api/spaces/space/channels/text/messages?before_seq=8', '/api/spaces/space/channels/text/objects'])
  assert.equal(view.state.messages[0].id, 'message')
  const stream = view.sources[0]
  assert.equal(stream.url, '/api/events?chat_id=text')
  assert.deepEqual([...stream.listeners.keys()], ['channel.message', 'channel.object', 'channel.mention'])
  for (const name of stream.listeners.keys()) stream.emit(name)
  assert.equal(view.state.mentionNotice, 'You were mentioned in #general.')
  assert.equal(view.requests.length, 8)
  const timer = [...view.timers.values()][0]
  assert.equal(timer.delay, 5000); timer.callback(); assert.equal(view.requests.length, 10)
  cleanup(); await settle()
  assert.equal(stream.closed, true); assert.equal(view.timers.size, 0)
  const voice = selected({ seed: { space: { ...space, channels: [{ ...channel, type: 'voice' }] }, messages: [message] } })
  voice.effects[3].callback()
  assert.equal(voice.state.messages.length, 0); assert.equal(voice.sources.length, 0); assert.equal(voice.requests.length, 0)
})

test('Spaces legacy decrypt retains fallback/deleted handling, limit=50 and aborted-result guard', async () => {
  const rows = [legacy, { ...legacy, id: 'bad', body_ciphertext: 'bad' }, { ...legacy, id: 'deleted', deleted_at: 'now' }]
  const view = selected({ seed: { space: { ...space, channels: [{ ...channel, has_encrypted_history: true }] } }, api: async () => ({ messages: rows, hasMore: true }), decrypt: async input => { if (input.bodyCiphertext === 'bad') throw new Error('key'); return 'clear' } })
  const cleanup = view.effects[4].callback(); await settle()
  assert.equal(view.requests[0][0], '/api/chats/text/messages?limit=50')
  assert.deepEqual(plain(view.state.legacyHistory.messages.map(({ text }) => text)), ['clear', 'Unable to decrypt this message on this device.', ''])
  assert.equal(view.trace.filter(([kind]) => kind === 'decrypt').length, 2)
  assert.equal(view.state.legacyHistory.hasMore, true)
  cleanup(); assert.equal(view.requests[0][1].signal.aborted, true)
  let release
  const cancelled = selected({ seed: { space: { ...space, channels: [{ ...channel, has_encrypted_history: true }] } }, api: () => new Promise(resolve => { release = resolve }) })
  const stop = cancelled.effects[4].callback(); stop(); release({ messages: [legacy], hasMore: false }); await settle()
  assert.equal(cancelled.state.legacyHistory, null)
})

test('Spaces legacy pagination callback retains cursor/prepend/hasMore and loading guard', async () => {
  const view = selected({ seed: { space: { ...space, channels: [{ ...channel, has_encrypted_history: true }] }, legacyHistory: { channelId: 'text', messages: [legacy], hasMore: true, loading: false, error: '' } }, api: async () => ({ messages: [{ ...legacy, id: 'older', server_seq: '2' }], hasMore: false }) })
  view.text('Load earlier').props.onClick(); await settle()
  assert.equal(view.requests[0][0], '/api/chats/text/messages?limit=50&before_seq=10')
  assert.deepEqual(plain(view.state.legacyHistory.messages.map(({ id }) => id)), ['older', 'legacy'])
  assert.equal(view.state.legacyHistory.hasMore, false)
  assert.equal(view.state.legacyHistory.loading, false)
  view.render(); assert.equal(view.text('Load earlier'), undefined)
})

test('Spaces scrolling preserves smooth/end, smooth/center and 4000 ms highlight clearing', () => {
  const calls = []
  const view = selected({ seed: { messages: [message], highlightedMessageId: 'message' }, target: { scrollIntoView: value => calls.push(value) } })
  view.refs.messageEnd.current = { scrollIntoView: value => calls.push(value) }
  view.effects[5].callback(); view.effects[6].callback()
  assert.deepEqual(plain(calls), [{ behavior: 'smooth', block: 'end' }, { behavior: 'smooth', block: 'center' }])
  assert.deepEqual(view.trace.find(([kind]) => kind === 'element'), ['element', 'space-message-message'])
  const timer = [...view.timers.values()][0]; assert.equal(timer.delay, 4000); timer.callback()
  assert.equal(view.state.highlightedMessageId, null)
})

test('Spaces file upload preserves intent/content/complete/reload, fallback MIME and input reset including errors', async () => {
  const view = selected()
  view.refs.fileInput.current = { value: 'selected' }
  const file = { name: 'notes.txt', type: '', size: 42 }
  view.find(node => node.type === 'input' && node.props.type === 'file').props.onChange({ currentTarget: { files: [file] } }); await settle()
  assert.deepEqual(view.trace.filter(([kind]) => ['api', 'upload'].includes(kind)).map(([kind, path]) => [kind, path]), [
    ['api', '/api/spaces/space/channels/text/files'], ['upload', '/api/spaces/space/channels/text/files/file/content'], ['api', '/api/spaces/space/channels/text/files/file/complete'], ['api', '/api/spaces/space/channels/text/files'],
  ])
  assert.equal(view.requests[0][1].body, '{"filename":"notes.txt","contentType":"application/octet-stream","sizeBytes":42}')
  assert.equal(view.trace.find(([kind]) => kind === 'upload')[3], 'application/octet-stream')
  assert.equal(view.refs.fileInput.current.value, '')
  assert.equal(view.state.busy, false)
  const failed = selected({ api: async () => { throw new Error('upload failed') } })
  failed.refs.fileInput.current = { value: 'selected' }
  failed.find(node => node.type === 'input' && node.props.type === 'file').props.onChange({ currentTarget: { files: [file] } }); await settle()
  assert.equal(failed.state.error, 'upload failed'); assert.equal(failed.refs.fileInput.current.value, '')
})

test('Spaces search preserves filter query order, submitted results and message/object/file navigation', async () => {
  const result = { type: 'message', id: 'found', channel_id: 'text', channel_name: 'general', author_name: 'Sam', title: 'Found', server_seq: '7', created_at: message.created_at }
  const view = selected({ seed: { searchOpen: true, searchQuery: '  hello  ', searchFrom: 'me', searchAfter: '2026-01-01', searchBefore: '2026-12-01', searchHas: 'file', searchObjectType: '' }, api: async () => ({ results: [result] }) })
  view.cls('space-discovery-form').props.onSubmit(event); await settle(); view.render()
  assert.equal(view.requests[0][0], '/api/spaces/space/search?q=hello&from=me&after=2026-01-01&before=2026-12-01&has=file')
  assert.equal(view.state.searchSubmitted, true)
  view.cls('space-search-result').props.onClick()
  assert.deepEqual(plain(view.state.historyCursor), { channelId: 'text', beforeSeq: '8' })
  assert.equal(view.state.highlightedMessageId, 'found'); assert.equal(view.state.searchOpen, false)
  const objects = selected({ seed: { searchOpen: true, searchResults: [{ ...result, type: 'object', message_id: 'object-message' }] } })
  objects.cls('space-search-result').props.onClick(); assert.equal(objects.state.highlightedMessageId, 'object-message')
  const files = selected({ seed: { searchOpen: true, searchResults: [{ ...result, type: 'file' }] } })
  assert.equal(files.cls('space-search-result').props.href, '/api/spaces/space/channels/text/files/found/content')
})

test('Spaces send keeps trim guard but sends untrimmed body then clears and reloads', async () => {
  const view = selected({ seed: { draft: '  hello  ' } })
  view.cls('space-message-composer').props.onSubmit(event); await settle()
  assert.equal(view.requests[0][1].body, '{"body":"  hello  "}')
  assert.equal(view.requests[0][1].method, 'POST')
  assert.equal(view.requests[1][0], '/api/spaces/space/channels/text/messages')
  assert.equal(view.state.draft, ''); assert.equal(view.state.busy, false)
  const empty = selected({ seed: { draft: '  ' } }); empty.cls('space-message-composer').props.onSubmit(event); await settle()
  assert.equal(empty.requests.length, 0)
  const mentions = selected({ seed: { messages: [message] } })
  assert.equal(mentions.all(node => node.props?.className === 'space-message-mention').length, 2)
})

test('Spaces poll/event/checklist construction preserves payloads, invalid-date guard, reset and refresh order', async () => {
  for (const type of ['poll', 'event', 'checklist']) {
    const view = selected({ seed: { objectDialogType: type, objectTitle: 'Title', objectOptions: ['  one ', '', 'two'], objectMultiSelect: true, objectAnonymous: true, objectStartsAt: '2026-10-03T10:00:00Z', objectLocation: 'Room', objectItemsText: ' first \n\n second ', objectAssigneeId: 'me' } })
    view.cls('space-object-dialog').props.children.at(-1).props.onSubmit(event); await settle()
    const body = JSON.parse(view.requests[0][1].body)
    if (type === 'poll') assert.deepEqual(body, { type, question: 'Title', options: ['one', 'two'], multiSelect: true, closesAt: null, anonymous: true })
    if (type === 'event') { assert.equal(body.startsAt, '2026-10-03T10:00:00.000Z'); assert.equal(body.locationText, 'Room'); assert.equal(body.rsvpRequired, true) }
    if (type === 'checklist') assert.deepEqual(body.items, [{ text: 'first', assigneeId: 'me', dueAt: null }, { text: 'second', assigneeId: 'me', dueAt: null }])
    assert.deepEqual(view.requests.map(([path]) => path), ['/api/spaces/space/channels/text/objects', '/api/spaces/space/channels/text/messages', '/api/spaces/space/channels/text/objects'])
    assert.equal(view.state.objectDialogType, null); assert.equal(view.state.objectTitle, ''); assert.equal(view.state.busy, false)
  }
  const invalid = selected({ seed: { objectDialogType: 'event', objectStartsAt: 'invalid' } })
  invalid.cls('space-object-dialog').props.children.at(-1).props.onSubmit(event); await settle()
  assert.equal(invalid.requests.length, 0); assert.equal(invalid.state.error, 'Choose when the event starts.')
})

test('Spaces decision pin preserves prompt trim, request body and message/object refresh', async () => {
  const view = selected({ seed: { messages: [message] } })
  view.cls('space-message-pin').props.onClick(); await settle()
  assert.equal(view.requests[0][0], '/api/spaces/space/channels/text/messages/message/decision')
  assert.equal(view.requests[0][1].body, '{"title":"Decision"}')
  assert.deepEqual(view.requests.slice(1).map(([path]) => path), ['/api/spaces/space/channels/text/messages', '/api/spaces/space/channels/text/objects'])
})
