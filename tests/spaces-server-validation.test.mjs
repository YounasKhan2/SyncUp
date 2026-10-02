import test from 'node:test'
import assert from 'node:assert/strict'
import { plain } from './helpers/foundation-harness.mjs'
import { spacesServer, ids } from './helpers/spaces-server-harness.mjs'

const C = '/spaces/:spaceId/channels/:channelId'
const poll = { type: 'poll', question: ' Question ', options: [' One ', ' Two '] }
const event = { type: 'event', title: ' Meeting ', startsAt: '2026-01-02T12:00:00Z', timezone: ' UTC ' }
const check = { type: 'checklist', title: ' Work ', items: [{ text: ' Task ' }] }
const schema = () => spacesServer('objects').validation.createSchema
const error = (result, status, message) => {
  assert.equal(result.error, undefined)
  assert.equal(result.status, status)
  assert.deepEqual(result.body, { error: { code: status === 404 ? 'not_found' : 'validation', message } })
}

test('Spaces object create grammar retains trims, defaults, nullable values and unknown-key stripping', () => {
  const s = schema()
  assert.deepEqual(plain(s.parse({ ...poll, ignored: true })), { type: 'poll', question: 'Question', options: ['One', 'Two'], multiSelect: false, closesAt: null, anonymous: false })
  assert.deepEqual(plain(s.parse(event)), { ...event, title: 'Meeting', timezone: 'UTC', endsAt: null, locationText: '', rsvpRequired: true })
  assert.deepEqual(plain(s.parse(check)), { type: 'checklist', title: 'Work', items: [{ text: 'Task', assigneeId: null, dueAt: null }] })
  assert.equal(s.safeParse({ ...event, endsAt: null, locationText: ' Here ', rsvpRequired: false }).data.locationText, 'Here')
  assert.equal(s.safeParse({ ...poll, closesAt: null, multiSelect: true, anonymous: true }).success, true)
})

test('Spaces poll boundaries and discriminant/date/boolean types stay exact', () => {
  const s = schema()
  for (const input of [
    { ...poll, question: ' ' }, { ...poll, question: 'a'.repeat(241) },
    { ...poll, options: ['one'] }, { ...poll, options: Array(9).fill('one') },
    { ...poll, options: ['', 'two'] }, { ...poll, options: ['a'.repeat(101), 'two'] },
    { ...poll, closesAt: '2026-01-02' }, { ...poll, multiSelect: 'false' },
    { ...poll, anonymous: null }, { ...poll, type: 'decision' },
  ]) assert.equal(s.safeParse(input).success, false, JSON.stringify(input))
  assert.equal(s.safeParse({ ...poll, question: 'a'.repeat(240), options: Array(8).fill('a'.repeat(100)) }).success, true)
})

test('Spaces event grammar retains independent date syntax and text limits', () => {
  const s = schema()
  for (const input of [
    { ...event, title: '' }, { ...event, title: 'a'.repeat(161) },
    { ...event, startsAt: null }, { ...event, startsAt: 'tomorrow' }, { ...event, endsAt: 'today' },
    { ...event, timezone: ' ' }, { ...event, timezone: 'a'.repeat(81) },
    { ...event, locationText: 'a'.repeat(241) }, { ...event, locationText: null }, { ...event, rsvpRequired: null },
  ]) assert.equal(s.safeParse(input).success, false)
  // Timezone correctness and relative time ordering belong to the handler, not this grammar.
  assert.equal(s.safeParse({ ...event, timezone: 'invalid/timezone', endsAt: '2025-01-01T00:00:00Z', title: 'a'.repeat(160), locationText: 'a'.repeat(240) }).success, true)
})

test('Spaces checklist grammar retains item limits, UUID/date syntax and nullable defaults', () => {
  const s = schema()
  for (const input of [
    { ...check, title: 'a'.repeat(161) }, { ...check, items: [] }, { ...check, items: Array(31).fill({ text: 'ok' }) },
    { ...check, items: [{ text: ' ' }] }, { ...check, items: [{ text: 'a'.repeat(241) }] },
    { ...check, items: [{ text: 'ok', assigneeId: 'bad' }] }, { ...check, items: [{ text: 'ok', dueAt: 'tomorrow' }] },
  ]) assert.equal(s.safeParse(input).success, false)
  assert.equal(s.safeParse({ ...check, title: 'a'.repeat(160), items: Array(30).fill({ text: 'a'.repeat(240), assigneeId: ids.user, dueAt: null }) }).success, true)
})

test('Spaces filename grammar retains trim, bounds and path/control-character refinement', () => {
  const { fileNameSchema: s, fileMaxBytes, imageMaxBytes, allowedTypes } = spacesServer('discovery').validation
  assert.equal(s.parse(' report résumé.pdf '), 'report résumé.pdf')
  assert.equal(s.safeParse('a'.repeat(200)).success, true)
  for (const name of ['', ' ', '.', '..', '../a', 'a/b', 'a\\b', 'a\0b', 'a\nb', 'a\u007fb', 'a'.repeat(201)]) assert.equal(s.safeParse(name).success, false)
  assert.equal(fileMaxBytes, 25 * 1024 * 1024)
  assert.equal(imageMaxBytes, 10 * 1024 * 1024)
  assert.deepEqual([...allowedTypes], ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip', 'text/plain', 'text/csv', 'image/gif', 'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'])
})

test('Spaces malformed IDs retain different HTTP validation contracts before any DB work', async () => {
  for (const [module, method, path, body, status, message] of [
    ['routes', 'get', '/spaces/:id', {}, 404, 'Space not found.'],
    ['routes', 'get', `${C}/messages`, {}, 400, 'Invalid channel history cursor.'],
    ['objects', 'get', `${C}/objects`, {}, 404, 'Channel not found.'],
    ['objects', 'post', `${C}/objects`, poll, 400, 'Check the shared item details and try again.'],
    ['discovery', 'get', `${C}/files`, {}, 400, 'Choose a valid Space channel.'],
  ]) {
    const h = spacesServer(module)
    error(await h.invoke(method, path, { params: {}, body }), status, message)
    assert.equal(h.trace.some(x => ['pool', 'connect'].includes(x[0])), false)
  }
})

test('Spaces channel name normalization and type enum stay separate from ownership validation', async () => {
  for (const body of [{ name: 'invalid name' }, { name: '-bad' }, { name: 'x'.repeat(41) }, { name: 'valid', type: 'text' }]) {
    const h = spacesServer('routes')
    error(await h.invoke('post', '/spaces/:id/channels', { body }), 400, 'Choose a valid channel name and type.')
    assert.equal(h.trace.some(x => x[0] === 'connect'), false)
  }
  const h = spacesServer('routes')
  const result = await h.invoke('post', '/spaces/:id/channels', { body: { name: ' GENERAL-Room ', type: 'announcement' } })
  assert.equal(result.status, 404)
  assert.ok(h.trace.some(x => x[0] === 'client' && x[1] === 'ROLLBACK'))
})

test('Spaces permission validation requires exactly three distinct roles and no send/speak on hidden rows', async () => {
  const valid = ['moderator', 'member', 'guest'].map(role => ({ role, can_view: true, can_send: true, can_speak: true }))
  for (const permissions of [valid.slice(1), [...valid, valid[0]], [valid[0], valid[0], valid[2]], valid.map(row => ({ ...row, can_speak: undefined })), valid.map(row => ({ ...row, can_view: false })), valid.map(row => ({ ...row, role: 'owner' }))]) {
    const h = spacesServer('routes')
    error(await h.invoke('patch', `${C}/permissions`, { body: { permissions } }), 400, 'Set view and send permissions for moderator, member, and guest roles.')
    assert.equal(h.trace.some(x => x[0] === 'connect'), false)
  }
  const h = spacesServer('routes')
  assert.equal((await h.invoke('patch', `${C}/permissions`, { body: { permissions: valid.map(row => ({ ...row, can_view: false, can_send: false, can_speak: false })) } })).status, 404)
})

test('Spaces file metadata rejects unsupported MIME, noninteger/empty/oversize and image cap before SQL', async () => {
  const file = { filename: 'ok.pdf', contentType: 'application/pdf', sizeBytes: 2 }
  for (const body of [{ ...file, filename: '../bad' }, { ...file, contentType: 'application/octet-stream' }, { ...file, sizeBytes: 0 }, { ...file, sizeBytes: 1.5 }, { ...file, sizeBytes: 25 * 1024 * 1024 + 1 }]) {
    const h = spacesServer('discovery')
    error(await h.invoke('post', `${C}/files`, { body }), 400, 'Choose a supported file up to 25 MB.')
    assert.equal(h.trace.some(x => x[0] === 'pool'), false)
  }
  const h = spacesServer('discovery')
  error(await h.invoke('post', `${C}/files`, { body: { ...file, contentType: ' IMAGE/PNG ', sizeBytes: 10 * 1024 * 1024 + 1 } }), 400, 'Images must be 10 MB or smaller.')
})

test('Spaces object runtime duplicate/time/timezone checks stay outside the pure input grammar', async () => {
  for (const [body, message] of [
    [{ ...poll, options: [' Same ', 'same'] }, 'Poll options must be unique.'],
    [{ ...poll, closesAt: '2026-01-01T12:00:00Z' }, 'Choose a future poll closing time.'],
    [{ ...event, endsAt: event.startsAt }, 'The end time must be after the start time.'],
    [{ ...event, timezone: 'invalid/timezone' }, 'Choose a valid timezone.'],
  ]) {
    const h = spacesServer('objects', { query: async () => ({ rows: [{ role: 'member', can_send: true, chat_id: ids.channel }] }) })
    error(await h.invoke('post', `${C}/objects`, { body }), 400, message)
    assert.equal(h.trace.some(x => x[0] === 'connect'), false)
  }
})
