import { api } from '../../../shared/api'
import { apiUpload } from '../../../shared/api'
import type { ChatMember, StagedAttachment } from '../../../shared/types'
import { encryptAttachment, wrapMediaKeyForMembers } from '../../auth/crypto/crypto'
import { MediaV2CryptoWorker } from './cryptoWorker'
import { putMediaV2Job, type MediaV2UploadJob } from './jobStore'
import { MEDIA_V2_VIDEO_MAX_BYTES } from './manifest'
import { rememberLocalMediaV2Source } from './localMediaCache'
import { MEDIA_V2_HEADER_BYTES, MEDIA_V2_TAG_BYTES } from './recordCodec'
import { createMediaV2StageWriter, fingerprintMediaV2Source, requestMediaV2Persistence } from './staging'
import { mediaV2UploadManager } from './runtime'
import { createVideoPoster, probeVideo } from './videoPreparation'

const MIB = 1024 * 1024
const RECORD_BYTES = 4 * MIB
const TRANSPORT_BYTES = 5 * MIB
type IntentResponse = { attachmentId: string; uploadSession: { id: string; chunkSize: number; chunkCount: number; totalCiphertextBytes: number; acknowledgedBytes: number } }

export async function prepareVideoV2(file: File, chatId: string, members: ChatMember[], currentUserId: string) {
  if (file.size <= 0) throw new Error('Choose a non-empty video.')
  if (file.size > MEDIA_V2_VIDEO_MAX_BYTES) throw new Error('Videos are limited to 2 GiB.')

  const probe = await probeVideo(file)
  const poster = await createVideoPoster(file)
  const posterFile = new File([poster], 'video-preview.jpg', { type: 'image/jpeg' })
  const encryptedPoster = await encryptAttachment(posterFile, members)
  const posterIntent = await api<{ attachmentId: string }>('/api/uploads/intent', {
    method: 'POST',
    body: JSON.stringify({
      chatId,
      filename: posterFile.name,
      contentType: posterFile.type,
      sizeBytes: posterFile.size,
      nonce: encryptedPoster.nonce,
      keyEnvelopes: encryptedPoster.keyEnvelopes,
    }),
  })
  await apiUpload(`/api/uploads/${posterIntent.attachmentId}/content`, encryptedPoster.ciphertext)
  await api<void>(`/api/uploads/${posterIntent.attachmentId}/complete`, { method: 'POST' })
  const previewAttachment: StagedAttachment = {
    id: posterIntent.attachmentId,
    filename: posterFile.name,
    content_type: posterFile.type,
    size_bytes: posterFile.size,
    nonce: encryptedPoster.nonce,
    key_envelope: encryptedPoster.keyEnvelopes[currentUserId],
    is_preview: true,
  }
  void requestMediaV2Persistence().catch(() => false)

  const attachmentId = crypto.randomUUID()
  const rawMediaKey = crypto.getRandomValues(new Uint8Array(32))
  const keyEnvelopes = await wrapMediaKeyForMembers(rawMediaKey, members)
  const recordCount = Math.ceil(file.size / RECORD_BYTES)
  const ciphertextSize = file.size + recordCount * (MEDIA_V2_HEADER_BYTES + MEDIA_V2_TAG_BYTES)
  const transportChunkCount = Math.ceil(ciphertextSize / TRANSPORT_BYTES)

  const intent = await api<IntentResponse>('/api/uploads/v2/intent', {
    method: 'POST',
    body: JSON.stringify({
      attachmentId, chatId, filename: file.name, contentType: file.type, mediaKind: 'video', mediaMode: 'original',
      posterAttachmentId: previewAttachment.id,
      plaintextSize: file.size, ciphertextSize, chunkSize: TRANSPORT_BYTES, chunkCount: transportChunkCount,
      encryptionVersion: 2, keyEnvelopes, durationMs: probe.durationMs, width: probe.width, height: probe.height,
    }),
  })
  if (intent.attachmentId !== attachmentId) throw new Error('Server returned an unexpected media attachment id.')

  const jobId = crypto.randomUUID()
  const writer = await createMediaV2StageWriter(jobId, ciphertextSize)
  const worker = new MediaV2CryptoWorker()
  try {
    for (let index = 0; index < recordCount; index += 1) {
      const start = index * RECORD_BYTES
      const plaintext = await file.slice(start, Math.min(file.size, start + RECORD_BYTES)).arrayBuffer()
      const record = await worker.encrypt({
        rawKey: rawMediaKey.slice().buffer,
        attachmentId,
        mediaKind: 'video',
        recordIndex: index,
        recordCount,
        plaintext,
      })
      await writer.write(record)
    }
    await writer.close()
  } catch (error) {
    await writer.abort()
    throw error
  } finally {
    worker.terminate()
    rawMediaKey.fill(0)
  }

  const now = Date.now()
  const job: MediaV2UploadJob = {
    id: jobId, attachmentId, uploadSessionId: intent.uploadSession.id, chatId, mediaKind: 'video',
    filename: file.name, contentType: file.type, plaintextSize: file.size, ciphertextSize,
    chunkSize: intent.uploadSession.chunkSize, chunkCount: intent.uploadSession.chunkCount,
    acknowledgedBytes: intent.uploadSession.acknowledgedBytes, state: 'queued', stagePath: writer.path,
    sourceFingerprint: await fingerprintMediaV2Source(file), keyEnvelope: keyEnvelopes[currentUserId],
    previewAttachment, createdAt: now, updatedAt: now, lastError: null,
  }
  await putMediaV2Job(job)
  rememberLocalMediaV2Source(attachmentId, file)
  await mediaV2UploadManager.track(job)
  return job
}
