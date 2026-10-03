import ts from 'typescript'
import * as jsx from 'react/jsx-runtime'
import { load } from './foundation-harness.mjs'
import { nodes } from './ui-harness.mjs'
import { read } from './account-updates-parity.mjs'

export const accountPath = 'client/src/features/account/AccountPanel.tsx'
export const updatesPath = 'client/src/features/spaces/UpdatesPage.tsx'
export const user = { id: 'me', display_name: 'Sam Rivera', username: 'sam', email: 'sam@example.test', about: 'Project member', avatar_url: null, discoverable: true, read_receipts_enabled: true }
export const sessions = [{ id: 'current', device_name: 'This browser', last_active_at: '2026-10-03T08:00:00Z' }, { id: 'other /?é', device_name: 'Other browser', last_active_at: '2026-10-02T08:00:00Z' }]
export const object = { id: 'poll', space_id: 'space', space_name: 'Project', chat_id: 'channel', channel_name: 'general', message_id: 'message', object_type: 'poll', title: 'Choose a plan', state: 'active', payload: { options: [{ id: 'a', text: 'Plan A' }, { id: 'b', text: 'Plan B' }] }, response_counts: {}, created_by: 'me', created_at: '2026-10-03T08:00:00Z' }
export const tick = async () => { for (let i = 0; i < 40; i++) await Promise.resolve() }
export const plain = value => JSON.parse(JSON.stringify(value))
export function serialized(node) {
  if (Array.isArray(node)) return node.map(serialized)
  if (!node || typeof node !== 'object') return node
  return { type: typeof node.type === 'symbol' ? String(node.type) : node.type,
    props: Object.fromEntries(Object.entries(node.props).filter(([key, value]) => key !== 'children' && typeof value !== 'function')),
    children: serialized(node.props.children) }
}

// Real root bodies and real extracted presentation. Named hook slots and
// transport/Avatar/SafetySettings/SharedObjectCard doubles are explicit boundaries.
export function presentation(path, { seed = {}, source, props = {}, api } = {}) {
  const state = { ...seed }, trace = [], effects = [], refs = {}, requests = [], timers = []
  const globals = { URL: { revokeObjectURL(value) { trace.push(['revokeURL', value]) }, createObjectURL() { return 'blob:preview' } },
    window: { setInterval(...args) { timers.push(args) }, setTimeout(...args) { timers.push(args) } },
    __state(name, initial) { if (!(name in state)) state[name] = initial; return [state[name], value => { state[name] = typeof value === 'function' ? value(state[name]) : value; trace.push(['state', name, state[name]]) }] },
    __ref(name, initial) { return refs[name] ??= { current: initial } },
  }
  const transport = async (...args) => { requests.push(args); trace.push(['api', ...args]); return api ? api(...args) : { sessions, currentSessionId: 'current', stacks: { needsYou: [], happening: [], decided: [] }, activeCalls: [] } }
  const mocks = { react: { useEffect: (callback, dependencies) => effects.push({ callback, dependencies }) }, 'react/jsx-runtime': jsx,
    'lucide-react': new Proxy({}, { get: (_, name) => props => jsx.jsx(`icon:${String(name)}`, props) }),
    '../../shared/api': { api: transport, apiUpload: transport },
    '../../shared/components/Avatar': { Avatar: props => jsx.jsx('Avatar', props) }, './SafetySettings': { SafetySettings: () => jsx.jsx('SafetySettings', {}) },
    './SharedObjectCard': { SharedObjectCard: props => jsx.jsx('SharedObjectCard', props) }, '../SharedObjectCard': { SharedObjectCard: props => jsx.jsx('SharedObjectCard', props) },
  }
  mocks['./api'] = load('client/src/features/account/api.ts', { '../../shared/api': mocks['../../shared/api'] })
  for (const name of ['Button', 'IconButton', 'Dialog']) mocks[`../../shared/components/${name}`] = load(`client/src/shared/components/${name}.tsx`, { 'react/jsx-runtime': jsx })
  for (const [feature, name] of [['account', 'AccountSessionsSection'], ['spaces', 'UpdateItem']]) {
    try { mocks[`./components/${name}`] = load(`client/src/features/${feature}/components/${name}.tsx`, mocks) } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  const input = source ?? read(path), tree = ts.createSourceFile(path, input, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), edits = []
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isCallExpression(node.initializer)) {
      const hook = node.initializer.expression.getText(tree)
      if (hook === 'useState' || hook === 'useRef') {
        const name = hook === 'useState' ? node.name.elements[0].getText(tree) : node.name.getText(tree)
        edits.push([node.initializer.getStart(tree), node.initializer.end, `${hook === 'useState' ? '__state' : '__ref'}(${JSON.stringify(name)}, ${node.initializer.arguments[0].getText(tree)})`])
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  const transformed = edits.sort((a, b) => b[0] - a[0]).reduce((text, [start, end, replacement]) => text.slice(0, start) + replacement + text.slice(end), input)
  const name = path === accountPath ? 'AccountPanel' : 'UpdatesPage'
  const component = load(path, mocks, globals, transformed)[name]
  const inputs = path === accountPath ? { user, appearance: 'system', onAppearanceChange: preference => trace.push(['appearance', preference]), onClose: () => trace.push(['close']), onSaved: value => trace.push(['saved', value]), ...props } : { userId: 'me', onOpenTarget: (...target) => trace.push(['target', ...target]), onOpenCall: call => trace.push(['call', call]), ...props }
  let output
  const expand = node => !node || typeof node !== 'object' ? node : Array.isArray(node) ? node.map(expand) : typeof node.type === 'function' ? expand(node.type(node.props)) : { type: node.type, props: { ...node.props, children: expand(node.props.children) } }
  function render() { effects.length = 0; output = expand(component(inputs)); return output }
  render()
  const all = predicate => nodes(output, predicate)
  return { state, trace, effects, refs, requests, timers, render, all, find: predicate => all(predicate)[0], cls: className => all(n => n.props.className?.split(' ').includes(className))[0] }
}
