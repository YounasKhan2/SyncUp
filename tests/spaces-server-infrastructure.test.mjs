import test from 'node:test'
import assert from 'node:assert/strict'
import { plain } from './helpers/foundation-harness.mjs'
import { spacesServer, ids, now } from './helpers/spaces-server-harness.mjs'

const C = '/spaces/:spaceId/channels/:channelId', F = `${C}/files/:fileId`
const rows = (...items) => ({ rows: items, rowCount: items.length })
const visible = { can_view: true, can_send: true }
const file = { object_key: ids.object, filename: 'résumé.pdf', content_type: 'application/pdf', size_bytes: '2' }
const calls = h => h.trace.filter(x => x[0] === 'pool')
const fail = (result, status, code, message) => { assert.equal(result.error, undefined); assert.equal(result.status, status); assert.deepEqual(result.body, { error: { code, message } }) }

test('Spaces file intent normalizes metadata, checks storage first, and inserts the exact pending key/expiry parameters', async () => {
  const h = spacesServer('discovery', { query: async sql => sql.startsWith('SELECT') ? rows(visible) : rows() })
  const result = await h.invoke('post', `${C}/files`, { body: { filename: ' résumé.pdf ', contentType: ' APPLICATION/PDF ', sizeBytes: 25 * 1024 * 1024 } })
  assert.equal(result.status, 201)
  assert.deepEqual(result.body, { fileId: ids.object })
  const insert = calls(h).find(x => x[1].startsWith('INSERT'))
  assert.deepEqual(plain(insert[2]), [ids.object, ids.channel, ids.user, ids.object, 'résumé.pdf', 'application/pdf', 25 * 1024 * 1024, new Date(now + 3600000).toISOString()])
  assert.ok(h.trace.findIndex(x => x[0] === 'storage') < h.trace.indexOf(insert))
  assert.equal(h.trace.some(x => ['connect', 'createFile', 'publish'].includes(x[0])), false)
})

test('Spaces missing Appwrite configuration returns exact503 without creating pending metadata', async () => {
  const h = spacesServer('discovery', { query: async () => rows(visible), storageError: new Error('Configure APPWRITE_ENDPOINT') })
  fail(await h.invoke('post', `${C}/files`, { body: { filename: 'ok.pdf', contentType: 'application/pdf', sizeBytes: 2 } }), 503, 'service_unavailable', 'File storage is not configured on this server.')
  assert.equal(calls(h).length, 1)
})

test('Spaces raw upload calls Appwrite before uploaded_at; complete requires uploaded unexpired pending ownership', async () => {
  const h = spacesServer('discovery', { query: async sql => sql.includes('AS can_view') ? rows(visible) : sql.startsWith('SELECT filename') ? rows(file) : sql.startsWith('UPDATE channel_files SET status') ? rows({ id: ids.object }) : rows() })
  const bytes = Buffer.from([1, 2])
  const uploaded = await h.invoke('put', `${F}/content`, { body: bytes, is: type => type === 'application/pdf' })
  assert.equal(uploaded.status, 204)
  assert.equal(uploaded.ended, true)
  const pending = calls(h).find(x => x[1].startsWith('SELECT filename'))
  assert.deepEqual(plain(pending[2]), [ids.object, ids.channel, ids.user])
  assert.match(pending[1], /uploaded_by = \$3 AND status = 'pending' AND expires_at > now\(\)/u)
  const create = h.trace.find(x => x[0] === 'createFile')
  assert.deepEqual(plain(create[1]), { bucketId: 'bucket', fileId: ids.object, file: { bytes: bytes.toJSON(), name: `${ids.object}.bin` }, permissions: [] })
  const uploadedAt = calls(h).find(x => x[1].startsWith('UPDATE'))
  assert.ok(h.trace.indexOf(create) < h.trace.indexOf(uploadedAt))
  assert.deepEqual(plain(uploadedAt[2]), [ids.object, ids.user])
  const completed = await h.invoke('post', `${F}/complete`)
  assert.equal(completed.status, 204)
  assert.equal(completed.ended, true)
  const ready = calls(h).find(x => x[1].startsWith('UPDATE channel_files SET status'))
  assert.match(ready[1], /uploaded_at IS NOT NULL AND expires_at > now\(\)/u)
  assert.deepEqual(plain(ready[2]), [ids.object, ids.channel, ids.user])
  assert.equal(h.trace.some(x => ['connect', 'publish'].includes(x[0])), false)
})

test('Spaces upload metadata mismatch/missing pending and complete affected-row failures retain exact errors', async () => {
  for (const [pending, bytes, mime, status, message] of [
    [null, Buffer.from([1, 2]), true, 404, 'File upload not found or expired.'],
    [file, Buffer.from([1, 2]), false, 400, 'Uploaded file type did not match its upload request.'],
    [file, Buffer.from([1]), true, 400, 'Uploaded file size did not match its upload request.'],
  ]) {
    const h = spacesServer('discovery', { query: async sql => sql.includes('AS can_view') ? rows(visible) : pending ? rows(pending) : rows() })
    fail(await h.invoke('put', `${F}/content`, { body: bytes, is: () => mime }), status, status === 404 ? 'not_found' : 'validation', message)
    assert.equal(h.trace.some(x => x[0] === 'createFile'), false)
  }
  const h = spacesServer('discovery', { query: async sql => sql.includes('AS can_view') ? rows(visible) : rows() })
  fail(await h.invoke('post', `${F}/complete`), 404, 'not_found', 'File upload not found or expired.')
})

test('Spaces ready download preserves Appwrite key, bytes and exact UTF-8 attachment/inline headers', async () => {
  for (const content_type of ['application/pdf', 'image/png']) {
    const h = spacesServer('discovery', { query: async sql => sql.includes('AS can_view') ? rows(visible) : rows({ ...file, content_type }) })
    const result = await h.invoke('get', `${F}/content`)
    assert.equal(result.status, 200)
    assert.deepEqual([...result.body], [1, 2])
    assert.deepEqual(plain(result.headers), { 'Content-Type': content_type, 'Content-Length': '2', 'Content-Disposition': `${content_type === 'image/png' ? 'inline' : 'attachment'}; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' })
    assert.deepEqual(plain(h.trace.find(x => x[0] === 'download')[1]), { bucketId: 'bucket', fileId: ids.object })
    assert.match(calls(h)[1][1], /status = 'ready'/u)
    assert.deepEqual(plain(calls(h)[1][2]), [ids.object, ids.channel])
  }
  const h = spacesServer('discovery')
  fail(await h.invoke('get', `${F}/content`), 404, 'not_found', 'File not found.')
  assert.equal(h.trace.some(x => x[0] === 'storage'), false)
})

test('Spaces search escapes LIKE input and preserves per-resource visibility, date/from parameters and global order', async () => {
  const data = { message: { type: 'message', id: 'm', created_at: '2026-01-01T10:00:00Z' }, file: { type: 'file', id: 'f', created_at: '2026-01-01T12:00:00Z' }, object: { type: 'object', id: 'o', created_at: '2026-01-01T11:00:00Z' } }
  const h = spacesServer('discovery', { query: async sql => rows(data[/SELECT '(message|file|object)'/u.exec(sql)[1]]) })
  const result = await h.invoke('get', '/spaces/:spaceId/search', { query: { q: ' a%_\\b ', from: ids.user, after: '2026-01-01', before: '2026-01-02' } })
  assert.deepEqual(result.body, { results: [data.file, data.object, data.message] })
  for (const call of calls(h)) {
    assert.deepEqual(plain(call[2].slice(0, 6)), [ids.space, ids.user, 'a\\%\\_\\\\b', ids.user, '2026-01-01', '2026-01-02'])
    assert.match(call[1], /grant_member\.left_at IS NULL/u)
    assert.match(call[1], /COALESCE\(permission\.can_view, true\)/u)
    assert.match(call[1], /created_at >= \$5::date/u)
    assert.match(call[1], /created_at < \(\$6::date \+ 1\)/u)
    assert.match(call[1], /ORDER BY .*created_at DESC LIMIT 50/u)
  }
})

test('Spaces search has/objectType suppress the same branches, including empty intersection and100-result cap', async () => {
  for (const [filters, kinds] of [[{ has: 'image' }, ['file']], [{ has: 'file' }, ['file']], [{ objectType: 'poll' }, ['object']], [{ has: 'image', objectType: 'poll' }, []]]) {
    const h = spacesServer('discovery')
    assert.deepEqual((await h.invoke('get', '/spaces/:spaceId/search', { query: { q: 'ok', ...filters } })).body, { results: [] })
    assert.deepEqual(calls(h).map(x => /SELECT '(message|file|object)'/u.exec(x[1])[1]), kinds)
    if (kinds.length) assert.equal(calls(h)[0][2][6], filters.has ?? filters.objectType)
  }
  const h = spacesServer('discovery', { query: async () => rows(...Array.from({ length: 50 }, (_, i) => ({ id: i, created_at: new Date(now - i).toISOString() }))) })
  assert.equal((await h.invoke('get', '/spaces/:spaceId/search', { query: { q: 'ok' } })).body.results.length, 100)
})

test('Spaces search invalid filter ranges return exact400 without queries', async () => {
  for (const [query, message] of [[{ q: 'x' }, 'Enter a search term and valid filters.'], [{ q: 'ok', has: 'video' }, 'Enter a search term and valid filters.'], [{ q: 'ok', after: '2026-01-02', before: '2026-01-01' }, 'The start date must be before the end date.']]) {
    const h = spacesServer('discovery')
    fail(await h.invoke('get', '/spaces/:spaceId/search', { query }), 400, 'validation', message)
    assert.equal(calls(h).length, 0)
  }
})

test('Spaces voice token preserves config503, missing404, room naming, identity and resolved publish grants', async () => {
  for (const can_speak of [false, true]) {
    const h = spacesServer('routes', { query: async () => rows({ role: 'guest', display_name: 'Guest', can_view: true, can_speak }), environment: { LIVEKIT_URL: 'wss://voice.test', LIVEKIT_API_KEY: 'key', LIVEKIT_API_SECRET: 'secret' } })
    const result = await h.invoke('post', `${C}/voice/token`)
    assert.deepEqual(result.body, { url: 'wss://voice.test', token: 'test-token', canSpeak: can_speak })
    assert.deepEqual(plain(h.trace.find(x => x[0] === 'roomService').slice(1)), ['wss://voice.test', 'key', 'secret'])
    assert.deepEqual(plain(h.trace.find(x => x[0] === 'createRoom')[1]), { name: `syncup-space-voice-${ids.channel}`, emptyTimeout: 60, maxParticipants: 16 })
    assert.deepEqual(plain(h.trace.find(x => x[0] === 'token').slice(1)), ['key', 'secret', { identity: ids.user, name: 'Guest', ttl: '10m' }])
    assert.deepEqual(plain(h.trace.find(x => x[0] === 'grant')[1]), { roomJoin: true, room: `syncup-space-voice-${ids.channel}`, canPublish: can_speak, canPublishSources: ['microphone'], canSubscribe: true, canPublishData: false })
  }
  const missing = spacesServer('routes')
  fail(await missing.invoke('post', `${C}/voice/token`), 404, 'not_found', 'Voice room not found.')
  const unconfigured = spacesServer('routes', { query: async () => rows({ can_view: true }), environment: { LIVEKIT_URL: 'wss://voice.test', LIVEKIT_API_KEY: 'key' } })
  fail(await unconfigured.invoke('post', `${C}/voice/token`), 503, 'service_unavailable', 'Voice rooms are not configured on this server.')
  assert.equal(unconfigured.trace.some(x => x[0] === 'roomService'), false)
})

test('Spaces limiter/raw registration preserves per-user limits and upload byte cap without simulating middleware', () => {
  for (const [module, message] of [['routes', 'Too many voice room requests. Try again shortly.'], ['discovery', 'Too many file uploads. Try again shortly.']]) {
    const h = spacesServer(module), limiter = h.limits[0]
    assert.equal(limiter.windowMs, 60000)
    assert.equal(limiter.limit, 30)
    assert.equal(limiter.standardHeaders, 'draft-8')
    assert.equal(limiter.legacyHeaders, false)
    assert.equal(limiter.keyGenerator({ auth: { userId: ids.user } }), ids.user)
    assert.deepEqual(plain(limiter.message), { error: { code: 'rate_limited', message } })
    if (module === 'discovery') {
      assert.equal(h.trace.find(x => x[0] === 'raw')[1].limit, 25 * 1024 * 1024)
      assert.equal(h.registrations.find(x => x.method === 'put').handlers.length, 3)
    } else assert.deepEqual(h.registrations.slice(0, 2).map(x => x.method), ['use', 'use'])
  }
})
