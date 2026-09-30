import type { MediaV2Kind } from './recordCodec'

const DB_NAME = 'syncup-media-v2'
const DB_VERSION = 1
const JOBS_STORE = 'upload-jobs'

export type MediaV2JobState =
  | 'queued'
  | 'preparing'
  | 'optimizing'
  | 'uploading'
  | 'paused_offline'
  | 'paused_user'
  | 'retrying'
  | 'finalizing'
  | 'failed_recoverable'
  | 'complete'
  | 'cancelled'

export type MediaV2UploadJob = {
  id: string
  attachmentId: string
  uploadSessionId: string
  chatId: string
  mediaKind: MediaV2Kind
  filename: string
  contentType: string
  durationMs?: number | null
  width?: number | null
  height?: number | null
  posterDataUrl?: string | null
  posterAttachmentId?: string | null
  sendOnComplete?: boolean
  messageIdempotencyKey?: string
  plaintextSize: number
  ciphertextSize: number
  chunkSize: number
  chunkCount: number
  acknowledgedBytes: number
  state: MediaV2JobState
  stagePath: string | null
  sourceFingerprint: string
  keyEnvelope?: string
  createdAt: number
  updatedAt: number
  lastError: string | null
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(JOBS_STORE)) {
        const store = database.createObjectStore(JOBS_STORE, { keyPath: 'id' })
        store.createIndex('attachmentId', 'attachmentId', { unique: true })
        store.createIndex('state', 'state')
        store.createIndex('updatedAt', 'updatedAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Unable to open media-v2 job store.'))
  })
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Media-v2 job store operation failed.'))
  })
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await openDatabase()
  try {
    const tx = database.transaction(JOBS_STORE, mode)
    const result = await requestResult(run(tx.objectStore(JOBS_STORE)))
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve()
      tx.onabort = () => reject(tx.error ?? new Error('Media-v2 job transaction aborted.'))
      tx.onerror = () => reject(tx.error ?? new Error('Media-v2 job transaction failed.'))
    })
    return result
  } finally {
    database.close()
  }
}

export async function putMediaV2Job(job: MediaV2UploadJob) {
  validateJob(job)
  await withStore('readwrite', (store) => store.put(job))
}

export async function getMediaV2Job(id: string) {
  return (await withStore<MediaV2UploadJob | undefined>('readonly', (store) => store.get(id))) ?? null
}

export async function getMediaV2JobByAttachment(attachmentId: string) {
  const database = await openDatabase()
  try {
    const tx = database.transaction(JOBS_STORE, 'readonly')
    const store = tx.objectStore(JOBS_STORE).index('attachmentId')
    return (await requestResult<MediaV2UploadJob | undefined>(store.get(attachmentId))) ?? null
  } finally {
    database.close()
  }
}

export async function listRecoverableMediaV2Jobs() {
  const jobs = await withStore<MediaV2UploadJob[]>('readonly', (store) => store.getAll())
  return jobs
    .filter((job) => job.state !== 'cancelled' && (job.state !== 'complete' || job.sendOnComplete))
    .sort((left, right) => left.createdAt - right.createdAt)
}

export async function patchMediaV2Job(id: string, patch: Partial<Omit<MediaV2UploadJob, 'id' | 'attachmentId' | 'createdAt'>>) {
  const current = await getMediaV2Job(id)
  if (!current) throw new Error('Media-v2 upload job not found.')
  const next: MediaV2UploadJob = { ...current, ...patch, id: current.id, attachmentId: current.attachmentId, createdAt: current.createdAt, updatedAt: Date.now() }
  validateJob(next)
  await putMediaV2Job(next)
  return next
}

export async function deleteMediaV2Job(id: string) {
  await withStore('readwrite', (store) => store.delete(id))
}

function validateJob(job: MediaV2UploadJob) {
  if (!job.id || !job.attachmentId || !job.uploadSessionId || !job.chatId) throw new Error('Media-v2 job identity is incomplete.')
  if (!Number.isSafeInteger(job.plaintextSize) || job.plaintextSize <= 0) throw new Error('Invalid media-v2 plaintext size.')
  if (!Number.isSafeInteger(job.ciphertextSize) || job.ciphertextSize <= 0) throw new Error('Invalid media-v2 ciphertext size.')
  if (!Number.isSafeInteger(job.chunkSize) || job.chunkSize <= 0 || !Number.isSafeInteger(job.chunkCount) || job.chunkCount <= 0) {
    throw new Error('Invalid media-v2 chunk manifest.')
  }
  if (!Number.isSafeInteger(job.acknowledgedBytes) || job.acknowledgedBytes < 0 || job.acknowledgedBytes > job.ciphertextSize) {
    throw new Error('Invalid media-v2 acknowledged byte count.')
  }
}
