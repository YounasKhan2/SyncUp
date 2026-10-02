import test from 'node:test'
import assert from 'node:assert/strict'
import { load, plain } from './helpers/foundation-harness.mjs'

const bytes = new Uint8Array([0, 255, 2]).buffer
const profile = { displayName: ' Sam ', username: 'sam', about: '', discoverable: false, readReceiptsEnabled: true }
const report = { messageId: 'id', reason: 'other', details: '' }
const cases = [
  ['account', 'listSessions', [], ['/api/auth/sessions']],
  ['account', 'revokeSession', ['a/b ?%é'], ['/api/auth/sessions/a%2Fb%20%3F%25%C3%A9/revoke', { method: 'POST' }]],
  ['account', 'updateProfile', [profile], ['/api/auth/me', { method: 'PATCH', body: '{"displayName":" Sam ","username":"sam","about":"","discoverable":false,"readReceiptsEnabled":true}' }]],
  ['account', 'getCurrentUser', [], ['/api/auth/me']],
  ['account', 'uploadAvatar', [bytes, 'image/webp'], ['/api/auth/me/avatar', bytes, 'image/webp']],
  ['account', 'removeAvatar', [], ['/api/auth/me/avatar', { method: 'DELETE' }]],
  ['messaging', 'submitReport', [report], ['/api/reports', { method: 'POST', body: '{"messageId":"id","reason":"other","details":""}' }]],
]

for (const [feature, name, args, expected] of cases) {
  test(`${feature}.${name}: exact transport arguments, unchanged response/Promise and rejection identity`, async () => {
    for (const reject of [false, true]) {
      const calls = [], result = { opaque: 'untransformed response' }, failure = new Error('transport failure')
      const promise = reject ? Promise.reject(failure) : Promise.resolve(result)
      const transport = (...values) => { calls.push(values); return promise }
      const boundary = load(`client/src/features/${feature}/api.ts`, { '../../shared/api': { api: transport, apiUpload: transport } })
      const returned = boundary[name](...args)
      assert.equal(returned, promise)
      if (reject) await assert.rejects(returned, (error) => error === failure)
      else assert.equal(await returned, result)
      assert.equal(calls.length, 1)
      if (name === 'uploadAvatar') {
        assert.equal(calls[0][0], expected[0]); assert.equal(calls[0][1], bytes); assert.equal(calls[0][2], 'image/webp')
      } else assert.deepEqual(plain(calls[0]), expected)
    }
  })
}

test('Feature boundaries through the real shared transport retain wire methods, headers, credentials and upload body identity', async () => {
  for (const [feature, name, args, expected] of cases) {
    const calls = []
    const shared = load('client/src/shared/api.ts', {}, {
      navigator: {}, fetch: async (...request) => { calls.push(request); return Response.json({ user: { id: 'user' } }) },
    })
    const boundary = load(`client/src/features/${feature}/api.ts`, { '../../shared/api': shared })
    await boundary[name](...args)
    assert.equal(calls.length, 1)
    assert.equal(calls[0][0], expected[0])
    const options = calls[0][1]
    assert.equal(options.credentials, 'same-origin')
    assert.equal(options.method, name === 'uploadAvatar' ? 'PUT' : expected[1]?.method)
    assert.deepEqual(plain(options.headers), { 'Content-Type': name === 'uploadAvatar' ? 'image/webp' : 'application/json' })
    assert.equal(options.body, name === 'uploadAvatar' ? bytes : expected[1]?.body)
  }
})
