import test from 'node:test'
import assert from 'node:assert/strict'
import { functionBody, load, plain } from './helpers/foundation-harness.mjs'

const account = 'client/src/features/account/AccountPanel.tsx'
const report = 'client/src/features/messaging/components/ReportDialog.tsx'
const noop = () => {}
const tick = () => new Promise((resolve) => setImmediate(resolve))

// The same production handler tests run before and after extraction. If present,
// load the real feature boundary with the same explicit transport double.
function bindings(feature, transport) {
  try {
    const boundary = load(`client/src/features/${feature}/api.ts`, { '../../shared/api': transport })
    return { ...boundary, revokeAccountSession: boundary.revokeSession, removeAccountAvatar: boundary.removeAvatar }
  }
  catch (error) { if (error.code !== 'ENOENT') throw error; return {} }
}
function accountHandler(name, globals) {
  return functionBody(account, name, { ...globals, ...bindings('account', { api: globals.api, apiUpload: globals.apiUpload }) })
}

test('Account session load returns the same list/current ID; revoke encodes ID then reloads once', async () => {
  const requests = [], updates = []
  const response = { sessions: [{ id: 'session' }], currentSessionId: 'current' }
  const globals = {
    api: async (...args) => { requests.push(args); return response },
    setSessionsError: noop, setSessions: (value) => updates.push(value), setCurrentSessionId: (value) => updates.push(value),
  }
  const reload = accountHandler('loadSessions', globals)
  await reload()
  assert.deepEqual(requests, [['/api/auth/sessions']])
  assert.equal(updates[0], response.sessions)
  assert.equal(updates[1], 'current')
  await accountHandler('revokeSession', { ...globals, loadSessions: reload })('a/b ?%é')
  assert.deepEqual(plain(requests.slice(1)), [
    ['/api/auth/sessions/a%2Fb%20%3F%25%C3%A9/revoke', { method: 'POST' }], ['/api/auth/sessions'],
  ])
})

test('Account revoke failure skips reload and retains Error/fallback UI copy', async () => {
  for (const failure of [new Error('revoked denied'), 'non-Error']) {
    let message
    await accountHandler('revokeSession', {
      api: async () => { throw failure }, loadSessions: () => assert.fail('must not reload'), setSessionsError: (value) => { message = value },
    })('id')
    assert.equal(message, failure instanceof Error ? failure.message : 'Unable to revoke session.')
  }
})

test('Account profile sends exact ordered PATCH JSON, retains FormData conversion and callback timing', async () => {
  for (const checked of [false, true]) {
    const trace = [], requests = []
    const user = { id: 'user' }
    const values = { displayName: ' Sam ', username: 'Sam', about: null, discoverable: checked ? 'on' : null, readReceiptsEnabled: checked ? 'on' : null }
    class FormDataStub { get(name) { return values[name] } }
    await accountHandler('saveProfile', {
      FormData: FormDataStub, setError: noop, setSaved: (value) => trace.push(['saved', value]), setLoading: (value) => trace.push(['loading', value]),
      api: async (...args) => { requests.push(args); trace.push(['request']); return { user } },
      onSaved: (value) => { assert.equal(value, user); trace.push(['callback']) },
    })({ preventDefault: noop, currentTarget: {} })
    assert.deepEqual(plain(requests), [['/api/auth/me', { method: 'PATCH', body: JSON.stringify({ displayName: ' Sam ', username: 'Sam', about: '', discoverable: checked, readReceiptsEnabled: checked }) }]])
    assert.deepEqual(trace, [['saved', ''], ['loading', true], ['request'], ['callback'], ['saved', 'Profile saved.'], ['loading', false]])
  }
})

test('Account avatar forwards exact bytes/type; waits for upload then current user before callback', async () => {
  const bytes = new Uint8Array([0, 127, 255, 1]).buffer
  const user = { id: 'user' }, trace = [], requests = []
  let resolveUpload
  const uploading = new Promise((resolve) => { resolveUpload = resolve })
  const input = { current: { value: 'photo' } }
  const task = accountHandler('saveAvatar', {
    avatarFile: { type: 'image/webp', arrayBuffer: async () => bytes }, avatarInput: input,
    setError: noop, setSaved: (value) => trace.push(['saved', value]), setAvatarBusy: (value) => trace.push(['busy', value]),
    setAvatarFile: (value) => trace.push(['file', value]), setAvatarPreview: (value) => trace.push(['preview', value]),
    apiUpload: (...args) => { requests.push(args); trace.push(['upload']); return uploading },
    api: async (...args) => { requests.push(args); trace.push(['get']); return { user } },
    onSaved: (value) => { assert.equal(value, user); trace.push(['callback']) },
  })()
  await tick()
  assert.equal(requests.length, 1)
  assert.equal(requests[0][0], '/api/auth/me/avatar')
  assert.equal(requests[0][1], bytes)
  assert.equal(requests[0][2], 'image/webp')
  assert.equal(trace.some(([event]) => event === 'callback'), false)
  resolveUpload()
  await task
  assert.deepEqual(requests[1], ['/api/auth/me'])
  assert.deepEqual(trace, [['saved', ''], ['busy', true], ['upload'], ['get'], ['callback'], ['file', null], ['preview', ''], ['saved', 'Profile photo updated.'], ['busy', false]])
  assert.equal(input.current.value, '')
})

test('Avatar failure at upload or GET retains file/input and never invokes onSaved', async () => {
  for (const at of ['upload', 'get']) {
    const calls = [], input = { current: { value: 'photo' } }, errors = []
    await accountHandler('saveAvatar', {
      avatarFile: { type: 'image/png', arrayBuffer: async () => new ArrayBuffer(2) }, avatarInput: input,
      setError: (value) => errors.push(value), setSaved: noop, setAvatarBusy: noop,
      setAvatarFile: () => assert.fail('retain file'), setAvatarPreview: () => assert.fail('retain preview'), onSaved: () => assert.fail('no callback'),
      apiUpload: async () => { calls.push('upload'); if (at === 'upload') throw new Error('upload failed') },
      api: async () => { calls.push('get'); throw new Error('get failed') },
    })()
    assert.deepEqual(calls, at === 'upload' ? ['upload'] : ['upload', 'get'])
    assert.equal(errors.at(-1), `${at} failed`)
    assert.equal(input.current.value, 'photo')
  }
})

test('Avatar removal sends one DELETE, uses returned user and retains cleanup/callback order', async () => {
  const requests = [], trace = [], user = { id: 'user' }, input = { current: { value: 'photo' } }
  await accountHandler('removeAvatar', {
    avatarInput: input, setError: noop, setSaved: (value) => trace.push(['saved', value]), setAvatarBusy: (value) => trace.push(['busy', value]),
    setAvatarFile: (value) => trace.push(['file', value]), setAvatarPreview: (value) => trace.push(['preview', value]),
    api: async (...args) => { requests.push(args); return { user } }, onSaved: (value) => { assert.equal(value, user); trace.push(['callback']) },
  })()
  assert.deepEqual(plain(requests), [['/api/auth/me/avatar', { method: 'DELETE' }]])
  assert.deepEqual(trace, [['saved', ''], ['busy', true], ['callback'], ['file', null], ['preview', ''], ['saved', 'Profile photo removed.'], ['busy', false]])
  assert.equal(input.current.value, '')
})

test('Report sends exact ordered JSON; pending request does not close; success closes once and failure retains existing copy', async () => {
  for (const failure of [null, new Error('report denied'), 'non-Error']) {
    const requests = [], trace = []
    let settle
    const pending = new Promise((resolve, reject) => { settle = () => failure ? reject(failure) : resolve({ ignored: true }) })
    const api = (...args) => { requests.push(args); return pending }
    const submit = functionBody(report, 'submit', {
      api, ...bindings('messaging', { api }), messageId: 'message', reason: 'other', details: ' details\n',
      setSubmitting: (value) => trace.push(['busy', value]), setError: (value) => trace.push(['error', value]), onClose: () => trace.push(['close']),
    })
    const task = submit({ preventDefault: () => trace.push(['prevent']) })
    assert.deepEqual(plain(requests), [['/api/reports', { method: 'POST', body: '{"messageId":"message","reason":"other","details":" details\\n"}' }]])
    assert.deepEqual(trace, [['prevent'], ['busy', true], ['error', '']])
    settle(); await task
    assert.deepEqual(trace.slice(3), failure ? [['error', failure instanceof Error ? failure.message : 'Unable to submit this report.'], ['busy', false]] : [['close'], ['busy', false]])
  }
})
