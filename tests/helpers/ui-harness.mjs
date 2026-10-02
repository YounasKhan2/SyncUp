import * as runtime from 'react/jsx-runtime'
import { load } from './foundation-harness.mjs'

// Production JSX and handlers with isolated hook slots/effects and explicit API boundary.
// This is not a DOM renderer: browser-native activation/focus is checked in the preview.
export function renderConsumer(path, name, props, { states = [], api = async () => ({}), effects = [] } = {}) {
  let slot = 0
  const react = {
    useState(initial) { const index = slot++; return [index in states ? states[index] : initial, () => {}] },
    useRef: (current) => ({ current }),
    useEffect: (effect) => effects.push(effect),
  }
  const icon = (props) => runtime.jsx('svg', props)
  const mocks = {
    react, 'react/jsx-runtime': runtime,
    'lucide-react': new Proxy({}, { get: () => icon }),
    '../../shared/api': { api, apiUpload: api },
    '../../shared/components/Avatar': { Avatar: () => null },
    './SafetySettings': { SafetySettings: () => null },
    '../../shared/components/BrandMark': { BrandMark: () => null },
    '../auth/crypto/crypto': {},
  }
  // Keep Phase 4 assertions at the transport boundary while executing the real
  // feature-owned API introduced in Phase 5 (no feature function stub).
  if (path.includes('/account/')) {
    mocks['./api'] = load('client/src/features/account/api.ts', { '../../shared/api': mocks['../../shared/api'] })
  }
  if (path.includes('/messaging/')) {
    mocks['./api'] = load('client/src/features/messaging/api.ts', { '../../shared/api': mocks['../../shared/api'] })
  }
  for (const primitive of ['Button', 'IconButton', 'Dialog']) {
    // Added after characterization; the same tests execute the migrated shell.
    try { mocks[`../../shared/components/${primitive}`] = load(`client/src/shared/components/${primitive}.tsx`, { 'react/jsx-runtime': runtime }) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  const tree = load(path, mocks)[name](props)
  return expand(tree)
}

function expand(node) {
  if (!node || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map(expand)
  if (typeof node.type === 'function') return expand(node.type(node.props))
  return { type: node.type, props: { ...node.props, children: expand(node.props.children) } }
}

export function nodes(tree, predicate) {
  const result = []
  function visit(node) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(visit)
    if (predicate(node)) result.push(node)
    visit(node.props?.children)
  }
  visit(tree)
  return result
}
