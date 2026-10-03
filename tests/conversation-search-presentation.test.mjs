import test from 'node:test'
import assert from 'node:assert/strict'
import { conversation, chat, message } from './helpers/conversation-harness.mjs'
import { plain } from './helpers/foundation-harness.mjs'

const subject = seed => conversation({ seed: { chat, loading: false, messages: [message], messageSearchOpen: true, ...seed } })
const children = node => [node.props.children].flat().filter(n => n && typeof n === 'object')
test('Conversation search retains exact root, child order, input contract and surrounding siblings without keyboard handlers or wrappers', () => {
  const view = subject({ messageSearch: '  Original  ' })
  const bar = view.all(n => n.props.className === 'conversation-search-bar')[0]
  assert.equal(bar.type, 'div')
  assert.deepEqual(plain(children(bar).map(n => n.type)), ['icon:Search', 'input', 'span', 'button'])
  const [icon, input, label, close] = children(bar)
  assert.equal(icon.props.size, 14)
  assert.equal(icon.props['aria-hidden'], 'true')
  assert.equal(input.props.autoFocus, true)
  assert.equal(input.props.value, '  Original  ')
  assert.equal(input.props.placeholder, 'Search loaded messages on this device')
  assert.equal(input.props['aria-label'], 'Search messages in this conversation')
  assert.equal(input.props.onKeyDown, undefined)
  assert.equal(input.props.ref, undefined)
  assert.equal(input.key, undefined)
  assert.equal(label.props.children, '1 matches')
  assert.equal(close.props.type, 'button')
  assert.equal(close.props['aria-label'], 'Close message search')
  assert.equal(children(close)[0].type, 'icon:X')
  const pane = view.all(n => n.type === 'section' && n.props['aria-label'] === 'Peer')[0]
  assert.deepEqual(plain(children(pane).map(n => n.type)), ['ConversationHeader', 'div', 'MessageList', 'MessageComposer'])
})
test('Conversation search exact query and zero/blank labels preserve parent filtering, close/reset and conditional unmount', () => {
  const view = subject({ messageSearch: '   ' })
  assert.equal(view.all(n => n.props.className === 'conversation-search-bar')[0].props.children[2].props.children, 'On-device only')
  const input = view.all(n => n.type === 'input')[0]
  input.props.onChange({ target: { value: '  unmatched  ' } })
  view.render()
  assert.equal(view.state.messageSearch, '  unmatched  ')
  assert.equal(view.all(n => n.type === 'span' && n.props.children === '0 matches').length, 1)
  assert.equal(view.find('MessageList').props.messages.length, 0)
  view.all(n => n.props['aria-label'] === 'Close message search')[0].props.onClick()
  view.render()
  assert.equal(view.state.messageSearch, '')
  assert.equal(view.state.messageSearchOpen, false)
  assert.equal(view.all(n => n.props.className === 'conversation-search-bar').length, 0)
  assert.equal(view.requests.length, 0)
})
