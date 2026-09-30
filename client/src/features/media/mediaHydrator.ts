import { api } from '../../shared/api'
import type { StagedAttachment } from '../../shared/types'
import { decryptAttachment } from '../auth/crypto/crypto'
import { cacheCiphertext, getCachedCiphertext } from './mediaCache'

type AttachmentMetadata = {
  downloadUrl: string
  nonce: string
  keyEnvelope: string | null
}

const plaintextMemoryCache = new Map<string, Blob>()
const inFlight = new Map<string, Promise<Blob>>()

export async function hydrateAttachment(attachment: StagedAttachment): Promise<Blob> {
  const cachedPlaintext = plaintextMemoryCache.get(attachment.id)
  if (cachedPlaintext) return cachedPlaintext

  const existing = inFlight.get(attachment.id)
  if (existing) return existing

  const work = (async () => {
    const { attachment: metadata } = await api<{ attachment: AttachmentMetadata }>(`/api/uploads/${attachment.id}`)
    let ciphertext = await getCachedCiphertext(attachment.id).catch(() => null)
    if (!ciphertext) {
      const response = await fetch(metadata.downloadUrl, { credentials: 'same-origin' })
      if (!response.ok) throw new Error('Unable to load this encrypted media.')
      ciphertext = await response.arrayBuffer()
      await cacheCiphertext(attachment.id, ciphertext).catch(() => undefined)
    }

    const keyEnvelope = metadata.keyEnvelope ?? attachment.key_envelope
    if (!keyEnvelope) throw new Error('This media was not encrypted for your account.')
    const plaintext = await decryptAttachment(ciphertext, metadata.nonce, keyEnvelope)
    const blob = new Blob([plaintext], { type: attachment.content_type })
    plaintextMemoryCache.set(attachment.id, blob)
    return blob
  })().finally(() => inFlight.delete(attachment.id))

  inFlight.set(attachment.id, work)
  return work
}

export async function downloadAttachment(attachment: StagedAttachment) {
  const blob = await hydrateAttachment(attachment)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = attachment.filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
