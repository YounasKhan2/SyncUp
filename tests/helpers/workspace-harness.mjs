import ts from 'typescript'
import * as runtime from 'react/jsx-runtime'
import { load, source } from './foundation-harness.mjs'
import { nodes } from './ui-harness.mjs'

const base = 'client/src/features/workspace/'

// Execute the real component, JSX callbacks, and extracted modules. Name hook
// slots in the test transform so moving state does not couple tests to slot order.
// This models state setters, not React scheduling or a browser DOM.
export function workspace({ seed = {}, narrow = false, api, pageSource } = {}) {
  const state = { ...seed }
  const setters = new Map()
  const effects = []
  const requests = []
  const listeners = new Map()
  const removed = []
  const timers = new Map()
  const cleared = []
  let nextTimer = 0
  const window = {
    matchMedia(query) { if (query !== '(max-width: 700px)') throw new Error(query); return { matches: narrow } },
    addEventListener(name, callback) { listeners.set(name, callback) },
    removeEventListener(name, callback) { removed.push([name, callback]); if (listeners.get(name) === callback) listeners.delete(name) },
    setInterval(callback, delay) { timers.set(++nextTimer, { callback, delay, interval: true }); return nextTimer },
    setTimeout(callback, delay) { timers.set(++nextTimer, { callback, delay, interval: false }); return nextTimer },
    clearInterval(id) { cleared.push(id); timers.delete(id) },
    clearTimeout(id) { cleared.push(id); timers.delete(id) },
    dispatchEvent(event) { listeners.get(event.type)?.(event) },
  }
  const globals = { window, navigator: { onLine: true }, crypto: { randomUUID: () => 'intent-id' }, Event,
    __state(name, initial) {
      if (!(name in state)) state[name] = typeof initial === 'function' ? initial() : initial
      if (!setters.has(name)) setters.set(name, (value) => { state[name] = typeof value === 'function' ? value(state[name]) : value })
      return [state[name], setters.get(name)]
    },
  }
  const react = { useCallback: (callback) => callback, useRef: (current) => ({ current }),
    useEffect: (callback, dependencies) => effects.push({ callback, dependencies }) }
  const transport = async (path, options) => {
    requests.push([path, options])
    return api ? api(path, options) : { calls: [], chats: [], requests: [] }
  }
  const component = (name) => ({ [name]: (props) => runtime.jsx(name, Object.fromEntries(Object.keys(props).filter((key) => key !== 'key').map((key) => [key, props[key]]))) })
  const mocks = {
    react, 'react/jsx-runtime': runtime,
    'lucide-react': new Proxy({}, { get: (_, name) => (props) => runtime.jsx(`icon:${String(name)}`, props) }),
    '../../shared/api': { api: transport },
    '../auth/crypto/crypto': { decryptMessage: async () => 'preview', lockKeyBundle() {}, unwrapMediaKey: async () => new Uint8Array(32) },
    '../messaging/outbox': { listAllDrafts: async () => ({}), listPendingMessages: async () => [], removePendingMessage: async () => {}, savePendingMessage: async () => {} },
    '../../shared/presentation': { countUnreadConversations: () => 0 },
    '../../shared/appearance': { readAppearancePreference: () => 'system', saveAppearancePreference() {}, applyAppearancePreference() {} },
    '../../shared/components/Avatar': component('Avatar'),
    '../../../shared/components/Avatar': component('Avatar'),
  }
  for (const [directory, name] of [['account', 'AccountPanel'], ['messaging', 'NewConversation'], ['messaging', 'RequestsPanel'], ['messaging', 'SearchDialog'], ['messaging', 'Conversation'], ['calls', 'CallWindow'], ['spaces', 'SpacesPage'], ['spaces', 'UpdatesPage']]) {
    mocks[`../${directory}/${name}`] = component(name)
  }
  for (const name of ['InboxPane', 'MobileNavigation', 'WorkspaceRail']) mocks[`./components/${name}`] = component(name)
  function transformed(path, text = source(path)) {
    const tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const edits = []
    function visit(node) {
      if (ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name)
        && ts.isCallExpression(node.initializer) && node.initializer.expression.getText(tree) === 'useState') {
        edits.push([node.initializer.getStart(tree), node.initializer.end,
          `__state(${JSON.stringify(node.name.elements[0].getText(tree))}, ${node.initializer.arguments[0].getText(tree)})`])
      }
      ts.forEachChild(node, visit)
    }
    visit(tree)
    return edits.sort((a, b) => b[0] - a[0]).reduce((output, [start, end, value]) => output.slice(0, start) + value + output.slice(end), text)
  }
  // Optional during baseline characterization; actual modules execute once added.
  for (const [name, extension] of [['useWorkspaceNavigation', 'ts'], ['CallsHome', 'tsx'], ['IncomingCallBanner', 'tsx']]) {
    const category = name === 'useWorkspaceNavigation' ? 'hooks' : 'components'
    const path = `${base}${category}/${name}.${extension}`
    try { mocks[`./${category}/${name}`] = load(path, mocks, globals, transformed(path)) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  const page = load(`${base}WorkspacePage.tsx`, mocks, globals, transformed(`${base}WorkspacePage.tsx`, pageSource))
  let tree
  function expand(node) {
    if (!node || typeof node !== 'object') return node
    if (Array.isArray(node)) return node.map(expand)
    if (typeof node.type === 'function') return expand(node.type(node.props))
    return { type: node.type, props: { ...node.props, children: expand(node.props.children) } }
  }
  function render() { effects.length = 0; tree = expand(page.WorkspacePage({ user: { id: 'user', display_name: 'User' }, onSignedOut() {} })); return tree }
  render()
  return { state, effects, requests, window, listeners, removed, timers, cleared, globals, render,
    find: (type) => nodes(tree, (node) => node.type === type)[0],
    all: (predicate) => nodes(tree, predicate),
    mountEffects() { const cleanups = effects.map(({ callback }) => callback()); return () => cleanups.forEach((cleanup) => cleanup?.()) },
  }
}

export const navigation = (state) => Object.fromEntries(['showCalls', 'showUpdates', 'showSpaces', 'showRequests', 'activeChatId', 'updatesTarget'].map((name) => [name, state[name]]))
export const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
