import { api } from '../../../shared/api'
import type { ChatMember } from '../../../shared/types'
import { wrapMediaKeyForMembers } from '../../auth/crypto/crypto'
import { MediaV2CryptoWorker } from './cryptoWorker'
import { putMediaV2Job, type MediaV2UploadJob } from './jobStore'
import { MEDIA_V2_HEADER_BYTES, MEDIA_V2_TAG_BYTES } from './recordCodec'
import { createMediaV2StageWriter, fingerprintMediaV2Source, requestMediaV2Persistence } from './staging'
import { mediaV2UploadManager } from './runtime'
import { chooseVideoPolicy, createVideoPoster, probeVideo, type VideoMode } from './videoPreparation'

const MIB = 1024 * 1024
const RECORD_BYTES = 4 * MIB
const TRANSPORT_BYTES = 5 * MIB
const STANDARD_HD_LIMIT = 1024 * MIB
const ORIGINAL_LIMIT = 2 * 1024 * MIB

type IntentResponse = { attachmentId: string; uploadSession: { id: string; chunkSize: number; chunkCount: number; totalCiphertextBytes: number; acknowledgedBytes: number } }

export async function prepareVideoV2(file: File, chatId: string, members: ChatMember[], mode: VideoMode) {
  if (file.size <= 0) throw new Error('Choose a non-empty video.')
  const limit = mode === 'original' ? ORIGINAL_LIMIT : STANDARD_HD_LIMIT
  if (file.size > limit) throw new Error(mode === 'original' ? 'Original video is limited to 2 GiB.' : 'Standard and HD video are limited to 1 GiB.')

  const probe = await probeVideo(file)
  const policy = chooseVideoPolicy(probe, mode)
  const poster = await createVideoPoster(file)
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
      attachmentId, chatId, filename: file.name, contentType: file.type, mediaKind: 'video', mediaMode: mode,
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
    sourceFingerprint: await fingerprintMediaV2Source(file), createdAt: now, updatedAt: now, lastError: null,
  }
  await putMediaV2Job(job)
  await mediaV2UploadManager.track(job)
  return {
    job, poster, probe, policy,
    optimizationDeferred: policy.shouldTranscode,
    keyEnvelopes,
  }
}
