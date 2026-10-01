import type { KeyBundle, PublicMember } from '../../../shared/types'

export type EncryptedMessage = {
  bodyCiphertext: string
  bodyNonce: string
  keyEnvelopes: Record<string, string>
}

let unlockedPrivateKey: CryptoKey | null = null

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const vaultIterations = 310_000

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function fromBase64Url(value: string) {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4))
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function deriveVaultKey(password: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: vaultIterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function createKeyBundle(password: string): Promise<{ keyBundle: KeyBundle; privateKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt'],
  )
  const publicKey = await crypto.subtle.exportKey('jwk', pair.publicKey)
  const privateKeyBytes = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const wrappingKey = await deriveVaultKey(password, salt)
  const encryptedPrivateKey = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    privateKeyBytes,
  ))
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt'],
  )
  privateKeyBytes.fill(0)
  unlockedPrivateKey = privateKey
  return {
    privateKey,
    keyBundle: {
      publicKey,
      encryptedPrivateKey: toBase64Url(encryptedPrivateKey),
      privateKeyIv: toBase64Url(iv),
      vaultSalt: toBase64Url(salt),
    },
  }
}

export async function unlockKeyBundle(bundle: KeyBundle, password: string) {
  try {
    const wrappingKey = await deriveVaultKey(password, fromBase64Url(bundle.vaultSalt))
    const privateKeyBytes = new Uint8Array(await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64Url(bundle.privateKeyIv) },
      wrappingKey,
      fromBase64Url(bundle.encryptedPrivateKey),
    ))
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      privateKeyBytes,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['decrypt'],
    )
    privateKeyBytes.fill(0)
    unlockedPrivateKey = privateKey
    return true
  } catch {
    unlockedPrivateKey = null
    return false
  }
}

export function lockKeyBundle() {
  unlockedPrivateKey = null
}

export function isKeyBundleUnlocked() {
  return unlockedPrivateKey !== null
}

export async function encryptMessage(text: string, members: PublicMember[]): Promise<EncryptedMessage> {
  if (!unlockedPrivateKey) throw new Error('Unlock your encryption key before sending messages.')
  if (members.length < 2 || members.length > 32) throw new Error('Encrypted chats support 2–32 members.')
  const contentKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const rawContentKey = new Uint8Array(await crypto.subtle.exportKey('raw', contentKey))
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    contentKey,
    encoder.encode(text),
  ))
  const keyEnvelopes: Record<string, string> = {}
  for (const member of members) {
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      member.publicKey,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt'],
    )
    const wrappedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawContentKey)
    keyEnvelopes[member.id] = toBase64Url(new Uint8Array(wrappedKey))
  }
  rawContentKey.fill(0)
  return {
    bodyCiphertext: toBase64Url(ciphertext),
    bodyNonce: toBase64Url(nonce),
    keyEnvelopes,
  }
}

export async function wrapMediaKeyForMembers(rawMediaKey: Uint8Array, members: PublicMember[]) {
  if (!unlockedPrivateKey) throw new Error('Unlock your encryption key before preparing media.')
  if (rawMediaKey.byteLength !== 32) throw new Error('Media-v2 requires a 256-bit key.')
  if (members.length < 2 || members.length > 32) throw new Error('Encrypted media supports 2–32 chat members.')
  const keyEnvelopes: Record<string, string> = {}
  for (const member of members) {
    const publicKey = await crypto.subtle.importKey('jwk', member.publicKey, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt'])
    const wrappedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawMediaKey)
    keyEnvelopes[member.id] = toBase64Url(new Uint8Array(wrappedKey))
  }
  return keyEnvelopes
}

export async function encryptAttachment(file: File, members: PublicMember[]) {
  if (!unlockedPrivateKey) throw new Error('Unlock your encryption key before uploading files.')
  if (members.length < 2 || members.length > 32) throw new Error('Encrypted attachments support 2–32 chat members.')
  const contentKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const rawContentKey = new Uint8Array(await crypto.subtle.exportKey('raw', contentKey))
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    contentKey,
    await file.arrayBuffer(),
  )
  const keyEnvelopes: Record<string, string> = {}
  for (const member of members) {
    const publicKey = await crypto.subtle.importKey(
      'jwk',
      member.publicKey,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt'],
    )
    const wrappedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawContentKey)
    keyEnvelopes[member.id] = toBase64Url(new Uint8Array(wrappedKey))
  }
  rawContentKey.fill(0)
  return { ciphertext, nonce: toBase64Url(nonce), keyEnvelopes }
}

export async function decryptAttachment(ciphertext: ArrayBuffer, nonce: string, keyEnvelope: string) {
  if (!unlockedPrivateKey) throw new Error('Unlock your encryption key to open attachments.')
  const rawContentKey = new Uint8Array(await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    unlockedPrivateKey,
    fromBase64Url(keyEnvelope),
  ))
  const contentKey = await crypto.subtle.importKey('raw', rawContentKey, { name: 'AES-GCM' }, false, ['decrypt'])
  rawContentKey.fill(0)
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64Url(nonce) }, contentKey, ciphertext)
}

export async function decryptMessage(
  message: Pick<EncryptedMessage, 'bodyCiphertext' | 'bodyNonce'> & { keyEnvelope?: string | null },
) {
  if (!unlockedPrivateKey) throw new Error('Unlock your encryption key to read messages.')
  if (!message.keyEnvelope) throw new Error('This message was not encrypted for this device identity.')
  const rawContentKey = new Uint8Array(await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    unlockedPrivateKey,
    fromBase64Url(message.keyEnvelope),
  ))
  const contentKey = await crypto.subtle.importKey(
    'raw',
    rawContentKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  )
  rawContentKey.fill(0)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(message.bodyNonce) },
    contentKey,
    fromBase64Url(message.bodyCiphertext),
  )
  return decoder.decode(plaintext)
}
