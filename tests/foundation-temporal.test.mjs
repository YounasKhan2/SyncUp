import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { load, plain, warning, routeBody } from './helpers/foundation-harness.mjs'

const id = '11111111-1111-4111-8111-111111111111'
const now = Date.parse('2026-01-01T12:00:00Z')
const iso = (offset) => new Date(now + offset).toISOString()
function routes(rows, time = now) {
  const handlers = new Map(), queries = []
  const router = Object.fromEntries(['get', 'post', 'patch'].map((method) => [method, (path, handler) => handlers.set(`${method} ${path}`, handler)]))
  class Clock extends Date { static now() { return time } }
  load('server/features/spaces/objects.ts', {
    express: { Router: () => router }, uuid: { v7: () => id }, zod: { z },
    '../../db.js': { pool: { query: async (sql) => {
      queries.push(sql)
      assert.match(sql.trim(), /^SELECT/)
      if (sql.includes('FROM channel_shared_objects o')) return { rows: structuredClone(rows) }
      if (sql.includes('SELECT sc.chat_id')) return { rows: [{ chat_id: id, role: 'member', can_view: true, can_send: true }] }
      return { rows: [] }
    } } }, '../realtime/routes.js': { publishChatEvent: () => assert.fail('read published') },
  }, { Date: Clock })
  return async (path) => {
    let body
    await handlers.get(`get ${path}`)({ auth: { userId: id }, params: { spaceId: id, channelId: id }, query: {} },
      { json: (value) => { body = plain(value) }, status: () => assert.fail('status') }, (e) => { throw e })
    return body
  }
}
const item = (key, type, state, payload) => ({ id: key, object_type: type, state, payload,
  title: key, channel_name: 'general', space_name: 'Space', my_response: null })

// These discrepancies characterize current behavior, not desirable semantics.
test(`${warning}: Updates projects time while channel reads preserve stored states`, async () => {
  const rows = [item('poll', 'poll', 'open', { closesAt: iso(0) }),
    item('event', 'event', 'scheduled', { startsAt: iso(-1000), endsAt: iso(1000) }),
    item('ended', 'event', 'scheduled', { startsAt: iso(-7200000) }),
    item('cancelled', 'event', 'cancelled', { startsAt: iso(-1000), endsAt: iso(1000) }),
    item('check', 'checklist', 'active', { items: [{ assigneeId: id, done: false, dueAt: iso(-1000) }] }),
    item('decision', 'decision', 'active', {}), item('unpinned', 'decision', 'unpinned', {})]
  const read = routes(rows)
  assert.deepEqual((await read('/spaces/:spaceId/channels/:channelId/objects')).objects, rows)
  const stacks = (await read('/spaces/updates')).stacks
  assert.deepEqual(stacks.decided.map((x) => [x.id, x.state]), [['poll', 'closed'], ['decision', 'active']])
  assert.deepEqual(stacks.happening.map((x) => [x.id, x.state]), [['event', 'active']])
  assert.deepEqual(stacks.needsYou.map((x) => [x.id, x.state]), [['check', 'active']])
  assert.deepEqual((await read('/spaces/:spaceId/channels/:channelId/objects')).objects, rows)
})

test('Given poll expiry and default one-hour event, then boundary equality closes/ends projection', async () => {
  const rows = [item('poll', 'poll', 'open', { closesAt: iso(0) }),
    item('event', 'event', 'scheduled', { startsAt: iso(-3600000) })]
  const before = (await routes(rows, now - 1)('/spaces/updates')).stacks
  assert.equal(before.needsYou[0].state, 'open')
  assert.equal(before.happening[0].state, 'active')
  const at = (await routes(rows)('/spaces/updates')).stacks
  assert.equal(at.decided[0].state, 'closed')
  assert.equal(at.happening.length, 0)
})

test('Given future RSVP events, then only unanswered required events within 48 hours need action', async () => {
  const rows = [item('boundary', 'event', 'scheduled', { startsAt: iso(48 * 3600000), rsvpRequired: true }),
    item('later', 'event', 'scheduled', { startsAt: iso(48 * 3600000 + 1), rsvpRequired: true }),
    { ...item('answered', 'event', 'scheduled', { startsAt: iso(1000), rsvpRequired: true }), my_response: { rsvp: 'yes' } },
    item('optional', 'event', 'scheduled', { startsAt: iso(1000), rsvpRequired: false })]
  assert.deepEqual((await routes(rows)('/spaces/updates')).stacks.needsYou.map((x) => x.id), ['boundary'])
})

test(`${warning}: expired open poll rejects response; elapsed scheduled event still accepts RSVP`, async () => {
  for (const type of ['poll', 'event']) {
    const statements = []
    const object = { message_id: id, object_type: type, state: type === 'poll' ? 'open' : 'scheduled',
      payload: { closesAt: iso(-1000), startsAt: iso(-7200000), endsAt: iso(-3600000), options: [{ id }] } }
    const client = { query: async (sql) => { statements.push(sql); return { rows: sql.includes('SELECT message_id') ? [object] : [] } }, release() {} }
    let status = 200, body, published = 0
    const handler = routeBody('server/features/spaces/objects.ts', 'post', '/spaces/:spaceId/channels/:channelId/objects/:objectId/respond', {
      uuid: z.uuid(), z, Date: class extends Date { static now() { return now } },
      authorizeChannel: async () => ({ channel: { role: 'member' } }), pool: { connect: async () => client },
      publishChatEvent: async () => { published++ },
    })
    const response = { status(code) { status = code; return this }, json(value) { body = value } }
    await handler({ auth: { userId: id }, params: { spaceId: id, channelId: id, objectId: id },
      body: type === 'poll' ? { type, optionIds: [id] } : { type, rsvp: 'yes' } }, response, (e) => { throw e })
    assert.equal(status, type === 'poll' ? 409 : 200)
    assert.equal(published, type === 'poll' ? 0 : 1)
    assert.ok(statements.includes(type === 'poll' ? 'ROLLBACK' : 'COMMIT'))
    assert.ok(body)
  }
})
