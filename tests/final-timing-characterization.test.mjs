import test from 'node:test'
import assert from 'node:assert/strict'
import { functionBody } from './helpers/foundation-harness.mjs'

test('Final typing throttle preserves strict 2500 ms boundary, active stop, offline and empty-chat guards', async () => {
  const requests = [], lastTypingSent = { current: 7501 }, typingActive = { current: false }
  const globals = { chatId: 'chat', online: true, Date: { now: () => 10000 }, lastTypingSent, typingActive,
    api: async (path, options) => requests.push([path, options]), setError() {} }
  const send = functionBody('client/src/features/messaging/Conversation.tsx', 'sendTyping', globals)
  await send(true); assert.equal(requests.length, 0)
  lastTypingSent.current = 7500
  await send(true); assert.equal(requests.length, 1); assert.equal(lastTypingSent.current, 10000)
  await send(true); assert.equal(requests.length, 1)
  await send(false); await send(false)
  assert.deepEqual(requests.map(([path, options]) => [path, options.method, JSON.parse(options.body)]), [
    ['/api/chats/chat/typing', 'POST', { active: true }], ['/api/chats/chat/typing', 'POST', { active: false }],
  ])
  for (const overrides of [{ online: false }, { chatId: null }]) {
    const blocked = functionBody('client/src/features/messaging/Conversation.tsx', 'sendTyping', { ...globals, ...overrides })
    await blocked(true); await blocked(false)
  }
  assert.equal(requests.length, 2)
})
