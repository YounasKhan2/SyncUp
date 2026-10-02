import test from 'node:test'
import assert from 'node:assert/strict'
import * as jsx from 'react/jsx-runtime'
import { functionBody, load } from './helpers/foundation-harness.mjs'

// Execute unchanged production callbacks; transport and key lifecycle are doubles.
// No real password, session cookie, crypto primitive or authenticated DOM is used.
function auth({ mode = 'sign-up', bundle = { publicKey: 'fixture' }, unlocked = true, failure, unlock = true } = {}) {
  const calls = [], errors = [], loading = [], signed = []
  const user = { id: 'synthetic' }
  const fields = { email: 'synthetic@example.invalid', password: 'synthetic-test-only', username: 'synthetic', displayName: 'Synthetic' }
  const submit = functionBody('client/src/features/auth/AuthScreen.tsx', 'submit', {
    mode, setError: value => errors.push(value), setLoading: value => loading.push(value),
    FormData: class { get(key) { return fields[key] } },
    createKeyBundle: async password => { calls.push(['create', password]); return { keyBundle: { generated: true } } },
    isKeyBundleUnlocked: () => unlocked,
    unlockKeyBundle: async (key, password) => { calls.push(['unlock', key, password]); return unlock },
    api: async (path, options) => { calls.push([path, options]); if (failure) throw failure; return { user, keyBundle: bundle } },
    onSignedIn: value => signed.push(value),
  })
  return { submit, calls, errors, loading, signed, fields, user }
}

test('Final Auth sign-up creates keys before exact POST payload and invokes success only after unlocked check', async () => {
  const h = auth(); let prevented = false
  await h.submit({ preventDefault() { prevented = true }, currentTarget: {} })
  assert.equal(prevented, true)
  assert.equal(h.calls[0][0], 'create')
  assert.equal(h.calls[1][0], '/api/auth/sign-up')
  assert.equal(h.calls[1][1].method, 'POST')
  assert.deepEqual(JSON.parse(h.calls[1][1].body), { ...h.fields, keyBundle: { generated: true } })
  assert.deepEqual(h.loading, [true, false]); assert.deepEqual(h.signed, [h.user])
})

test('Final Auth sign-in with existing bundle unwraps before success and omits sign-up fields', async () => {
  const h = auth({ mode: 'sign-in' }); await h.submit({ preventDefault() {}, currentTarget: {} })
  assert.deepEqual(h.calls.map(c => c[0]), ['/api/auth/sign-in', 'unlock'])
  assert.deepEqual(JSON.parse(h.calls[0][1].body), { email: h.fields.email, password: h.fields.password })
  assert.deepEqual(h.signed, [h.user])
})

test('Final Auth legacy sign-in initializes missing bundle before reporting success', async () => {
  const h = auth({ mode: 'sign-in', bundle: null }); await h.submit({ preventDefault() {}, currentTarget: {} })
  assert.deepEqual(h.calls.map(c => c[0]), ['/api/auth/sign-in', 'create', '/api/auth/encryption/initialize'])
  assert.equal(h.calls[2][1].method, 'POST')
  assert.deepEqual(JSON.parse(h.calls[2][1].body), { password: h.fields.password, keyBundle: { generated: true } })
  assert.deepEqual(h.signed, [h.user])
})

for (const scenario of [
  { name: 'key unlock rejection', mode: 'sign-in', unlock: false, message: 'Unable to unlock encrypted chats. Check your password and try again.' },
  { name: 'new key remains locked', unlocked: false, message: 'Unable to unlock the new account’s encryption key.' },
  { name: 'transport rejection', failure: new Error('service unavailable'), message: 'service unavailable' },
]) test(`Final Auth ${scenario.name} preserves error and resets busy without success`, async () => {
  const h = auth(scenario); await h.submit({ preventDefault() {}, currentTarget: {} })
  assert.deepEqual(h.errors, ['', scenario.message]); assert.deepEqual(h.loading, [true, false]); assert.deepEqual(h.signed, [])
})

for (const bundle of [null, { fixture: true }]) test(`Final Unlock ${bundle ? 'existing' : 'missing'} bundle retains API/key/callback sequence`, async () => {
  const calls = [], errors = [], loading = []
  const unlock = functionBody('client/src/features/auth/UnlockScreen.tsx', 'unlock', {
    password: 'synthetic-test-only', setError: value => errors.push(value), setLoading: value => loading.push(value),
    api: async (path, options) => { calls.push([path, options]); return { keyBundle: bundle } },
    unlockKeyBundle: async () => { calls.push(['unlock']); return true },
    createKeyBundle: async () => { calls.push(['create']); return { keyBundle: { generated: true } } },
    onUnlocked: () => calls.push(['success']),
  })
  await unlock({ preventDefault() {} })
  assert.deepEqual(calls.map(c => c[0]), bundle ? ['/api/auth/key-bundle', 'unlock', 'success'] : ['/api/auth/key-bundle', 'create', '/api/auth/encryption/initialize', 'success'])
  if (!bundle) assert.deepEqual(JSON.parse(calls[2][1].body), { password: 'synthetic-test-only', keyBundle: { generated: true } })
  assert.deepEqual(errors, ['']); assert.deepEqual(loading, [true, false])
})

test('Final Unlock wrong password retains error and never invokes unlocked callback', async () => {
  const errors = [], loading = []; let successes = 0
  const unlock = functionBody('client/src/features/auth/UnlockScreen.tsx', 'unlock', {
    password: 'synthetic', setError: value => errors.push(value), setLoading: value => loading.push(value),
    api: async () => ({ keyBundle: {} }), unlockKeyBundle: async () => false, onUnlocked: () => successes++,
  })
  await unlock({ preventDefault() {} })
  assert.deepEqual(errors, ['', 'That password could not unlock this account’s encryption key.'])
  assert.deepEqual(loading, [true, false]); assert.equal(successes, 0)
})

for (const scenario of [
  { name: 'restored locked session', user: { id: 'synthetic' }, unlocked: false, expected: 'UnlockScreen' },
  { name: 'restored unlocked session', user: { id: 'synthetic' }, unlocked: true, expected: 'WorkspacePage' },
  { name: 'expired session', error: 'Session expired.', expected: 'AuthScreen' },
  { name: 'service failure', error: 'Unavailable', expected: 'main' },
]) test(`Final router ${scenario.name} retains restore selection and unmount cancellation`, async () => {
  const states = [], effects = []; let slot = 0
  const mocks = { react: {
    useState(initial) { const i = slot++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = value }] },
    useEffect(fn) { effects.push(fn) },
  }, 'react/jsx-runtime': jsx,
    '../shared/api': { api: async path => { assert.equal(path, '/api/auth/me'); if (scenario.error) throw new Error(scenario.error); return { user: scenario.user } } },
    '../features/auth/crypto/crypto': { isKeyBundleUnlocked: () => scenario.unlocked ?? false },
  }
  for (const [folder, name] of [['auth', 'AuthScreen'], ['auth', 'UnlockScreen'], ['workspace', 'WorkspacePage']]) mocks[`../features/${folder}/${name}`] = { [name]: props => jsx.jsx(name, props) }
  const router = load('client/src/app/AppRouter.tsx', mocks).AppRouter
  assert.equal(router().props.className, 'loading-screen')
  const stop = effects[0](); await new Promise(resolve => setImmediate(resolve)); slot = 0
  const tree = router(); assert.equal(typeof tree.type === 'string' ? tree.type : tree.type(tree.props).type, scenario.expected)
  if (scenario.error === 'Unavailable') assert.equal(tree.props.className, 'service-error')
  stop()
  if (scenario.expected === 'WorkspacePage') { tree.props.onSignedOut(); assert.equal(states[0], null); assert.equal(states[3], false) }
  states.length = 0; effects.length = 0; slot = 0
  router(); effects[0]()()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(states[0], null); assert.equal(states[1], true); assert.equal(states[2], '')
})
