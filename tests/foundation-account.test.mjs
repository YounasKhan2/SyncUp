import test from 'node:test'
import assert from 'node:assert/strict'
import { load, functionBody, memoryIndexedDB, warning, plain, source } from './helpers/foundation-harness.mjs'

const outboxPath = 'client/src/features/messaging/outbox.ts'
const workspace = 'client/src/features/workspace/WorkspacePage.tsx'
const jobPath = 'client/src/features/media/v2/jobStore.ts'
const cachePath = 'client/src/features/media/v2/localMediaCache.ts'
const queued = { chatId: 'A-chat', localId: 'local', idempotencyKey: 'A-key',
  bodyCiphertext: 'ciphertext', bodyNonce: 'nonce', keyEnvelopes: { A: 'envelope' },
  createdAt: '2026-01-01T00:00:00Z', attempts: 0, nextAttemptAt: 0 }
const job = { id: 'A-job', attachmentId: 'A-media', uploadSessionId: 'A-session', chatId: 'A-chat',
  plaintextSize: 1, ciphertextSize: 2, chunkSize: 2, chunkCount: 1, acknowledgedBytes: 0,
  state: 'queued', createdAt: 1, updatedAt: 1 }

// Existing behavior is not asserted desirable. Correction requires separate review.
test(`${warning}: A records survive sign-out and are readable by a fresh same-browser consumer`, async () => {
  const indexedDB = memoryIndexedDB()
  const A = load(outboxPath, {}, { indexedDB })
  const jobsA = load(jobPath, {}, { indexedDB })
  const cache = load(cachePath)
  const file = new File(['plain'], 'A.txt')
  await A.saveDraft('A-chat', 'private draft')
  await A.savePendingMessage(queued)
  await jobsA.putMediaV2Job(job)
  cache.rememberLocalMediaV2Source('A-media', file)
  const lifecycle = []
  await functionBody(workspace, 'signOut', {
    api: async (path) => { lifecycle.push(path) },
    lockKeyBundle: () => lifecycle.push('lock'), onSignedOut: () => lifecycle.push('signed-out'),
    setError: (e) => assert.fail(e),
  })()
  assert.deepEqual(lifecycle, ['/api/auth/sign-out', 'lock', 'signed-out'])
  const B = load(outboxPath, {}, { indexedDB })
  assert.equal(await B.loadDraft('A-chat'), 'private draft')
  assert.deepEqual(plain(await B.listAllDrafts()), { 'A-chat': 'private draft' })
  assert.deepEqual(plain(await B.listPendingMessages()), [queued])
  assert.deepEqual(plain(await load(jobPath, {}, { indexedDB }).listRecoverableMediaV2Jobs()), [job])
  assert.equal(cache.getLocalMediaV2Source('A-media'), file)
})

test(`${warning}: B outbox flush attempts A ciphertext with current transport and retains it on denial`, async () => {
  const store = load(outboxPath, {}, { indexedDB: memoryIndexedDB() })
  await store.savePendingMessage(queued)
  const requests = []
  const flushing = { current: false }
  class Clock extends Date { static now() { return 10000 } }
  await functionBody(workspace, 'flushOutbox', {
    ...store, Date: Clock, navigator: { onLine: true }, flushing,
    api: async (path, options) => { requests.push({ path, body: JSON.parse(options.body) }); throw new Error('B forbidden') },
    setPending() {}, setError: (e) => assert.fail(e), activeChatId: 'B-chat', refreshInbox: () => assert.fail('denied'),
  })()
  assert.equal(requests[0].path, '/api/chats/A-chat/messages')
  assert.deepEqual(requests[0].body, { bodyCiphertext: 'ciphertext', bodyNonce: 'nonce', keyEnvelopes: { A: 'envelope' }, idempotencyKey: 'A-key' })
  assert.deepEqual(plain(await store.listPendingMessages()), [{ ...queued, attempts: 1, nextAttemptAt: 11000 }])
  assert.equal(flushing.current, false)
})

test('Given sign-out rejection, then key lock and signed-out callback are not invoked', async () => {
  let error
  await functionBody(workspace, 'signOut', {
    api: async () => { throw new Error('offline') }, lockKeyBundle: () => assert.fail('lock'),
    onSignedOut: () => assert.fail('signed out'), setError: (value) => { error = value },
  })()
  assert.equal(error, 'offline')
})

test(`${warning}: local and OPFS plaintext hydration returns without API or key unwrap`, async () => {
  for (const local of [true, false]) {
    const file = new File(['plain'], 'A.txt')
    const calls = []
    const directory = { getDirectoryHandle: async (name) => { calls.push(name); return directory },
      getFileHandle: async (name) => { calls.push(name); return { getFile: async () => file } } }
    const hydrate = load('client/src/features/media/v2/mediaHydratorV2.ts', {
      '../../../shared/api': { api: () => assert.fail('API must not run') },
      '../../auth/crypto/crypto': { unwrapMediaKey: () => assert.fail('key must not unwrap') },
      './cryptoWorker': { MediaV2CryptoWorker: class { constructor() { assert.fail('worker') } } },
      './localMediaCache': { getLocalMediaV2Source: () => local ? file : null },
      './recordCodec': { MEDIA_V2_HEADER_BYTES: 1, MEDIA_V2_TAG_BYTES: 1 },
    }, { navigator: { storage: { getDirectory: async () => directory } } })
    const result = await hydrate.hydrateMediaV2({ id: 'A-media', filename: 'A.txt', content_type: 'text/plain', size_bytes: 5 })
    assert.equal(await result.text(), 'plain')
    assert.deepEqual(calls, local ? [] : ['syncup-media-v2', 'playback', 'A-media.bin'])
  }
})

test(`${warning}: media runtime starts once; only explicit stop disposes it`, () => {
  let starts = 0, stops = 0
  const listeners = new Map()
  const runtime = load('client/src/features/media/v2/runtime.ts', {
    './appwriteTransport': { appwriteMediaV2Transport: {} },
    './uploadManager': { MediaV2UploadManager: class {
      handleOffline = () => {}; handleOnline = () => {}
      initialize() { starts++ } dispose() { stops++ }
    } },
  }, { window: { addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name) } })
  runtime.startMediaV2Runtime(); runtime.startMediaV2Runtime()
  assert.equal(starts, 1); assert.equal(listeners.size, 2); assert.equal(stops, 0)
  assert.ok(source('client/src/main.tsx').includes('startMediaV2Runtime()'))
  assert.ok(!source(workspace).includes('stopMediaV2Runtime'))
  runtime.stopMediaV2Runtime(); runtime.stopMediaV2Runtime()
  assert.equal(stops, 1); assert.equal(listeners.size, 0)
})
