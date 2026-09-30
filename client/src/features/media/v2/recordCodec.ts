export const MEDIA_V2_ENCRYPTION_VERSION = 2
export const MEDIA_V2_IV_BYTES = 12
export const MEDIA_V2_TAG_BYTES = 16
export const MEDIA_V2_HEADER_BYTES = 36

export type MediaV2Kind = 'video' | 'voice'

export type MediaV2RecordContext = {
  attachmentId: string
  mediaKind: MediaV2Kind
  recordIndex: number
  recordCount: number
  plaintextLength: number
}

const encoder = new TextEncoder()
const magic = new Uint8Array([0x53, 0x55, 0x4d, 0x32]) // SUM2

function assertContext(context: MediaV2RecordContext) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(context.attachmentId)) {
    throw new Error('Invalid media-v2 attachment id.')
  }
  if (!Number.isSafeInteger(context.recordIndex) || context.recordIndex < 0) throw new Error('Invalid media-v2 record index.')
  if (!Number.isSafeInteger(context.recordCount) || context.recordCount <= 0 || context.recordIndex >= context.recordCount) {
    throw new Error('Invalid media-v2 record count.')
  }
  if (!Number.isSafeInteger(context.plaintextLength) || context.plaintextLength < 0 || context.plaintextLength > 0xffffffff) {
    throw new Error('Invalid media-v2 plaintext length.')
  }
}

export function mediaV2Aad(context: MediaV2RecordContext) {
  assertContext(context)
  return encoder.encode([
    'syncup-media-v2',
    context.attachmentId.toLowerCase(),
    context.mediaKind,
    String(context.recordIndex),
    String(context.recordCount),
    String(context.plaintextLength),
  ].join('|'))
}

export async function importMediaV2Key(rawKey: ArrayBuffer | Uint8Array, usages: KeyUsage[] = ['encrypt', 'decrypt']) {
  const bytes = rawKey instanceof Uint8Array ? rawKey : new Uint8Array(rawKey)
  if (bytes.byteLength !== 32) throw new Error('Media-v2 requires a 256-bit key.')
  return crypto.subtle.importKey('raw', bytes.slice().buffer, { name: 'AES-GCM' }, false, usages)
}

export function encodeMediaV2Record(context: MediaV2RecordContext, iv: Uint8Array, ciphertext: ArrayBuffer) {
  assertContext(context)
  if (iv.byteLength !== MEDIA_V2_IV_BYTES) throw new Error('Media-v2 requires a 96-bit IV.')
  if (ciphertext.byteLength !== context.plaintextLength + MEDIA_V2_TAG_BYTES) throw new Error('Invalid media-v2 ciphertext length.')
  const output = new Uint8Array(MEDIA_V2_HEADER_BYTES + ciphertext.byteLength)
  output.set(magic, 0)
  const view = new DataView(output.buffer)
  view.setUint8(4, MEDIA_V2_ENCRYPTION_VERSION)
  view.setUint8(5, context.mediaKind === 'video' ? 1 : 2)
  view.setUint16(6, 0)
  view.setUint32(8, context.recordIndex)
  view.setUint32(12, context.recordCount)
  view.setUint32(16, context.plaintextLength)
  view.setUint32(20, ciphertext.byteLength)
  output.set(iv, 24)
  output.set(new Uint8Array(ciphertext), MEDIA_V2_HEADER_BYTES)
  return output.buffer
}

export function decodeMediaV2Record(record: ArrayBuffer): { context: Omit<MediaV2RecordContext, 'attachmentId'>; iv: Uint8Array; ciphertext: ArrayBuffer } {
  if (record.byteLength < MEDIA_V2_HEADER_BYTES + MEDIA_V2_TAG_BYTES) throw new Error('Truncated media-v2 record.')
  const bytes = new Uint8Array(record)
  if (!magic.every((value, index) => bytes[index] === value)) throw new Error('Invalid media-v2 record magic.')
  const view = new DataView(record)
  if (view.getUint8(4) !== MEDIA_V2_ENCRYPTION_VERSION) throw new Error('Unsupported media-v2 encryption version.')
  const kindByte = view.getUint8(5)
  if (kindByte !== 1 && kindByte !== 2) throw new Error('Invalid media-v2 media kind.')
  if (view.getUint16(6) !== 0) throw new Error('Invalid media-v2 reserved header.')
  const recordIndex = view.getUint32(8)
  const recordCount = view.getUint32(12)
  const plaintextLength = view.getUint32(16)
  const ciphertextLength = view.getUint32(20)
  if (recordCount === 0 || recordIndex >= recordCount) throw new Error('Invalid media-v2 record ordering metadata.')
  if (ciphertextLength !== plaintextLength + MEDIA_V2_TAG_BYTES
    || MEDIA_V2_HEADER_BYTES + ciphertextLength !== record.byteLength) {
    throw new Error('Invalid media-v2 record length.')
  }
  return {
    context: {
      mediaKind: kindByte === 1 ? 'video' : 'voice',
      recordIndex,
      recordCount,
      plaintextLength,
    },
    iv: bytes.slice(24, 36),
    ciphertext: record.slice(MEDIA_V2_HEADER_BYTES),
  }
}

export async function encryptMediaV2Record(
  key: CryptoKey,
  context: MediaV2RecordContext,
  plaintext: ArrayBuffer,
  iv = crypto.getRandomValues(new Uint8Array(MEDIA_V2_IV_BYTES)),
) {
  if (plaintext.byteLength !== context.plaintextLength) throw new Error('Media-v2 plaintext length mismatch.')
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: mediaV2Aad(context), tagLength: 128 },
    key,
    plaintext,
  )
  return encodeMediaV2Record(context, iv, ciphertext)
}

export async function decryptMediaV2Record(
  key: CryptoKey,
  attachmentId: string,
  record: ArrayBuffer,
  expected?: { recordIndex: number; recordCount: number; mediaKind: MediaV2Kind },
) {
  const decoded = decodeMediaV2Record(record)
  if (expected && (decoded.context.recordIndex !== expected.recordIndex
    || decoded.context.recordCount !== expected.recordCount
    || decoded.context.mediaKind !== expected.mediaKind)) {
    throw new Error('Media-v2 record sequence mismatch.')
  }
  const context: MediaV2RecordContext = { attachmentId, ...decoded.context }
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decoded.iv.slice(), additionalData: mediaV2Aad(context), tagLength: 128 },
    key,
    decoded.ciphertext,
  )
}
