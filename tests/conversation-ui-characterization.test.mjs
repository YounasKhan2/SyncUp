import test from 'node:test'
import assert from 'node:assert/strict'
import { conversation, chat, message, settle } from './helpers/conversation-harness.mjs'
import { plain } from './helpers/foundation-harness.mjs'

const subject = (options = {}) => conversation({ ...options, seed: { chat, loading: false, messages: [message], ...options.seed } })

test('Conversation no-chat welcome retains identity/copy and omits header/list/composer', () => {
  const view = subject({ props: { chatId: null } })
  assert.equal(view.all((node) => node.props.className === 'conversation-pane welcome-pane').length, 1)
  assert.equal(view.find('Avatar').props.name, 'Me')
  assert.equal(view.find('Avatar').props.className, 'avatar-card')
  assert.ok(JSON.stringify(view.render()).includes('PRIVATE BY DESIGN'))
  for (const name of ['ConversationHeader', 'MessageList', 'MessageComposer']) assert.equal(view.find(name), undefined)
  assert.equal(view.requests.length, 0)
})

test('Conversation begin edit selects message, clears reply and preserves exact text in draft', () => {
  const view = subject({ seed: { replyTo: { ...message, id: 'reply' }, draft: 'old' } })
  const selected = { ...message, text: '  Edit exactly  ' }
  view.find('MessageList').props.onEdit(selected)
  assert.equal(view.state.editingMessage, selected)
  assert.equal(view.state.replyTo, null)
  assert.equal(view.state.draft, selected.text)
  view.render()
  assert.equal(view.find('MessageComposer').props.replyTo, selected)
  assert.equal(view.find('MessageComposer').props.editing, true)
})

test('Conversation cancel edit clears/persists draft but retains independently selected reply', async () => {
  const reply = { ...message, id: 'reply' }
  const view = subject({ seed: { editingMessage: message, replyTo: reply, draft: 'edit' } })
  view.find('MessageComposer').props.onClearReply()
  await settle()
  assert.equal(view.state.editingMessage, null)
  assert.equal(view.state.draft, '')
  assert.equal(view.state.replyTo, reply)
  assert.deepEqual(view.trace.filter(([kind]) => kind === 'saveDraft'), [['saveDraft', 'chat', '']])
})

test('Conversation reply while editing retains edit/draft; cancel reply alone retains draft', () => {
  const view = subject({ seed: { editingMessage: message, draft: 'editing' } })
  const reply = { ...message, id: 'reply' }
  view.find('MessageList').props.onReply(reply)
  assert.equal(view.state.replyTo, reply)
  assert.equal(view.state.editingMessage, message)
  assert.equal(view.state.draft, 'editing')
  view.render()
  assert.equal(view.find('MessageComposer').props.replyTo, message)
  view.state.editingMessage = null
  view.render()
  view.find('MessageComposer').props.onClearReply()
  assert.equal(view.state.replyTo, null)
  assert.equal(view.state.draft, 'editing')
})

test('Conversation report selection mounts exact message ID and close clears only report state', () => {
  const view = subject({ seed: { detailsOpen: true, messageSearch: 'retain' } })
  view.find('MessageList').props.onReport(message)
  view.render()
  assert.equal(view.find('ReportDialog').props.messageId, message.id)
  view.find('ReportDialog').props.onClose()
  assert.equal(view.state.reportingMessageId, null)
  assert.equal(view.state.detailsOpen, true)
  assert.equal(view.state.messageSearch, 'retain')
})

test('Conversation details open hides conversation, back restores it, and chat-less details do not mount', () => {
  const view = subject()
  view.find('ConversationHeader').props.onOpenDetails()
  view.render()
  assert.equal(view.find('ChatDetailsScreen').props.chatId, 'chat')
  assert.equal(view.all((node) => node.props['aria-hidden'] === true).length, 1)
  view.find('ChatDetailsScreen').props.onBack()
  assert.equal(view.state.detailsOpen, false)
  const loading = subject({ seed: { chat: null, detailsOpen: true } })
  assert.equal(loading.find('ChatDetailsScreen'), undefined)
  assert.equal(loading.find('ConversationHeader').props.canOpenDetails, false)
})

test('Conversation search toggle retains query while explicit close clears it; input stores exact value', () => {
  const view = subject({ seed: { messageSearch: 'retained' } })
  view.find('ConversationHeader').props.onSearchMessages()
  view.render()
  const input = view.all((node) => node.type === 'input' && node.props['aria-label'] === 'Search messages in this conversation')[0]
  assert.equal(input.props.autoFocus, true)
  input.props.onChange({ target: { value: '  Original  ' } })
  assert.equal(view.state.messageSearch, '  Original  ')
  view.find('ConversationHeader').props.onSearchMessages()
  assert.equal(view.state.messageSearchOpen, false)
  assert.equal(view.state.messageSearch, '  Original  ')
  view.find('ConversationHeader').props.onSearchMessages()
  view.render()
  view.all((node) => node.props['aria-label'] === 'Close message search')[0].props.onClick()
  assert.equal(view.state.messageSearchOpen, false)
  assert.equal(view.state.messageSearch, '')
})

test('Conversation on-device search filters pending/deleted messages using trimmed case-insensitive text and keeps empty copy', () => {
  const view = subject({ seed: { messageSearchOpen: true, messageSearch: ' ORIGINAL ', messages: [message, { ...message, id: 'deleted', deleted_at: 'now' }] },
    props: { pending: [{ chatId: 'chat', localId: 'pending', keyEnvelopes: {}, createdAt: 'now', attempts: 0 }] } })
  assert.deepEqual(plain(view.find('MessageList').props.messages.map(({ id }) => id)), [message.id])
  assert.equal(view.find('MessageList').props.emptyMessage, 'No matching loaded messages. Search is performed only on this device.')
  assert.ok(view.all((node) => node.type === 'span' && node.props.children === '1 matches').length)
})

test('Conversation search jump forwards IDs to existing highlight without clearing search, using smooth/center and 1600 ms', () => {
  const actions = []
  const target = { scrollIntoView: (options) => actions.push(plain(options)), classList: { add: (name) => actions.push(name), remove: (name) => actions.push(`remove:${name}`) } }
  const view = subject({ seed: { messageSearchOpen: true, messageSearch: 'Original' }, target })
  view.find('MessageList').props.onJumpToMessage(message.id, message.server_seq)
  assert.deepEqual(actions, [{ behavior: 'smooth', block: 'center' }, 'message-jump-highlight'])
  assert.equal(view.trace.find(([kind]) => kind === 'element')[1], 'message-message')
  assert.equal(view.state.messageSearch, 'Original')
  assert.equal(view.state.messageSearchOpen, true)
  const timer = [...view.timers.values()][0]
  assert.equal(timer.delay, 1600)
  timer.callback()
  assert.equal(actions.at(-1), 'remove:message-jump-highlight')
})

test('Conversation back/details leave dispatch close-chat; details refresh/conversion preserve callback order', async () => {
  const view = subject({ seed: { detailsOpen: true } })
  view.find('ConversationHeader').props.onBack()
  assert.deepEqual(view.events, ['syncup-close-chat'])
  view.trace.length = 0
  view.find('ChatDetailsScreen').props.onLeave()
  assert.deepEqual(view.trace, [['event', 'syncup-close-chat'], ['refreshInbox']])
  view.find('ChatDetailsScreen').props.onConverted('space', 'channel')
  assert.deepEqual(view.trace.at(-1), ['converted', 'space', 'channel'])
  view.find('ChatDetailsScreen').props.onMembersChanged()
  await settle()
  assert.ok(view.requests.some(([path]) => path === '/api/chats/chat/messages?after_seq=0&limit=100'))
})

test('Conversation header call callbacks forward audio/video to direct start with existing callback payload', async () => {
  for (const type of ['audio', 'video']) {
    const view = subject()
    view.find('ConversationHeader').props.onStartCall(type)
    await settle()
    assert.deepEqual(plain(view.requests[0]), ['/api/calls', { method: 'POST', body: JSON.stringify({ chatId: 'chat', callType: type }) }])
    assert.deepEqual(plain(view.trace.find(([kind]) => kind === 'callStarted')[1]), { id: 'started', chatId: 'chat', callType: type, title: 'Peer' })
    assert.equal(view.state.callStarting, false)
  }
})

test('Conversation composer draft/typing/attachment/voice callbacks retain current owners and cleanup', async () => {
  const view = subject({ seed: { stagedAttachments: [{ id: 'attachment' }, { id: 'keep' }] } })
  view.refs.stagedFileKeys.current.set('attachment', 'file-key')
  const composer = view.find('MessageComposer').props
  composer.onDraftChange('draft')
  assert.equal(view.state.draft, 'draft')
  composer.onTypingChange(' text ')
  await settle()
  assert.ok(view.requests.some(([path, options]) => path === '/api/chats/chat/typing' && options.body === '{"active":true}'))
  composer.onRemoveAttachment('attachment')
  assert.deepEqual(view.state.stagedAttachments.map(({ id }) => id), ['keep'])
  assert.equal(view.refs.stagedFileKeys.current.has('attachment'), false)
  const voice = { url: 'blob:voice', file: {}, durationMs: 1000, waveform: [1] }
  composer.onVoiceReady(voice)
  view.render()
  view.find('MessageComposer').props.onDeleteVoice()
  assert.equal(view.state.voiceDraft, null)
  assert.ok(view.trace.some(([kind, url]) => kind === 'revoke' && url === voice.url))
})

test('Conversation upload/retry/cancel/voice-send callbacks reach existing media owners', async () => {
  const view = subject()
  view.find('MessageList').props.onRetryMedia('retry-job')
  view.find('MessageList').props.onCancelMedia('cancel-job')
  const file = { name: 'clip.mp4', type: 'video/mp4', size: 20, lastModified: 1 }
  view.find('MessageComposer').props.onUpload(file)
  await settle()
  assert.ok(view.trace.some(([kind, supplied]) => kind === 'prepareVideo' && supplied === file))
  assert.ok(view.trace.some(([kind, id]) => kind === 'resume' && id === 'retry-job'))
  assert.ok(view.trace.some(([kind, id]) => kind === 'cancel' && id === 'cancel-job'))
  const voice = { file: {}, durationMs: 1000, waveform: [1], url: 'blob:voice' }
  view.find('MessageComposer').props.onVoiceReady(voice)
  view.render()
  view.find('MessageComposer').props.onSendVoice()
  await settle()
  assert.deepEqual(view.trace.filter(([kind]) => ['prepareVoice', 'track', 'revoke'].includes(kind)).map(([kind]) => kind), ['prepareVoice', 'track', 'revoke'])
  assert.equal(view.state.voiceDraft, null)
  assert.equal(view.state.uploading, false)
})

test('Conversation message reaction/delete/pin/copy callbacks reach existing mutation functions', async () => {
  const view = subject()
  const list = view.find('MessageList').props
  list.onReact(message, '👍')
  await settle()
  assert.equal(view.requests[0][0], '/api/messages/message/reactions')
  assert.equal(view.requests[0][1].body, '{"emoji":"👍"}')
  assert.deepEqual(plain(view.state.messages[0].reactions), [{ user_id: 'me', emoji: '👍' }])
  list.onPin(message)
  await settle()
  assert.equal(view.state.messages[0].pinned_at, 'now')
  list.onCopy(message)
  await settle()
  assert.ok(view.trace.some(([kind, text]) => kind === 'copy' && text === message.text))
  list.onDelete(message, 'everyone')
  await settle()
  assert.ok(view.trace.some(([kind]) => kind === 'confirm'))
  assert.ok(view.requests.some(([path, options]) => path === '/api/messages/message/delete' && options.body === '{"scope":"everyone"}'))
})
