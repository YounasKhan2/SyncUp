import test from 'node:test'
import assert from 'node:assert/strict'
import { workspace, navigation, settle } from './helpers/workspace-harness.mjs'
import { plain } from './helpers/foundation-harness.mjs'

const target = { spaceId: 'old-space', channelId: 'old-channel', messageId: 'old-message' }
const seed = { showCalls: true, showUpdates: true, showSpaces: true, showRequests: true, activeChatId: 'old-chat', updatesTarget: target }
const expected = (overrides = {}) => ({ showCalls: false, showUpdates: false, showSpaces: false, showRequests: false, activeChatId: 'old-chat', updatesTarget: target, ...overrides })
const check = (subject, value) => assert.deepEqual(plain(navigation(subject.state)), value)

test('Workspace Chats home clears section flags, retains target and desktop chat, clears mobile chat', () => {
  for (const surface of ['WorkspaceRail', 'MobileNavigation']) for (const narrow of [false, true]) {
    const subject = workspace({ seed, narrow })
    subject.find(surface).props.onShowChats()
    check(subject, expected({ activeChatId: narrow ? null : 'old-chat' }))
  }
})

test('Workspace selecting a chat or call-history conversation clears all section flags and retains target', () => {
  for (const callback of ['onSelectChat', 'onSelectCall']) {
    const subject = workspace({ seed })
    subject.find('InboxPane').props[callback]('selected')
    check(subject, expected({ activeChatId: 'selected' }))
  }
})

test('Workspace Calls entry preserves desktop chat, clears mobile chat, and refreshes both histories', async () => {
  for (const surface of ['WorkspaceRail', 'MobileNavigation']) for (const narrow of [false, true]) {
    const subject = workspace({ seed, narrow })
    subject.find(surface).props.onShowCalls()
    check(subject, expected({ showCalls: true, activeChatId: narrow ? null : 'old-chat' }))
    await settle()
    assert.deepEqual(subject.requests.map(([path]) => path), ['/api/calls', '/api/group-calls'])
  }
})

test('Workspace Calls history failure retains navigation and original error copy', async () => {
  const subject = workspace({ seed, api: async () => { throw new Error('history unavailable') } })
  subject.find('WorkspaceRail').props.onShowCalls()
  await settle()
  check(subject, expected({ showCalls: true }))
  assert.equal(subject.state.error, 'history unavailable')
})

test('Workspace Updates entry clears active chat and target on rail and mobile', () => {
  for (const surface of ['WorkspaceRail', 'MobileNavigation']) {
    const subject = workspace({ seed })
    subject.find(surface).props.onShowUpdates()
    check(subject, expected({ showUpdates: true, activeChatId: null, updatesTarget: null }))
  }
})

test('Workspace Spaces entry clears other flags, active chat and target on rail and mobile', () => {
  for (const surface of ['WorkspaceRail', 'MobileNavigation']) {
    const subject = workspace({ seed })
    subject.find(surface).props.onShowSpaces()
    check(subject, expected({ showSpaces: true, activeChatId: null, updatesTarget: null }))
  }
})

test('Workspace opening an update target selects Spaces and preserves all three target IDs', () => {
  const subject = workspace({ seed })
  subject.find('UpdatesPage').props.onOpenTarget('space', 'channel', 'message')
  check(subject, expected({ showSpaces: true, activeChatId: null, updatesTarget: { spaceId: 'space', channelId: 'channel', messageId: 'message' } }))
})

test('Workspace update call opens a Space target or selects a direct chat', () => {
  for (const space of [true, false]) {
    const subject = workspace({ seed })
    subject.find('UpdatesPage').props.onOpenCall({ chat_id: 'channel', ...(space ? { space_id: 'space' } : {}) })
    check(subject, space ? expected({ showSpaces: true, activeChatId: null, updatesTarget: { spaceId: 'space', channelId: 'channel', messageId: '' } }) : expected({ activeChatId: 'channel' }))
  }
})

test('Workspace group conversion selects Space with empty message ID before inbox refresh', async () => {
  const subject = workspace({ seed: { ...seed, showCalls: false }, api: async (path) => {
    check(subject, expected({ showSpaces: true, activeChatId: null, updatesTarget: { spaceId: 'space', channelId: 'channel', messageId: '' } }))
    return path === '/api/inbox' ? { chats: [] } : { requests: [] }
  } })
  subject.find('Conversation').props.onGroupConverted('space', 'channel')
  check(subject, expected({ showSpaces: true, activeChatId: null, updatesTarget: { spaceId: 'space', channelId: 'channel', messageId: '' } }))
  await settle()
  assert.deepEqual(subject.requests.map(([path]) => path), ['/api/inbox', '/api/requests'])
})

test('Workspace search selection preserves Updates/Spaces and target while clearing Calls/Requests/search', () => {
  const subject = workspace({ seed: { ...seed, searchOpen: true } })
  subject.find('SearchDialog').props.onSelectChat('found-chat')
  check(subject, { ...seed, showCalls: false, showRequests: false, activeChatId: 'found-chat' })
  assert.equal(subject.state.searchOpen, false)
})

test('Workspace Requests entry changes only request/filter state; close and filter actions preserve other navigation', () => {
  const subject = workspace({ seed: { ...seed, showRequests: false, filter: 'unread' } })
  subject.find('InboxPane').props.onShowRequests()
  check(subject, seed)
  assert.equal(subject.state.filter, 'all')
  subject.render()
  subject.find('RequestsPanel').props.onClose()
  check(subject, { ...seed, showRequests: false })
  subject.find('InboxPane').props.onShowRequests()
  subject.find('InboxPane').props.onSelectFilter('unread')
  check(subject, { ...seed, showRequests: false })
  assert.equal(subject.state.filter, 'unread')
  subject.find('InboxPane').props.onShowRequests()
  subject.find('InboxPane').props.onSelectRequest()
  check(subject, { ...seed, showRequests: false })
})

test('Workspace custom close/refresh events use window, clear only chat or refresh inbox, and remove identical callbacks', async () => {
  const subject = workspace({ seed })
  const cleanup = subject.mountEffects()
  const close = subject.listeners.get('syncup-close-chat')
  const refresh = subject.listeners.get('syncup-refresh-chat')
  subject.requests.length = 0
  subject.window.dispatchEvent(new Event('syncup-close-chat'))
  check(subject, { ...seed, activeChatId: null })
  subject.window.dispatchEvent(new Event('syncup-refresh-chat'))
  await settle()
  assert.deepEqual(subject.requests.map(([path]) => path), ['/api/inbox', '/api/requests'])
  cleanup()
  assert.ok(subject.removed.some(([name, callback]) => name === 'syncup-close-chat' && callback === close))
  assert.ok(subject.removed.some(([name, callback]) => name === 'syncup-refresh-chat' && callback === refresh))
  assert.equal(subject.listeners.size, 0)
  assert.equal(subject.timers.size, 0)
})

test('Workspace resize clears chat only for Calls at the existing mobile breakpoint, with listener cleanup', () => {
  for (const showCalls of [false, true]) for (const narrow of [false, true]) {
    const subject = workspace({ seed: { ...seed, showCalls }, narrow })
    const cleanup = subject.mountEffects()
    assert.equal(subject.state.activeChatId, 'old-chat') // no initial resize invocation
    const resize = subject.listeners.get('resize')
    resize()
    assert.equal(subject.state.activeChatId, showCalls && narrow ? null : 'old-chat')
    cleanup()
    assert.ok(subject.removed.some(([name, callback]) => name === 'resize' && callback === resize))
  }
})

test('Workspace Ctrl/Cmd K is case insensitive, prevents default even in inputs, ignores other keys and cleans up', () => {
  const subject = workspace()
  const cleanup = subject.mountEffects()
  const keydown = subject.listeners.get('keydown')
  for (const [key, ctrlKey, metaKey, opens] of [['k', true, false, true], ['K', false, true, true], ['k', false, false, false], ['Escape', true, true, false]]) {
    subject.state.searchOpen = false
    let prevented = 0
    keydown({ key, ctrlKey, metaKey, target: { tagName: 'INPUT' }, preventDefault() { prevented++ } })
    assert.equal(subject.state.searchOpen, opens)
    assert.equal(prevented, Number(opens))
  }
  cleanup()
  assert.ok(subject.removed.some(([name, callback]) => name === 'keydown' && callback === keydown))
})

test('Workspace timer registrations retain immediate poll, 3000 ms, 15000 ms and deferred 0 ms load with cleanup', async () => {
  const subject = workspace()
  const cleanup = subject.mountEffects()
  assert.deepEqual([...subject.timers.values()].map(({ delay, interval }) => [delay, interval]), [[3000, true], [0, false], [15000, true]])
  assert.deepEqual(subject.requests.map(([path]) => path), ['/api/calls/incoming', '/api/group-calls/incoming'])
  const initialLoad = [...subject.timers.values()].find(({ delay }) => delay === 0)
  initialLoad.callback()
  await settle()
  assert.ok(subject.requests.some(([path]) => path === '/api/inbox'))
  cleanup()
  assert.equal(subject.cleared.length, 3)
  const active = workspace({ seed: { activeCall: { id: 'active' } } })
  const end = active.mountEffects()
  assert.equal([...active.timers.values()].some(({ delay }) => delay === 3000), false)
  assert.equal(active.requests.length, 0)
  end()
})

test('Workspace Calls home retains markup and forwards audio/video intent through existing call policy', () => {
  for (const type of ['audio', 'video']) {
    const subject = workspace({ seed: { showCalls: true } })
    const button = subject.all((node) => node.type === 'button' && node.props.className === `calls-home-button${type === 'video' ? ' is-video' : ''}`)[0]
    assert.equal(button.props.type, 'button')
    button.props.onClick()
    assert.equal(subject.state.newCallRequestedType, type)
    assert.equal(subject.state.newCallRequested, true)
    assert.equal(subject.state.newConversation, true)
    assert.equal(subject.requests.length, 0)
  }
  const subject = workspace({ seed: { showCalls: true, activeCall: { id: 'busy' } } })
  subject.all((node) => node.props.className === 'calls-home-button')[0].props.onClick()
  assert.equal(subject.state.newConversation, false)
  assert.equal(subject.state.error, 'Finish your current call before starting another one.')
})

test('Workspace incoming banner preserves direct/group labels, avatar policy, Answer/Decline forwarding and active-call hiding', async () => {
  for (const group of [false, true]) {
    const incomingCall = { id: 'incoming', chat_id: 'chat', call_type: 'video', caller_name: 'Caller', caller_avatar_url: '/avatar', ...(group ? { is_group: true, group_title: 'Group' } : {}) }
    const subject = workspace({ seed: { incomingCall } })
    const banner = subject.all((node) => node.props.className === 'incoming-call-banner')[0]
    assert.equal(banner.props.role, 'alertdialog')
    assert.equal(banner.props['aria-modal'], 'true')
    assert.equal(banner.props['aria-labelledby'], 'incoming-call-title')
    assert.equal(subject.all((node) => node.props.id === 'incoming-call-title')[0].props.children, group ? 'Group' : 'Caller')
    assert.ok(subject.all((node) => node.type === 'small' && node.props.children === (group ? 'Caller is calling' : 'Incoming video call')).length)
    assert.equal(subject.find('Avatar').props.src, group ? undefined : '/avatar')
    subject.all((node) => node.props.className === 'decline-call-button')[0].props.onClick()
    await settle()
    assert.deepEqual(subject.requests.map(([path]) => path), [`/api/${group ? 'group-calls' : 'calls'}/incoming/decline`, '/api/calls', '/api/group-calls'])
    assert.equal(subject.state.incomingCall, null)
  }
  const incomingCall = { id: 'incoming', chat_id: 'chat', call_type: 'audio', caller_name: 'Caller' }
  const answer = workspace({ seed: { ...seed, incomingCall } })
  answer.all((node) => node.props.className === 'answer-call-button')[0].props.onClick()
  await settle()
  assert.equal(answer.requests[0][0], '/api/calls/incoming/accept')
  assert.equal(answer.state.activeCall.id, 'incoming')
  assert.equal(answer.state.activeChatId, 'chat')
  assert.equal(answer.state.showCalls, false)
  assert.equal(answer.state.showSpaces, true) // retain acceptance asymmetry
  assert.equal(answer.state.incomingCall, null)
  const active = workspace({ seed: { incomingCall, activeCall: { id: 'active' } } })
  assert.equal(active.all((node) => node.props.className === 'incoming-call-banner').length, 0)
})
