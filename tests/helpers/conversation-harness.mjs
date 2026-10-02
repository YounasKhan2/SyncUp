import ts from 'typescript'
import * as runtime from 'react/jsx-runtime'
import { load, source } from './foundation-harness.mjs'
import { nodes } from './ui-harness.mjs'

const base = 'client/src/features/messaging/'
export const chat = { id: 'chat', kind: 'direct', title: null, last_seq: '0', last_read_seq: '0', members: [{ id: 'me', displayName: 'Me', username: 'me' }, { id: 'peer', displayName: 'Peer', username: 'peer' }] }
export const message = { id: 'message', chat_id: 'chat', server_seq: '1', sender_id: 'peer', text: 'Original text', created_at: '2026-10-02T10:00:00Z', deleted_at: null, body_ciphertext: 'cipher', body_nonce: 'nonce', key_envelope: 'key', reactions: [] }
export const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve() }

// Real production component/functions with named state/ref slots and explicit
// network/crypto/storage/media boundaries. No React scheduling or DOM simulation:
// document only exposes the one highlighted element supplied by a test.
export function conversation({ seed = {}, props = {}, api, decrypt, draft = async () => '', target = null, pageSource } = {}) {
  const state = { ...seed }
  const refs = {}
  const setters = new Map()
  const effects = []
  const trace = []
  const requests = []
  const events = []
  const timers = new Map()
  const listeners = new Map()
  const removed = []
  const sources = []
  let timerId = 0
  const window = {
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback() { timers.delete(id); callback() }, delay, interval: false }); return id },
    setInterval(callback, delay) { timers.set(++timerId, { callback, delay, interval: true }); return timerId },
    clearTimeout(id) { timers.delete(id) }, clearInterval(id) { timers.delete(id) },
    addEventListener(name, callback) { listeners.set(name, callback) },
    removeEventListener(name, callback) { removed.push([name, callback]); if (listeners.get(name) === callback) listeners.delete(name) },
    dispatchEvent(event) { events.push(event.type); trace.push(['event', event.type]); listeners.get(event.type)?.(event) },
    confirm() { trace.push(['confirm']); return true },
  }
  class EventSource {
    constructor(url) { this.url = url; this.listeners = new Map(); this.closed = false; sources.push(this) }
    addEventListener(name, callback) { this.listeners.set(name, callback) }
    close() { this.closed = true }
    emit(name, data) { this.listeners.get(name)?.({ data: JSON.stringify(data) }) }
  }
  const globals = { window, Event, EventSource, navigator: { onLine: true, clipboard: { async writeText(text) { trace.push(['copy', text]) } } },
    document: { getElementById(id) { trace.push(['element', id]); return target } },
    URL: { revokeObjectURL(url) { trace.push(['revoke', url]) } }, crypto: { randomUUID: () => 'uuid' },
    __state(name, initial) {
      if (!(name in state)) state[name] = typeof initial === 'function' ? initial() : initial
      if (!setters.has(name)) setters.set(name, (value) => { state[name] = typeof value === 'function' ? value(state[name]) : value; trace.push(['state', name, state[name]]) })
      return [state[name], setters.get(name)]
    },
    __ref(name, initial) { return refs[name] ??= { current: initial } },
  }
  const react = { useCallback: (callback) => callback, useMemo: (callback) => callback(),
    useEffect: (callback, dependencies) => effects.push({ callback, dependencies, kind: 'effect' }),
    useLayoutEffect: (callback, dependencies) => effects.push({ callback, dependencies, kind: 'layout' }) }
  const transport = async (path, options) => {
    requests.push([path, options]); trace.push(['api', path, options])
    if (api) return api(path, options)
    if (path === '/api/calls' || path === '/api/group-calls') return { call: { id: 'started' } }
    if (path === '/api/uploads/intent') return { attachmentId: 'attachment' }
    if (path.endsWith('/reactions')) return { active: true }
    if (path.endsWith('/pin')) return { pinned: true, pinned_at: 'now', pinned_by: 'me' }
    return { chat: state.chat ?? chat, messages: [], calls: [], hasMore: false }
  }
  const media = {
    subscribe(callback) { trace.push(['subscribe']); this.callback = callback; return () => trace.push(['unsubscribe']) },
    async track(job) { trace.push(['track', job]) }, async resume(id) { trace.push(['resume', id]) }, async cancel(id) { trace.push(['cancel', id]) },
  }
  const component = (name) => ({ [name]: (props) => runtime.jsx(name, Object.fromEntries(Object.keys(props).filter((key) => key !== 'key').map((key) => [key, props[key]]))) })
  const mocks = {
    react, 'react/jsx-runtime': runtime,
    'lucide-react': new Proxy({}, { get: (_, name) => (props) => runtime.jsx(`icon:${String(name)}`, props) }),
    '../../shared/api': { api: transport, async apiUpload(path, bytes) { trace.push(['upload', path, bytes]) } },
    '../auth/crypto/crypto': {
      async decryptMessage(input) { trace.push(['decrypt', input]); return decrypt ? decrypt(input) : 'decrypted' },
      async encryptMessage(text, members) { trace.push(['encrypt', text, members]); return { bodyCiphertext: 'encrypted', bodyNonce: 'nonce', keyEnvelopes: { me: 'envelope' } } },
      async encryptAttachment(file, members) { trace.push(['encryptAttachment', file, members]); return { ciphertext: new Uint8Array([1, 2]), nonce: 'nonce', keyEnvelopes: { me: 'envelope' } } },
    },
    './outbox': { async loadDraft(id) { trace.push(['loadDraft', id]); return draft(id) }, async saveDraft(id, value) { trace.push(['saveDraft', id, value]) }, async savePendingMessage(value) { trace.push(['pending', value]) } },
    '../media/v2/prepareVideo': { async prepareVideoV2(...args) { trace.push(['prepareVideo', ...args]) } },
    '../media/v2/prepareVoice': { async prepareVoiceV2(...args) { trace.push(['prepareVoice', ...args]); return { id: 'voice-job' } } },
    '../media/v2/runtime': { mediaV2UploadManager: media },
    '../calls/groupCallCrypto': { async createGroupCallKey(members) { trace.push(['groupKey', members]); return { rawKey: new Uint8Array([7, 8]), keyEnvelopes: { me: 'group-envelope' } } } },
    '../../shared/components/BrandMark': component('BrandMark'), '../../shared/components/Avatar': component('Avatar'),
  }
  for (const name of ['ConversationHeader', 'ChatDetailsScreen', 'MessageComposer', 'MessageList', 'ReportDialog']) mocks[`./${name}`] = component(name)
  function transformed(path, text = source(path)) {
    const tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const edits = []
    function visit(node) {
      if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer)) {
        const call = node.initializer
        const hook = call.expression.getText(tree)
        const stateHook = hook === 'useState' && ts.isArrayBindingPattern(node.name)
        if (stateHook || hook === 'useRef') {
          const name = stateHook ? node.name.elements[0].getText(tree) : node.name.getText(tree)
          edits.push([call.getStart(tree), call.end, `${stateHook ? '__state' : '__ref'}(${JSON.stringify(name)}, ${call.arguments[0].getText(tree)})`])
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(tree)
    return edits.sort((a, b) => b[0] - a[0]).reduce((text, [start, end, value]) => text.slice(0, start) + value + text.slice(end), text)
  }
  for (const [name, extension] of [['useConversationUiState', 'ts'], ['ConversationWelcome', 'tsx']]) {
    const path = `${base}${name}.${extension}`
    try { mocks[`./${name}`] = load(path, mocks, globals, transformed(path)) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  const module = load(`${base}Conversation.tsx`, mocks, globals, transformed(`${base}Conversation.tsx`, pageSource))
  const inputs = { user: { id: 'me', display_name: 'Me', username: 'me' }, chatId: 'chat', online: true, pending: [], callIntent: null,
    refreshInbox: () => trace.push(['refreshInbox']), onQueued: (value) => trace.push(['queued', value]), onCallStarted: (value) => trace.push(['callStarted', value]), onCallIntentConsumed: (id) => trace.push(['intentConsumed', id]), onSearchableMessages: (...args) => trace.push(['searchable', ...args]), onGroupConverted: (...args) => trace.push(['converted', ...args]), ...props }
  let tree
  function expand(node) {
    if (!node || typeof node !== 'object') return node
    if (Array.isArray(node)) return node.map(expand)
    if (typeof node.type === 'function') return expand(node.type(node.props))
    return { type: node.type, props: { ...node.props, children: expand(node.props.children) } }
  }
  function render() { effects.length = 0; tree = expand(module.Conversation(inputs)); return tree }
  render()
  return { state, refs, effects, requests, events, trace, timers, sources, listeners, removed, globals, inputs, media, render,
    find: (type) => nodes(tree, (node) => node.type === type)[0], all: (predicate) => nodes(tree, predicate),
    mount() { const cleanups = effects.map(({ callback }) => callback()); return () => cleanups.forEach((cleanup) => cleanup?.()) },
  }
}
