import test from 'node:test'
import assert from 'node:assert/strict'
import { plain, source } from './helpers/foundation-harness.mjs'
import { spacesServer, ids, roles, now } from './helpers/spaces-server-harness.mjs'

const C = '/spaces/:spaceId/channels/:channelId'
const respond = `${C}/objects/:objectId/respond`
const rows = (...items) => ({ rows: items, rowCount: items.length })
const access = role => ({ role, chat_id: ids.channel, can_view: true, can_send: true, channel_type: 'discussion' })
const sqlEntries = h => h.trace.filter(x => ['pool', 'client'].includes(x[0]))
const phases = h => h.trace.flatMap(x => x[0] === 'client' && ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(x[1]) ? [x[1]] : ['release', 'response', 'publish', 'next'].includes(x[0]) ? [x[0]] : [])
const fail = (result, status, code, message) => { assert.equal(result.error, undefined); assert.equal(result.status, status); assert.deepEqual(result.body, { error: { code, message } }) }

test('Spaces missing-row SQL policies remain distinct and retain active grants, voice exclusion and owner/admin bypass', () => {
  const object = source('server/features/spaces/objects.ts'), file = source('server/features/spaces/discovery.ts'), route = source('server/features/spaces/routes.ts')
  for (const text of [object, route]) assert.match(text, /COALESCE\(\s*permission\.can_send,\s*sc\.channel_type <> 'announcement' OR sm\.role = 'moderator'\s*\)/u)
  assert.match(file, /sm\.role IN \('owner', 'admin'\) OR COALESCE\(permission\.can_send, true\)/u)
  for (const text of [object, file, route]) {
    assert.match(text, /COALESCE\(permission\.can_view, true\)/u)
    assert.match(text, /grant_member\.left_at IS NULL/u)
    assert.match(text, /sc\.channel_type <> 'voice'/u)
    assert.match(text, /LEFT JOIN space_channel_role_permissions permission/u)
  }
  assert.match(route, /COALESCE\(permission\.can_speak, true\)/u)
  // Source predicates characterize SQL; these tests do not execute PostgreSQL.
})

test('Spaces object/file routes preserve hidden versus visible-but-forbidden HTTP outcomes', async () => {
  for (const [module, path, body, deniedMessage] of [
    ['objects', `${C}/objects`, { type: 'poll', question: 'Q', options: ['A', 'B'] }, 'You cannot post in this channel.'],
    ['discovery', `${C}/files`, { filename: 'ok.pdf', contentType: 'application/pdf', sizeBytes: 2 }, 'You cannot add files to this channel.'],
  ]) for (const visible of [false, true]) {
    const h = spacesServer(module, { query: async () => visible ? rows({ ...access('member'), can_send: false }) : rows() })
    fail(await h.invoke('post', path, { body }), visible ? 403 : 404, visible ? 'forbidden' : 'not_found', visible ? deniedMessage : 'Channel not found.')
    assert.equal(h.trace.some(x => ['connect', 'storage', 'publish'].includes(x[0])), false)
    assert.deepEqual(plain(sqlEntries(h)[0][2]), module === 'objects' ? [ids.space, ids.user, ids.channel] : [ids.space, ids.channel, ids.user])
  }
})

test('Spaces decision pinning permits owner/admin/moderator and denies member/guest without mutation', async () => {
  for (const role of ['owner', 'admin', 'moderator', 'member', 'guest']) {
    const h = spacesServer('objects', { query: async sql => sql.startsWith('SELECT sc.chat_id') ? rows(access(role)) : sql.startsWith('SELECT body') ? rows({ body: 'Source quote' }) : rows() })
    const result = await h.invoke('post', `${C}/messages/:messageId/decision`, { body: { title: ' Decision ' } })
    if (['member', 'guest'].includes(role)) {
      fail(result, 403, 'forbidden', 'Only Space moderators can pin a decision.')
      assert.equal(sqlEntries(h).length, 1)
    } else {
      assert.equal(result.status, 201)
      assert.deepEqual(result.body, { objectId: '66666666-6666-4666-8666-000000000001', messageId: ids.option })
      const insert = sqlEntries(h).find(x => x[1].startsWith('INSERT'))
      assert.deepEqual(plain(insert[2]), [result.body.objectId, ids.channel, ids.option, 'Decision', JSON.stringify({ quote: 'Source quote' }), ids.user])
      assert.deepEqual(plain(h.trace.find(x => x[0] === 'publish').slice(1)), [ids.channel, { type: 'channel.object', data: { id: result.body.objectId, messageId: ids.option } }])
    }
    assert.equal(h.trace.some(x => x[0] === 'connect'), false)
  }
})

test('Spaces permission update permits owner/admin, echoes exact rows, and rolls back every other role', async () => {
  for (const role of ['owner', 'admin', 'moderator', 'member', 'guest', null]) {
    const h = spacesServer('routes', { query: async sql => sql.startsWith('SELECT') ? role ? rows({ role }) : rows() : rows() })
    const result = await h.invoke('patch', `${C}/permissions`, { body: { permissions: roles } })
    if (['owner', 'admin'].includes(role)) {
      assert.deepEqual(result.body, { permissions: roles })
      assert.deepEqual(phases(h), ['BEGIN', 'COMMIT', 'response', 'release'])
      const upsert = sqlEntries(h).find(x => x[1].startsWith('INSERT INTO space_channel_role_permissions'))
      assert.match(upsert[1], /ON CONFLICT .* DO UPDATE/u)
      assert.deepEqual(plain(upsert[2]), [ids.space, ids.channel, JSON.stringify(roles), ids.user])
    } else {
      fail(result, role ? 403 : 404, role ? 'forbidden' : 'not_found', role ? 'Only Space owners and admins can manage channel permissions.' : 'Channel not found.')
      assert.deepEqual(phases(h), ['BEGIN', 'ROLLBACK', 'response', 'release'])
      assert.equal(sqlEntries(h).some(x => x[1].startsWith('INSERT')), false)
    }
  }
})

test('Spaces conversion denial rolls back before response and releases the transaction client', async () => {
  for (const found of [false, true]) {
    const h = spacesServer('routes', { query: async sql => sql.startsWith('SELECT') && found ? rows({ role: 'member' }) : rows() })
    fail(await h.invoke('post', '/chats/:id/upgrade-to-space', { body: { name: 'Space' } }), found ? 403 : 404, found ? 'forbidden' : 'not_found', found ? 'Only the group owner can convert this group into a Space.' : 'Group not found or already converted.')
    assert.deepEqual(phases(h), ['BEGIN', 'ROLLBACK', 'response', 'release'])
    assert.equal(sqlEntries(h).some(x => x[1].startsWith('INSERT')), false)
  }
})

test('Spaces channel creation denial preserves rollback and membership-first query ordering', async () => {
  for (const role of [null, 'member', 'guest', 'moderator']) {
    const h = spacesServer('routes', { query: async sql => sql.startsWith('SELECT') && role ? rows({ role }) : rows() })
    fail(await h.invoke('post', '/spaces/:id/channels', { body: { name: 'general' } }), role ? 403 : 404, role ? 'forbidden' : 'not_found', role ? 'Only Space owners and admins can create channels.' : 'Space not found.')
    assert.deepEqual(phases(h), ['BEGIN', 'ROLLBACK', 'response', 'release'])
    assert.deepEqual(plain(sqlEntries(h)[1][2]), [ids.space, ids.user])
    assert.match(sqlEntries(h)[1][1], /FOR UPDATE/u)
  }
})

test('Spaces message send denials preserve voice/visibility/send/everyone branches and rollback', async () => {
  for (const [row, body, status, code, message] of [
    [null, 'hi', 404, 'not_found', 'Channel not found.'],
    [{ ...access('member'), channel_type: 'voice' }, 'hi', 400, 'validation', 'Voice channels do not support text messages.'],
    [{ ...access('member'), can_view: false }, 'hi', 404, 'not_found', 'Channel not found.'],
    [{ ...access('guest'), can_send: false }, 'hi', 403, 'forbidden', 'You do not have permission to send messages in this channel.'],
    [access('member'), '@everyone hi', 403, 'forbidden', 'Only Space owners, admins, and moderators can mention everyone.'],
  ]) {
    const h = spacesServer('routes', { query: async sql => sql.startsWith('SELECT') && row ? rows(row) : rows() })
    fail(await h.invoke('post', `${C}/messages`, { body: { body } }), status, code, message)
    assert.deepEqual(phases(h), ['BEGIN', 'ROLLBACK', 'response', 'release'])
    assert.equal(h.trace.some(x => x[0] === 'publish'), false)
  }
})

test('Spaces message and mention inserts commit before exact realtime payloads and response', async () => {
  const h = spacesServer('routes', { query: async sql => sql.startsWith('SELECT sc.chat_id') ? rows(access('moderator')) : sql.startsWith('SELECT DISTINCT') ? rows({ user_id: ids.option }) : sql.startsWith('UPDATE chats') ? rows({ last_seq: '7' }) : rows() })
  const result = await h.invoke('post', `${C}/messages`, { body: { body: ' @Alice @everyone hello ' } })
  assert.equal(result.status, 201)
  assert.deepEqual(result.body, { messageId: '66666666-6666-4666-8666-000000000001', serverSeq: '7' })
  assert.deepEqual(phases(h), ['BEGIN', 'COMMIT', 'publish', 'publish', 'response', 'release'])
  assert.deepEqual(plain(sqlEntries(h).find(x => x[1].startsWith('SELECT DISTINCT'))[2]), [ids.space, ids.channel, ids.user, true, ['alice', 'everyone']])
  assert.deepEqual(plain(sqlEntries(h).find(x => x[1].startsWith('INSERT INTO channel_messages'))[2]), [result.body.messageId, ids.channel, '7', ids.user, '@Alice @everyone hello'])
  assert.deepEqual(plain(h.trace.filter(x => x[0] === 'publish').map(x => x.slice(1))), [
    [ids.channel, { type: 'channel.message', data: { id: result.body.messageId, serverSeq: '7' } }],
    [ids.channel, { type: 'channel.mention', data: { chatId: ids.channel, messageId: result.body.messageId, serverSeq: '7' } }, null, [ids.option]],
  ])
})

test('Spaces message publication failure retains existing post-COMMIT rollback/next/release behavior', async () => {
  const failure = new Error('publisher unavailable')
  const h = spacesServer('routes', { query: async sql => sql.startsWith('SELECT') ? rows(access('member')) : sql.startsWith('UPDATE chats') ? rows({ last_seq: '1' }) : rows(), publish: async () => { throw failure } })
  const result = await h.invoke('post', `${C}/messages`, { body: { body: 'hi' } })
  assert.equal(result.error, failure)
  assert.equal(result.body, undefined)
  assert.deepEqual(phases(h), ['BEGIN', 'COMMIT', 'publish', 'ROLLBACK', 'next', 'release'])
})

test('Spaces object response commits/releases before publication; elapsed scheduled events still accept RSVP', async () => {
  const h = spacesServer('objects', { query: async sql => sql.startsWith('SELECT sc.chat_id') ? rows(access('guest')) : sql.startsWith('SELECT message_id') ? rows({ message_id: ids.option, object_type: 'event', state: 'scheduled', payload: { startsAt: new Date(now - 7200000).toISOString(), endsAt: new Date(now - 3600000).toISOString() } }) : rows() })
  const result = await h.invoke('post', respond, { body: { type: 'event', rsvp: 'yes' } })
  assert.deepEqual(result.body, { ok: true })
  assert.deepEqual(phases(h), ['BEGIN', 'COMMIT', 'release', 'publish', 'response'])
  assert.deepEqual(plain(sqlEntries(h).find(x => x[1].startsWith('INSERT INTO channel_shared_object_responses'))[2]), [ids.object, ids.user, JSON.stringify({ rsvp: 'yes' })])
  assert.deepEqual(plain(h.trace.find(x => x[0] === 'publish').slice(1)), [ids.channel, { type: 'channel.object', data: { id: ids.object, messageId: ids.option } }])
})

test('Spaces missing/expired/ended object responses rollback, respond and release without publication', async () => {
  for (const [object, body, status, code, message] of [
    [null, { type: 'event', rsvp: 'yes' }, 404, 'not_found', 'Shared item not found.'],
    [{ object_type: 'poll', state: 'open', payload: { closesAt: new Date(now).toISOString() } }, { type: 'poll', optionIds: [ids.option] }, 409, 'conflict', 'This poll is closed.'],
    [{ object_type: 'event', state: 'ended', payload: {} }, { type: 'event', rsvp: 'yes' }, 409, 'conflict', 'This event is no longer accepting RSVPs.'],
  ]) {
    const h = spacesServer('objects', { query: async sql => sql.startsWith('SELECT sc.chat_id') ? rows(access('member')) : sql.startsWith('SELECT message_id') && object ? rows({ message_id: ids.option, ...object }) : rows() })
    fail(await h.invoke('post', respond, { body }), status, code, message)
    assert.deepEqual(phases(h), ['BEGIN', 'ROLLBACK', 'response', 'release'])
  }
})

test('Spaces checklist assignment permits assignee/privileged roles and writes completed state without response upsert', async () => {
  for (const [role, assignee] of [['member', ids.option], ['guest', ids.option], ['member', ids.user], ['owner', ids.option], ['admin', ids.option], ['moderator', ids.option]]) {
    const h = spacesServer('objects', { query: async sql => sql.startsWith('SELECT sc.chat_id') ? rows(access(role)) : sql.startsWith('SELECT message_id') ? rows({ message_id: ids.option, object_type: 'checklist', state: 'open', payload: { items: [{ id: ids.option, assigneeId: assignee, done: false }] } }) : rows() })
    const result = await h.invoke('post', respond, { body: { type: 'checklist', itemId: ids.option, done: true } })
    if (assignee !== ids.user && ['member', 'guest'].includes(role)) {
      fail(result, 403, 'forbidden', 'Only the assignee or a moderator can update this item.')
      assert.deepEqual(phases(h), ['BEGIN', 'ROLLBACK', 'response', 'release'])
    } else {
      assert.deepEqual(result.body, { ok: true })
      const update = sqlEntries(h).find(x => x[1].startsWith('UPDATE channel_shared_objects'))
      assert.deepEqual(plain(update[2]), [ids.object, JSON.stringify({ items: [{ id: ids.option, assigneeId: assignee, done: true }] }), 'completed'])
      assert.equal(sqlEntries(h).some(x => x[1].startsWith('INSERT INTO channel_shared_object_responses')), false)
      assert.deepEqual(phases(h), ['BEGIN', 'COMMIT', 'release', 'publish', 'response'])
    }
  }
})

test('Spaces object response DB exception rolls back and releases before next(error)', async () => {
  const failure = new Error('write failed')
  const h = spacesServer('objects', { query: async sql => {
    if (sql.startsWith('SELECT sc.chat_id')) return rows(access('member'))
    if (sql.startsWith('SELECT message_id')) return rows({ message_id: ids.option, object_type: 'event', state: 'scheduled', payload: {} })
    if (sql.startsWith('INSERT')) throw failure
    return rows()
  } })
  const result = await h.invoke('post', respond, { body: { type: 'event', rsvp: 'yes' } })
  assert.equal(result.error, failure)
  assert.deepEqual(phases(h), ['BEGIN', 'ROLLBACK', 'release', 'next'])
})

test('Spaces object creation preserves message/object insertion order and release-before-publication', async () => {
  const h = spacesServer('objects', { query: async sql => sql.startsWith('SELECT sc.chat_id') ? rows(access('member')) : sql.startsWith('UPDATE chats') ? rows({ last_seq: '9' }) : rows() })
  const result = await h.invoke('post', `${C}/objects`, { body: { type: 'poll', question: ' Q ', options: [' A ', ' B '] } })
  assert.equal(result.status, 201)
  assert.equal(result.body.serverSeq, '9')
  assert.deepEqual(phases(h), ['BEGIN', 'COMMIT', 'release', 'publish', 'response'])
  const inserts = sqlEntries(h).filter(x => x[1].startsWith('INSERT'))
  assert.match(inserts[0][1], /^INSERT INTO channel_messages/u)
  assert.match(inserts[1][1], /^INSERT INTO channel_shared_objects/u)
  assert.equal(inserts[1][2][4], 'Q')
  assert.equal(inserts[1][2][5], 'open')
  assert.equal(JSON.parse(inserts[1][2][6]).options[0].text, 'A')
  assert.deepEqual(plain(h.trace.find(x => x[0] === 'publish').slice(1)), [ids.channel, { type: 'channel.message', data: { id: result.body.messageId, serverSeq: '9' } }])
})
