import ts from 'typescript'
import * as jsx from 'react/jsx-runtime'
import { load, source } from './foundation-harness.mjs'
import { nodes } from './ui-harness.mjs'

export const permissions = ['moderator', 'member', 'guest'].map(role => ({ role, can_view: true, can_send: true, can_speak: true }))
export const member = { id: 'me', username: 'sam', display_name: 'Sam' }
export const channel = { id: 'text', name: 'general', type: 'discussion', category_id: 'category', category_name: 'Project', topic: 'Project updates', can_send: true, can_speak: false, members: [member], permissions }
export const space = { id: 'space', name: 'Project', description: 'Team work', icon: 'layers', role: 'owner', categories: [{ id: 'category', name: 'Project' }], channels: [channel], members: [{ ...member, role: 'owner' }] }
export const message = { id: 'message', chat_id: 'text', server_seq: '7', sender_id: 'me', display_name: 'Sam', username: 'sam', body: 'Hello @sam @everyone', mentions: [member], everyone_mentioned: true, is_mentioned: true, created_at: '2026-10-02T10:00:00Z' }
export const legacy = { id: 'legacy', chat_id: 'text', server_seq: '10', sender_id: 'me', text: 'Earlier message', body_ciphertext: 'cipher', body_nonce: 'nonce', key_envelope: 'envelope', deleted_at: null, attachments: [], reactions: [], created_at: '2026-10-02T09:00:00Z' }
export const settle = async () => { for (let i = 0; i < 40; i++) await Promise.resolve() }

// Execute real component/functions with named state/ref slots and explicit
// transport/decrypt/child boundaries. This does not model React scheduling or DOM.
export function spacesPage({ seed = {}, props = {}, api, decrypt, target = null, pageSource } = {}) {
  const state = { ...seed }, refs = {}, effects = [], trace = [], requests = [], timers = new Map(), sources = []
  let timerId = 0
  const setters = new Map()
  const window = {
    setInterval(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay, interval: true }); return id },
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback() { timers.delete(id); callback() }, delay, interval: false }); return id },
    clearInterval(id) { timers.delete(id) }, clearTimeout(id) { timers.delete(id) },
    prompt() { trace.push(['prompt']); return '  Decision  ' },
  }
  class EventSource {
    constructor(url) { this.url = url; this.listeners = new Map(); sources.push(this) }
    addEventListener(name, callback) { this.listeners.set(name, callback) }
    close() { this.closed = true }
    emit(name) { this.listeners.get(name)?.() }
  }
  const globals = { window, EventSource, AbortController, URLSearchParams,
    document: { getElementById(id) { trace.push(['element', id]); return target } },
    __state(name, initial) {
      if (!(name in state)) state[name] = typeof initial === 'function' ? initial() : initial
      if (!setters.has(name)) setters.set(name, value => { state[name] = typeof value === 'function' ? value(state[name]) : value; trace.push(['state', name, state[name]]) })
      return [state[name], setters.get(name)]
    }, __ref(name, initial) { return refs[name] ??= { current: initial } },
  }
  const transport = async (path, options) => {
    requests.push([path, options]); trace.push(['api', path, options])
    return api ? api(path, options) : { spaces: [space], space, messages: [], objects: [], files: [], results: [], hasMore: false, fileId: 'file', channelId: 'text', category: { id: 'category' } }
  }
  const child = name => ({ [name]: props => jsx.jsx(name, Object.fromEntries(Object.entries(props).filter(([key]) => key !== 'key'))) })
  const mocks = { react: { useEffect: (callback, dependencies) => effects.push({ callback, dependencies }) }, 'react/jsx-runtime': jsx,
    'lucide-react': new Proxy({}, { get: (_, name) => props => jsx.jsx(`icon:${String(name)}`, props) }),
    '../../shared/api': { api: transport, async apiUpload(...args) { trace.push(['upload', ...args]) } },
    '../auth/crypto/crypto': { async decryptMessage(input) { trace.push(['decrypt', input]); return decrypt ? decrypt(input) : 'clear text' } },
    '../messaging/MessageAttachment': child('MessageAttachment'), './SharedObjectCard': child('SharedObjectCard'),
  }
  function transformed(path, text = source(path)) {
    const tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), edits = []
    function visit(node) {
      if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer)) {
        const call = node.initializer, hook = call.expression.getText(tree)
        if (hook === 'useState' || hook === 'useRef') {
          const name = hook === 'useState' ? node.name.elements[0].getText(tree) : node.name.getText(tree)
          edits.push([call.getStart(tree), call.end, `${hook === 'useState' ? '__state' : '__ref'}(${JSON.stringify(name)}, ${call.arguments[0].getText(tree)})`])
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(tree)
    return edits.sort((a, b) => b[0] - a[0]).reduce((text, [start, end, value]) => text.slice(0, start) + value + text.slice(end), text)
  }
  for (const name of ['SpaceVoiceChannelView', 'SpaceLegacyHistoryView']) {
    const path = `client/src/features/spaces/${name}.tsx`
    try { mocks[`./${name}`] = load(path, mocks) } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  const path = 'client/src/features/spaces/SpacesPage.tsx'
  const module = load(path, mocks, globals, transformed(path, pageSource))
  const inputs = { userId: 'me', onBack: () => trace.push(['back']), onJoinVoiceRoom: call => trace.push(['voice', call]), openTarget: null, ...props }
  let tree
  function expand(node) {
    if (!node || typeof node !== 'object') return node
    if (Array.isArray(node)) return node.map(expand)
    if (typeof node.type === 'function') return expand(node.type(node.props))
    return { type: node.type, props: { ...node.props, children: expand(node.props.children) } }
  }
  function render() { effects.length = 0; tree = expand(module.SpacesPage(inputs)); return tree }
  render()
  const find = predicate => nodes(tree, predicate)[0]
  return { state, refs, effects, trace, requests, timers, sources, globals, inputs, render, find,
    all: predicate => nodes(tree, predicate),
    cls: value => find(node => node.props?.className?.split(' ').includes(value)),
    aria: value => find(node => node.props?.['aria-label'] === value),
    text: value => find(node => node.type === 'button' && JSON.stringify(node.props.children).includes(value)),
    mount() { const cleanups = effects.map(({ callback }) => callback()); return () => cleanups.forEach(cleanup => cleanup?.()) },
  }
}
