import test from 'node:test'
import assert from 'node:assert/strict'
import * as runtime from 'react/jsx-runtime'
import { load } from './helpers/foundation-harness.mjs'
import { nodes } from './helpers/ui-harness.mjs'

const base = 'client/src/features/workspace/components/'
const shared = '../../../shared/'
function surface(name, props, DateValue = Date) {
  const mocks = {
    'react/jsx-runtime': runtime,
    'lucide-react': new Proxy({}, { get: (_, name) => (props) => runtime.jsx(`icon:${String(name)}`, props) }),
    [`${shared}components/Avatar`]: { Avatar: (props) => runtime.jsx('Avatar', props) },
  }
  mocks['./ChatRow'] = load(`${base}ChatRow.tsx`, mocks, { Date: DateValue })
  const expand = node => !node || typeof node !== 'object' ? node : Array.isArray(node) ? node.map(expand)
    : typeof node.type === 'function' ? expand(node.type(node.props))
      : { type: node.type, key: node.key, props: { ...node.props, children: expand(node.props.children) } }
  return expand(load(`${base}${name}.tsx`, mocks, { Date: DateValue })[name](props))
}
const text = node => node == null || typeof node === 'boolean' ? '' : typeof node !== 'object' ? String(node)
  : Array.isArray(node) ? node.map(text).join('') : text(node.props?.children)
const find = (tree, cls) => nodes(tree, n => n.props?.className === cls)
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-10-07T12:00:00+05:00'])) }
}
const call = (id, created_at, overrides = {}) => ({ id, created_at, chat_id: `chat-${id}`, caller_id: 'me', callee_id: 'peer', call_type: 'audio', status: 'ended', other_name: id, ...overrides })
const props = overrides => ({ showCalls: true, callHistory: [], userId: 'me', filter: 'all', showRequests: false, requests: [], error: '', chats: [], drafts: {}, activeChatId: null, online: true,
  onSelectChat() {}, onSelectCall() {}, onCallAgain() {}, onNewCall() {}, onSelectRequest() {}, onSelectFilter() {}, onShowRequests() {}, onNewConversation() {}, onOpenSearch() {}, ...overrides })

test('Workspace history retains local day boundaries, section order, input row order, keys and parent DOM', () => {
  const today = new FixedDate(); today.setHours(0, 0, 0, 0)
  const atDay = (offset, hours = 0) => { const date = new FixedDate(today); date.setDate(date.getDate() + offset); date.setHours(hours); return date.toISOString() }
  const calls = [call('today-a', atDay(0)), call('old', atDay(-20)), call('today-b', atDay(0, 10)), call('yesterday', atDay(-1, 23)), call('week', atDay(-2, 12)), call('tomorrow', atDay(1))]
  const tree = surface('InboxPane', props({ callHistory: calls }), FixedDate)
  assert.equal(tree.type, 'aside'); assert.equal(tree.props.className, 'inbox-pane')
  const list = find(tree, 'call-history-list')[0]
  const chatList = find(tree, 'chat-list')[0]
  assert.ok(nodes(chatList, n => n === list).length)
  const days = find(list, 'call-history-day')
  assert.deepEqual(days.map(n => n.key), ['Today', 'Yesterday', 'This week', 'Earlier'])
  assert.deepEqual(days.map(n => text(find(n, 'list-section-label')[0])), ['Today', 'Yesterday', 'This week', 'Earlier'])
  assert.deepEqual(nodes(list, n => n.type === 'article').map(n => n.key), ['today-a', 'today-b', 'yesterday', 'week', 'old'])
  assert.equal(nodes(list, n => n.key === 'tomorrow').length, 0)
})

test('Workspace history preserves call labels, duration/time formatting, avatar policy and exact callback payloads', () => {
  const selected = [], redialed = []
  const rows = [
    call('direct', '2026-10-07T01:00:00Z', { other_avatar_url: '/avatar', accepted_at: '2026-10-07T01:00:00Z', ended_at: '2026-10-07T02:02:03Z' }),
    call('group', '2026-10-07T02:00:00Z', { is_group: true, caller_id: 'other', group_title: 'Team', call_type: 'video', accepted_at: '2026-10-07T02:00:00Z', ended_at: '2026-10-07T02:01:05Z' }),
    call('missed', '2026-10-07T03:00:00Z', { status: 'missed', callee_id: 'me', caller_id: 'other' }),
    call('active', '2026-10-07T04:00:00Z', { status: 'active' }),
    call('ringing', '2026-10-07T05:00:00Z', { status: 'ringing' }),
  ]
  const tree = surface('InboxPane', props({ callHistory: rows, onSelectCall: id => selected.push(id), onCallAgain: (...args) => redialed.push(args) }), FixedDate)
  assert.ok(text(tree).includes('Outgoing · Completed · 1 hr 2 min'))
  assert.ok(text(tree).includes('Joined group call · Completed · 1 min 5 sec'))
  assert.ok(text(tree).includes('Incoming · Missed call'))
  const avatars = nodes(tree, n => n.type === 'Avatar')
  assert.equal(avatars[0].props.src, '/avatar'); assert.equal(avatars[1].props.src, undefined)
  const open = find(tree, 'call-history-open'), again = find(tree, 'call-history-again')
  assert.equal(open[1].props['aria-label'], 'Open chat with Team')
  assert.equal(again[1].props['aria-label'], 'Call Team again by video')
  assert.deepEqual(again.map(n => n.props.disabled), [false, false, false, true, true])
  open[1].props.onClick(); again[1].props.onClick()
  assert.deepEqual(selected, ['chat-group']); assert.equal(redialed[0][0], rows[1]); assert.equal(redialed[0][1], 'video')
  const times = nodes(tree, n => n.type === 'time')
  assert.equal(times[0].props.dateTime, rows[0].created_at)
  assert.equal(text(times[0]), new FixedDate(rows[0].created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
})

test('Workspace empty Calls and Requests branches retain copy, conditional regions and actions', () => {
  let starts = 0
  const tree = surface('InboxPane', props({ onNewCall: () => starts++ }), FixedDate)
  assert.equal(find(tree, 'call-history-list').length, 0)
  assert.equal(find(tree, 'inbox-filters').length, 0)
  assert.equal(find(tree, 'inbox-footnote').length, 0)
  assert.equal(text(find(tree, 'empty-title')[0]), 'No calls yet')
  nodes(find(tree, 'list-empty')[0], n => n.type === 'button')[0].props.onClick(); assert.equal(starts, 1)
  const requests = surface('InboxPane', props({ showCalls: false, showRequests: true }))
  assert.equal(text(find(requests, 'request-list-inline')[0]), 'No message requests')
  assert.equal(find(requests, 'call-history-list').length, 0)
})

test('Workspace actual ChatRow preserves selected/draft DOM and forwards the chat ID', () => {
  const selected = [], chat = { id: 'chat', kind: 'group', display_title: 'Team', unread_count: 2 }
  const row = surface('ChatRow', { chat, draft: 'x'.repeat(61), selected: true, onSelect: id => selected.push(id) })
  assert.equal(row.type, 'button'); assert.equal(row.props.type, 'button')
  assert.equal(row.props.className, 'chat-list-item selected has-draft')
  assert.ok(text(row).includes(`Draft: ${'x'.repeat(60)}…`))
  assert.equal(nodes(row, n => n.type === 'Avatar')[0].props.className, 'group-avatar')
  row.props.onClick(); assert.deepEqual(selected, ['chat'])
})

test('Workspace actual MobileNavigation preserves button order, callbacks, badge cap and account aria precedence', () => {
  const calls = [], callbacks = Object.fromEntries(['Chats', 'Calls', 'Updates', 'Spaces'].map(name => [`onShow${name}`, () => calls.push(name)]))
  const tree = surface('MobileNavigation', { section: 'calls', accountOpen: true, unreadConversationCount: 100, ...callbacks, onOpenAccount: () => calls.push('You') })
  const buttons = nodes(tree, n => n.type === 'button')
  assert.deepEqual(buttons.map(text), ['99+Chats', 'Calls', 'Updates', 'Spaces', 'You'])
  assert.deepEqual(buttons.map(n => n.props['aria-current']), [undefined, undefined, undefined, undefined, 'page'])
  assert.equal(buttons[0].props['aria-label'], 'Chats, 100 unread conversations')
  buttons.forEach(n => n.props.onClick()); assert.deepEqual(calls, ['Chats', 'Calls', 'Updates', 'Spaces', 'You'])
})
