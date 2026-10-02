import test from 'node:test'
import assert from 'node:assert/strict'
import { conversation, chat, message, settle } from './helpers/conversation-harness.mjs'
import { plain } from './helpers/foundation-harness.mjs'

test('Conversation initial load retains four endpoints, decrypt/reply fallbacks, deleted handling, sorted history and read-after-state timing', async () => {
  let release
  const blocked = new Promise((resolve) => { release = resolve })
  const encrypted = [
    { ...message, reply_context: { ...message, id: 'reply', body_ciphertext: 'reply-failure' } },
    { ...message, id: 'failed', server_seq: '2', body_ciphertext: 'failure' },
    { ...message, id: 'deleted', server_seq: '3', deleted_at: 'now', body_ciphertext: 'deleted', reply_context: { ...message, deleted_at: 'now', body_ciphertext: 'deleted-reply' } },
  ]
  const view = conversation({ decrypt: async ({ bodyCiphertext }) => {
    if (bodyCiphertext.includes('failure')) throw new Error('bad key')
    return blocked
  }, api: async (path) => {
    if (path.endsWith('/read')) {
      assert.equal(view.state.messages.length, 3)
      assert.equal(view.state.chat.id, 'chat')
      return {}
    }
    if (path.endsWith('/group-calls')) return { calls: [{ id: 'earlier', created_at: '2026-10-01' }] }
    if (path.endsWith('/calls')) return { calls: [{ id: 'later', created_at: '2026-10-02' }] }
    if (path.includes('/messages?')) return { messages: encrypted, hasMore: true }
    return { chat }
  } })
  const cleanup = view.mount()
  await settle()
  assert.deepEqual(view.requests.map(([path]) => path), ['/api/chats/chat', '/api/chats/chat/messages?limit=50', '/api/chats/chat/calls', '/api/chats/chat/group-calls'])
  assert.equal(view.state.loading, true)
  release('clear text')
  await settle()
  assert.deepEqual(plain(view.state.messages.map(({ text }) => text)), ['clear text', 'Unable to decrypt this message on this device.', ''])
  assert.equal(view.state.messages[0].reply_context.text, 'Unable to decrypt this message on this device.')
  assert.equal(view.state.messages[2].reply_context.text, '')
  assert.deepEqual(plain(view.state.callHistory.map(({ id }) => id)), ['earlier', 'later'])
  assert.equal(view.state.hasOlderMessages, true)
  assert.equal(view.refs.lastSeq.current, 3)
  assert.equal(view.refs.initialScrollPending.current, true)
  assert.equal(view.state.loading, false)
  assert.deepEqual(plain(view.requests.at(-1)), ['/api/chats/chat/read', { method: 'POST', body: '{"lastSeq":3}' }])
  assert.ok(view.trace.findIndex(([kind]) => kind === 'refreshInbox') > view.trace.findIndex(([kind, path]) => kind === 'api' && path.endsWith('/read')))
  assert.equal(view.trace.some(([kind, input]) => kind === 'decrypt' && input.bodyCiphertext.startsWith('deleted')), false)
  cleanup()
})

test('Conversation initial load failure retains error/loading behavior and skips read', async () => {
  const view = conversation({ api: async () => { throw new Error('unavailable') } })
  const cleanup = view.mount()
  await settle()
  assert.equal(view.state.error, 'unavailable')
  assert.equal(view.state.loading, false)
  assert.equal(view.requests.some(([path]) => path.endsWith('/read')), false)
  cleanup()
})

test('Conversation draft restore, 250 ms persistence and cancelled restoration retain existing closures/cleanup', async () => {
  const view = conversation({ seed: { draft: 'rendered draft' }, draft: async (id) => { assert.equal(id, 'chat'); return 'restored' } })
  const cleanup = view.mount()
  await settle()
  assert.equal(view.state.draft, 'restored')
  const timeout = [...view.timers.values()].find(({ delay }) => delay === 250)
  timeout.callback()
  await settle()
  assert.ok(view.trace.some(([kind, id, value]) => kind === 'saveDraft' && id === 'chat' && value === 'rendered draft'))
  cleanup()
  assert.equal(view.timers.size, 0)
  let release
  const cancelled = conversation({ seed: { draft: 'keep' }, draft: () => new Promise((resolve) => { release = resolve }) })
  const end = cancelled.mount()
  end()
  release('late restoration')
  await settle()
  assert.equal(cancelled.state.draft, 'keep')
})

test('Conversation SSE listeners retain event names, receipt/presence/typing patches, reloads, fallback and cleanup', async () => {
  const view = conversation({ seed: { chat } })
  const cleanup = view.mount()
  await settle()
  const source = view.sources[0]
  assert.equal(source.url, '/api/events?chat_id=chat')
  assert.deepEqual([...source.listeners.keys()], ['message.created', 'message.updated', 'message.pinned', 'message.reactions', 'message.delivered', 'chat.read', 'presence', 'typing', 'membership.changed'])
  view.state.messages = [{ ...message, sender_id: 'me' }, { ...message, id: 'other', server_seq: '3' }]
  view.render()
  source.emit('message.delivered', { userId: 'peer', messageIds: ['message', 'other'] })
  source.emit('message.delivered', { userId: 'peer', messageIds: ['message'] })
  assert.deepEqual(plain(view.state.messages[0].delivery_receipts), ['peer'])
  assert.equal(view.state.messages[1].delivery_receipts, undefined)
  source.emit('chat.read', { userId: 'peer', lastReadSeq: '1' })
  assert.deepEqual(plain(view.state.messages[0].read_by), ['peer'])
  source.emit('presence', { userId: 'peer', online: true })
  assert.equal(view.state.onlineUsers.has('peer'), true)
  source.emit('presence', { userId: 'peer', online: false })
  assert.equal(view.state.onlineUsers.has('peer'), false)
  source.emit('typing', { userId: 'peer', displayName: 'Peer', active: true })
  const oldTimer = view.refs.typingTimers.current.get('peer')
  assert.equal(view.timers.get(oldTimer).delay, 3500)
  source.emit('typing', { userId: 'peer', displayName: 'Peer', active: true })
  assert.equal(view.timers.has(oldTimer), false)
  view.timers.get(view.refs.typingTimers.current.get('peer')).callback()
  assert.deepEqual(plain(view.state.typingUsers), {})
  source.emit('typing', { userId: 'peer', displayName: 'Peer', active: true })
  source.emit('typing', { userId: 'peer', active: false })
  assert.equal(view.refs.typingTimers.current.size, 0)
  source.emit('typing', { userId: 'peer', displayName: 'Peer', active: true })
  view.requests.length = 0
  source.emit('message.reactions', { messageId: 'message' })
  assert.equal(view.requests[0][0], '/api/chats/chat/messages?before_seq=2&limit=1')
  for (const event of ['message.created', 'message.updated', 'message.pinned', 'membership.changed']) source.emit(event, {})
  assert.equal(view.requests.filter(([path]) => path.includes('/messages?after_seq=')).length, 3)
  assert.equal(view.requests.filter(([path]) => path.endsWith('/messages?limit=50')).length, 1)
  const wake = view.listeners.get('syncup-refresh-chat')
  view.window = view.globals.window
  view.window.dispatchEvent(new Event('syncup-refresh-chat'))
  const fallback = [...view.timers.values()].find(({ interval }) => interval)
  assert.equal(fallback.delay, 30000)
  view.globals.navigator.onLine = false
  const count = view.requests.length
  fallback.callback()
  assert.equal(view.requests.length, count)
  view.globals.navigator.onLine = true
  fallback.callback()
  assert.equal(view.requests.length, count + 4)
  cleanup()
  assert.equal(source.closed, true)
  assert.equal(view.refs.typingTimers.current.size, 0)
  assert.equal(view.timers.size, 0)
  assert.ok(view.removed.some(([name, callback]) => name === 'syncup-refresh-chat' && callback === wake))
  await settle()
})

test('Conversation scroll thresholds retain <80 bottom stick and <120 older load, with cursor prepend/anchor restoration', async () => {
  const view = conversation({ seed: { chat, messages: [message], hasOlderMessages: true, loading: false }, api: async () => ({ messages: [{ ...message, id: 'older', server_seq: '0' }, message], hasMore: false }) })
  const container = { scrollHeight: 500, scrollTop: 120, clientHeight: 300 }
  view.refs.messageListRef.current = container
  view.find('MessageList').props.onScroll()
  assert.equal(view.requests.length, 0)
  assert.equal(view.refs.shouldStickToBottom.current, false)
  container.scrollTop = 121
  view.find('MessageList').props.onScroll()
  assert.equal(view.refs.shouldStickToBottom.current, true)
  container.scrollTop = 119
  view.find('MessageList').props.onScroll()
  assert.equal(view.requests[0][0], '/api/chats/chat/messages?before_seq=1&limit=50')
  assert.equal(view.state.loadingOlder, true)
  await settle()
  assert.deepEqual(plain(view.state.messages.map(({ id }) => id)), ['older', 'message'])
  assert.deepEqual(plain(view.refs.scrollAnchor.current), { height: 500, top: 119 })
  assert.equal(view.refs.loadingOlderRef.current, false)
  container.scrollHeight = 700
  view.render()
  view.effects.find(({ kind }) => kind === 'layout').callback()
  assert.equal(container.scrollTop, 319)
  assert.equal(view.refs.scrollAnchor.current, null)
})

test('Conversation encrypted edit preserves encrypt/PATCH/draft-save/load/refresh sequence', async () => {
  const view = conversation({ seed: { chat, messages: [message], editingMessage: message, draft: '  edited  ' } })
  let prevented = 0
  await view.find('MessageComposer').props.onSubmit({ preventDefault() { prevented++ } })
  assert.equal(prevented, 1)
  const important = view.trace.filter(([kind, path]) => kind === 'encrypt' || kind === 'saveDraft' || kind === 'api' && path.startsWith('/api/messages'))
  assert.deepEqual(important.map(([kind]) => kind), ['encrypt', 'api', 'saveDraft'])
  assert.equal(important[0][1], 'edited')
  assert.equal(important[1][1], '/api/messages/message')
  assert.equal(important[1][2].method, 'PATCH')
  assert.equal(important[1][2].body, '{"bodyCiphertext":"encrypted","bodyNonce":"nonce","keyEnvelopes":{"me":"envelope"}}')
  assert.equal(view.state.editingMessage, null)
  assert.equal(view.state.draft, '')
  assert.equal(view.refs.submittingRef.current, false)
  assert.equal(view.state.submitting, false)
})

test('Conversation new send preserves encryption/pending/queued/draft clearing/reply/Media v2 tracking and wake-after-refresh', async () => {
  const view = conversation({ seed: { chat, messages: [message], draft: '  send  ', replyTo: message, stagedAttachments: [{ id: 'attachment', transport_version: 2 }] } })
  view.refs.stagedFileKeys.current.set('attachment', 'file')
  await view.find('MessageComposer').props.onSubmit({ preventDefault() {} })
  const pending = view.trace.find(([kind]) => kind === 'pending')[1]
  assert.equal(pending.bodyCiphertext, 'encrypted')
  assert.equal(pending.replyToId, message.id)
  assert.deepEqual(plain(pending.attachmentIds), ['attachment'])
  assert.equal(pending.attempts, 0)
  assert.equal(pending.nextAttemptAt, 0)
  assert.deepEqual(view.trace.filter(([kind]) => ['encrypt', 'pending', 'queued', 'saveDraft', 'refreshInbox', 'event'].includes(kind)).map(([kind]) => kind), ['encrypt', 'pending', 'queued', 'saveDraft', 'refreshInbox', 'event'])
  assert.deepEqual(view.events, ['syncup-outbox-wake'])
  assert.equal(view.state.draft, '')
  assert.equal(view.state.replyTo, null)
  assert.equal(view.state.stagedAttachments.length, 0)
  assert.equal(view.refs.stagedFileKeys.current.size, 0)
  assert.equal(view.refs.sentV2AttachmentIds.current.has('attachment'), true)
})

test('Conversation attachment callback retains encryption/intent/content/complete ordering and staged envelope', async () => {
  const view = conversation({ seed: { chat } })
  const file = { name: 'image.png', type: 'image/png', size: 2, lastModified: 1 }
  view.find('MessageComposer').props.onUpload(file)
  await settle()
  assert.deepEqual(view.trace.filter(([kind]) => ['encryptAttachment', 'api', 'upload'].includes(kind)).map(([kind, path]) => [kind, typeof path === 'string' ? path : path.name]), [['encryptAttachment', 'image.png'], ['api', '/api/uploads/intent'], ['upload', '/api/uploads/attachment/content'], ['api', '/api/uploads/attachment/complete']])
  assert.equal(view.requests[0][1].body, '{"chatId":"chat","filename":"image.png","contentType":"image/png","sizeBytes":2,"nonce":"nonce","keyEnvelopes":{"me":"envelope"}}')
  assert.equal(view.state.stagedAttachments[0].key_envelope, 'envelope')
  assert.equal(view.state.uploading, false)
  assert.equal(view.refs.uploadingFileKeys.current.size, 0)
})

test('Conversation group call intent is consumed before key creation/API/callback and is handled once', async () => {
  const view = conversation({ seed: { chat: { ...chat, kind: 'group', title: 'Group' } }, props: { callIntent: { id: 'intent', chatId: 'chat', callType: 'video' } } })
  const cleanup = view.mount()
  await settle()
  const order = view.trace.filter(([kind, path]) => ['intentConsumed', 'groupKey', 'callStarted'].includes(kind) || kind === 'api' && path === '/api/group-calls')
  assert.deepEqual(order.map(([kind]) => kind), ['intentConsumed', 'groupKey', 'api', 'callStarted'])
  assert.equal(order[2][2].body, '{"chatId":"chat","callType":"video","keyEnvelopes":{"me":"group-envelope"}}')
  assert.equal(order[3][1].isHost, true)
  assert.deepEqual([...order[3][1].e2eeKey], [7, 8])
  cleanup()
  view.render()
  const end = view.mount()
  await settle()
  assert.equal(view.trace.filter(([kind]) => kind === 'intentConsumed').length, 1)
  end()
})
