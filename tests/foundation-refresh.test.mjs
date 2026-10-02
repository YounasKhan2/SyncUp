import test from 'node:test'
import assert from 'node:assert/strict'
import { load, functionBody, warning, routeBody } from './helpers/foundation-harness.mjs'

const shared = 'client/src/shared/api.ts'
const calls = 'client/src/features/calls/CallWindow.tsx'
const response = (status, message = 'expired') => ({ status, ok: status < 400,
  json: async () => status < 400 ? { ok: true } : { error: { message } } })

function transport(refreshStatus = 200, failNetwork = false) {
  let release
  const gate = new Promise((resolve) => { release = resolve })
  const requests = []
  const counts = new Map()
  const fetch = async (path, options) => {
    requests.push({ path, options })
    if (path === '/api/auth/refresh') {
      await gate
      if (failNetwork) throw new Error('network down')
      return response(refreshStatus)
    }
    const count = (counts.get(path) ?? 0) + 1
    counts.set(path, count)
    return response(count === 1 || refreshStatus !== 200 ? 401 : 200)
  }
  let locks = 0
  const globals = { fetch, navigator: { locks: { request: async (_name, run) => { locks++; return run() } } } }
  return { api: load(shared, {}, globals).api, callApi: functionBody(calls, 'callApi', globals),
    requests, counts, release, lockCount: () => locks }
}
const settleRequests = () => new Promise((resolve) => setImmediate(resolve))

test('Given two ordinary 401s, when refresh overlaps, then one refresh and one retry each', async () => {
  const t = transport()
  const pending = Promise.all([t.api('/api/a'), t.api('/api/b')])
  await settleRequests()
  assert.equal(t.requests.filter((r) => r.path === '/api/auth/refresh').length, 1)
  t.release()
  await pending
  assert.deepEqual([...t.counts.values()], [2, 2])
  assert.equal(t.lockCount(), 1)
  assert.ok(t.requests.every((r) => r.options.credentials === 'same-origin'))
})

// This characterizes existing behavior, not desirability. Correction needs separate review.
test(`${warning}: ordinary API and Calls refresh independently`, async () => {
  const t = transport()
  const pending = Promise.all([t.api('/api/a'), t.callApi('/api/call')])
  await settleRequests()
  assert.equal(t.requests.filter((r) => r.path === '/api/auth/refresh').length, 2)
  assert.equal(t.lockCount(), 1)
  t.release()
  await pending
  assert.deepEqual([...t.counts.values()], [2, 2])
})

for (const network of [false, true]) test(`Given refresh ${network ? 'network rejection' : '401'}, then neither retries and errors propagate`, async () => {
  const t = transport(401, network)
  const pending = Promise.allSettled([t.api('/api/a'), t.callApi('/api/call')])
  await settleRequests()
  t.release()
  const results = await pending
  assert.deepEqual(results.map((r) => r.status), ['rejected', 'rejected'])
  assert.equal(results[0].reason.message, 'expired')
  assert.equal(results[1].reason.message, network ? 'network down' : 'expired')
  assert.deepEqual([...t.counts.values()], [1, 1])
})

test('Given a successful refresh but another 401, then retries stop after one attempt', async () => {
  let refreshes = 0, attempts = 0
  const globals = { navigator: {}, fetch: async (path) => {
    if (path === '/api/auth/refresh') { refreshes++; return response(200) }
    attempts++; return response(401)
  } }
  await assert.rejects(load(shared, {}, globals).api('/api/a'), /expired/)
  await assert.rejects(functionBody(calls, 'callApi', globals)('/api/call'), /expired/)
  assert.equal(refreshes, 2)
  assert.equal(attempts, 4)
})

test(`${warning}: reused refresh token revokes its family and clears both cookies`, async () => {
  const queries = [], cleared = []
  const client = { query: async (sql, values) => {
    queries.push({ sql, values })
    if (sql.includes('SELECT s.id')) return { rows: [{ id: 'session', user_id: 'user', refresh_family: 'family', used_at: new Date() }] }
    if (sql.includes('UPDATE sessions')) return { rows: [{ id: 'session', user_id: 'user' }] }
    return { rows: [] }
  }, release() {} }
  let status, result
  const handler = routeBody('server/features/auth/routes.ts', 'post', '/refresh', {
    authSecret() {}, refreshCookie: 'refresh', accessCookie: 'access', isProduction: false,
    hashToken: () => 'hash', uuidv7: () => 'event', pool: { connect: async () => client },
  })
  const reply = { clearCookie: (name) => cleared.push(name),
    status(code) { status = code; return this }, json(value) { result = value } }
  await handler({ cookies: { refresh: 'x'.repeat(32) } }, reply, (e) => { throw e })
  assert.equal(status, 401)
  assert.equal(result.error.message, 'Session revoked after token reuse.')
  assert.deepEqual(cleared, ['access', 'refresh'])
  assert.deepEqual([...queries.find((q) => q.sql.includes('UPDATE sessions')).values], ['family'])
  assert.ok(queries.some((q) => q.sql.includes('refresh_token_reuse')))
  assert.ok(queries.some((q) => q.sql === 'COMMIT'))
})
