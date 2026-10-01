import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import test from 'node:test'

if (!globalThis.crypto) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })

const codec = await import('../client/src/features/media/v2/recordCodec.ts')

const attachmentId = '018f22f2-65d7-7c34-8f9a-7f47a665f9ad'
const rawKey = Uint8Array.from({ length: 32 }, (_, index) => index)
const fixedIv = Uint8Array.from({ length: 12 }, (_, index) => 0xa0 + index)
const encoder = new TextEncoder()
const decoder = new TextDecoder()

test('media-v2 deterministic record round-trip and framing', async () => {
  const key = await codec.importMediaV2Key(rawKey)
  const plaintext = encoder.encode('SyncUp deterministic media-v2 record').buffer
  const context = { attachmentId, mediaKind: 'video', recordIndex: 1, recordCount: 3, plaintextLength: plaintext.byteLength }
  const first = await codec.encryptMediaV2Record(key, context, plaintext, fixedIv)
  const second = await codec.encryptMediaV2Record(key, context, plaintext, fixedIv)
  assert.deepEqual(new Uint8Array(first), new Uint8Array(second))
  const decoded = codec.decodeMediaV2Record(first)
  assert.equal(decoded.context.recordIndex, 1)
  assert.equal(decoded.context.recordCount, 3)
  assert.equal(decoded.context.mediaKind, 'video')
  const opened = await codec.decryptMediaV2Record(key, attachmentId, first, { recordIndex: 1, recordCount: 3, mediaKind: 'video' })
  assert.equal(decoder.decode(opened), 'SyncUp deterministic media-v2 record')
})

test('media-v2 rejects ciphertext tampering', async () => {
  const key = await codec.importMediaV2Key(rawKey)
  const plaintext = encoder.encode('authenticated media').buffer
  const context = { attachmentId, mediaKind: 'voice', recordIndex: 0, recordCount: 1, plaintextLength: plaintext.byteLength }
  const record = new Uint8Array(await codec.encryptMediaV2Record(key, context, plaintext, fixedIv))
  record[record.length - 1] ^= 1
  await assert.rejects(() => codec.decryptMediaV2Record(key, attachmentId, record.buffer))
})

test('media-v2 rejects attachment substitution through AAD', async () => {
  const key = await codec.importMediaV2Key(rawKey)
  const plaintext = encoder.encode('bound attachment').buffer
  const context = { attachmentId, mediaKind: 'video', recordIndex: 0, recordCount: 1, plaintextLength: plaintext.byteLength }
  const record = await codec.encryptMediaV2Record(key, context, plaintext, fixedIv)
  await assert.rejects(() => codec.decryptMediaV2Record(key, '018f22f2-65d7-7c34-8f9a-7f47a665f9ae', record))
})

test('media-v2 rejects reordered records before decryption', async () => {
  const key = await codec.importMediaV2Key(rawKey)
  const plaintext = encoder.encode('record zero').buffer
  const context = { attachmentId, mediaKind: 'video', recordIndex: 0, recordCount: 2, plaintextLength: plaintext.byteLength }
  const record = await codec.encryptMediaV2Record(key, context, plaintext, fixedIv)
  await assert.rejects(
    () => codec.decryptMediaV2Record(key, attachmentId, record, { recordIndex: 1, recordCount: 2, mediaKind: 'video' }),
    /sequence mismatch/u,
  )
})

test('media-v2 rejects malformed framing', async () => {
  const key = await codec.importMediaV2Key(rawKey)
  const plaintext = encoder.encode('framed').buffer
  const context = { attachmentId, mediaKind: 'video', recordIndex: 0, recordCount: 1, plaintextLength: plaintext.byteLength }
  const record = new Uint8Array(await codec.encryptMediaV2Record(key, context, plaintext, fixedIv))
  record[0] = 0
  assert.throws(() => codec.decodeMediaV2Record(record.buffer), /magic/u)
})
