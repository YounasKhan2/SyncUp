import test from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { load } from './helpers/foundation-harness.mjs'

// Actual production crypto with Node WebCrypto, not substituted key/encryption
// functions. Synthetic identities only; no secrets are logged or persisted.
const identity = () => load('client/src/features/auth/crypto/crypto.ts', {}, {
  crypto: webcrypto, TextEncoder, TextDecoder, atob, btoa,
})
const tamper = value => { const bytes = Buffer.from(value, 'base64url'); bytes[0] ^= 1; return bytes.toString('base64url') }

test('Final production vault/message/attachment/media-key crypto roundtrips and rejects tampering, wrong identity and locked access', async () => {
  const alice = identity(), bob = identity()
  const a = await alice.createKeyBundle('synthetic-alice-password'), b = await bob.createKeyBundle('synthetic-bob-password')
  const members = [{ id: 'alice', publicKey: a.keyBundle.publicKey }, { id: 'bob', publicKey: b.keyBundle.publicKey }]
  bob.lockKeyBundle(); assert.equal(bob.isKeyBundleUnlocked(), false)
  assert.equal(await bob.unlockKeyBundle(b.keyBundle, 'incorrect-synthetic-password'), false)
  assert.equal(bob.isKeyBundleUnlocked(), false)
  assert.equal(await bob.unlockKeyBundle({ ...b.keyBundle, encryptedPrivateKey: tamper(b.keyBundle.encryptedPrivateKey) }, 'synthetic-bob-password'), false)
  assert.equal(await bob.unlockKeyBundle(b.keyBundle, 'synthetic-bob-password'), true)
  const encrypted = await alice.encryptMessage('Synthetic Unicode reply ✨', members)
  assert.deepEqual(Object.keys(encrypted.keyEnvelopes), ['alice', 'bob'])
  const envelope = { bodyCiphertext: encrypted.bodyCiphertext, bodyNonce: encrypted.bodyNonce, keyEnvelope: encrypted.keyEnvelopes.bob }
  assert.equal(await bob.decryptMessage(envelope), 'Synthetic Unicode reply ✨')
  await assert.rejects(bob.decryptMessage({ ...envelope, bodyCiphertext: tamper(envelope.bodyCiphertext) }))
  await assert.rejects(bob.decryptMessage({ ...envelope, bodyNonce: tamper(envelope.bodyNonce) }))
  await assert.rejects(alice.decryptMessage(envelope))
  await assert.rejects(bob.decryptMessage({ ...envelope, keyEnvelope: null }), /not encrypted for this device identity/)
  const file = new File(['Synthetic attachment'], 'fixture.txt', { type: 'text/plain' })
  const attachment = await alice.encryptAttachment(file, members)
  assert.equal(new TextDecoder().decode(await bob.decryptAttachment(attachment.ciphertext, attachment.nonce, attachment.keyEnvelopes.bob)), 'Synthetic attachment')
  const broken = new Uint8Array(attachment.ciphertext.slice(0)); broken[0] ^= 1
  await assert.rejects(bob.decryptAttachment(broken.buffer, attachment.nonce, attachment.keyEnvelopes.bob))
  const mediaKey = new Uint8Array(32).fill(9), wrapped = await alice.wrapMediaKeyForMembers(mediaKey, members)
  assert.deepEqual(Array.from(await bob.unwrapMediaKey(wrapped.bob)), Array.from(mediaKey))
  await assert.rejects(alice.wrapMediaKeyForMembers(new Uint8Array(31), members), /256-bit/)
  bob.lockKeyBundle(); await assert.rejects(bob.decryptMessage(envelope), /Unlock your encryption key/)
  alice.lockKeyBundle(); await assert.rejects(alice.encryptMessage('locked', members), /Unlock your encryption key/)
})
