import { api } from '../../../shared/api'
import type { StagedAttachment } from '../../../shared/types'
import { unwrapMediaKey } from '../../auth/crypto/crypto'
import { MediaV2CryptoWorker } from './cryptoWorker'
import { MEDIA_V2_HEADER_BYTES, MEDIA_V2_TAG_BYTES } from './recordCodec'

const RECORD_PLAINTEXT_BYTES = 4 * 1024 * 1024
const RECORD_OVERHEAD_BYTES = MEDIA_V2_HEADER_BYTES + MEDIA_V2_TAG_BYTES
const ROOT = 'syncup-media-v2'
const PLAYBACK = 'playback'

const inFlight = new Map<string, Promise<File>>()

type Metadata = {
  filename: string
  contentType: string
  plaintextSize: number
  ciphertextSize: number
  mediaKind: 'video' | 'voice'
  keyEnvelope: string
  downloadUrl: string
}

async function playbackDirectory() {
  const root = await navigator.storage.getDirectory()
  const app = await root.getDirectoryHandle(ROOT, { create: true })
  return app.getDirectoryHandle(PLAYBACK, { create: true })
}

async function existingPlayback(id: string, expectedSize: number) {
  try {
    const directory = await playbackDirectory()
    const handle = await directory.getFileHandle(`${id}.bin`)
    const file = await handle.getFile()
    return file.size === expectedSize ? file : null
  } catch {
    return null
  }
}

async function hydrateMediaV2Internal(
  attachment: StagedAttachment,
  onProgress?: (progress: number) => void,
  signal?: AbortSignal,
): Promise<File> {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError')
  if (!navigator.storage?.getDirectory) throw new Error(attachment.content_type.startsWith('audio/') ? 'This browser cannot open voice notes yet.' : 'This browser cannot open large videos yet.')
  const { attachment: metadata } = await api<{ attachment: Metadata }>(`/api/uploads/v2/${attachment.id}`)
  const cached = await existingPlayback(attachment.id, metadata.plaintextSize)
  if (cached) { onProgress?.(100); return cached }

  const estimate = await navigator.storage.estimate?.().catch(() => null)
  if (estimate?.quota !== undefined && estimate.usage !== undefined && estimate.quota - estimate.usage < metadata.plaintextSize + 64 * 1024 * 1024) throw new Error('Not enough device storage to open this media.')
  const rawKey = await unwrapMediaKey(metadata.keyEnvelope)
  const worker = new MediaV2CryptoWorker()
  const directory = await playbackDirectory()
  const handle = await directory.getFileHandle(`${attachment.id}.bin`, { create: true })
  const writable = await handle.createWritable({ keepExistingData: false })
  const recordCount = Math.ceil(metadata.plaintextSize / RECORD_PLAINTEXT_BYTES)
  let cipherOffset = 0
  let written = 0
  try {
    for (let index = 0; index < recordCount; index += 1) {
      const plainLength = Math.min(RECORD_PLAINTEXT_BYTES, metadata.plaintextSize - written)
      const recordLength = plainLength + RECORD_OVERHEAD_BYTES
      if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError')
      const response = await fetch(metadata.downloadUrl, {
        signal,
        credentials: 'same-origin',
        headers: { Range: `bytes=${cipherOffset}-${cipherOffset + recordLength - 1}` },
      })
      if (response.status !== 206) throw new Error(metadata.mediaKind === 'voice' ? 'Couldn’t load this voice note.' : 'Couldn’t load this video.')
      const record = await response.arrayBuffer()
      if (record.byteLength !== recordLength) throw new Error(metadata.mediaKind === 'voice' ? 'Couldn’t load this voice note.' : 'Couldn’t load this video.')
      const plaintext = await worker.decrypt({
        rawKey: rawKey.slice().buffer,
        attachmentId: attachment.id,
        mediaKind: metadata.mediaKind,
        recordIndex: index,
        recordCount,
        record,
      })
      await writable.write(new Uint8Array(plaintext))
      written += plaintext.byteLength
      cipherOffset += recordLength
      onProgress?.(Math.min(99, Math.floor((written / metadata.plaintextSize) * 100)))
    }
    await writable.close()
    if (written !== metadata.plaintextSize || cipherOffset !== metadata.ciphertextSize) throw new Error(metadata.mediaKind === 'voice' ? 'Couldn’t finish loading this voice note.' : 'Couldn’t finish loading this video.')
    const file = await handle.getFile()
    onProgress?.(100)
    return new File([file], metadata.filename, { type: metadata.contentType, lastModified: file.lastModified })
  } catch (error) {
    await writable.abort().catch(() => undefined)
    await directory.removeEntry(`${attachment.id}.bin`).catch(() => undefined)
    throw error
  } finally {
    rawKey.fill(0)
    worker.terminate()
  }
}

export async function downloadMediaV2(attachment: StagedAttachment, onProgress?: (progress: number) => void, signal?: AbortSignal) {
  const file = await hydrateMediaV2(attachment, onProgress, signal)
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = attachment.filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}


export function hydrateMediaV2(attachment: StagedAttachment,onProgress?: (progress:number)=>void,signal?:AbortSignal):Promise<File>{
 const existing=inFlight.get(attachment.id);if(existing)return existing
 const work=hydrateMediaV2Internal(attachment,onProgress,signal).finally(()=>inFlight.delete(attachment.id))
 inFlight.set(attachment.id,work);return work
}
