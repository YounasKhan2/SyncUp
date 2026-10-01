const ROOT_DIRECTORY = 'syncup-media-v2'
const STAGING_DIRECTORY = 'staging'
const MIN_FREE_BYTES_AFTER_STAGE = 64 * 1024 * 1024

export type MediaV2StorageCapacity = {
  supported: boolean
  persisted: boolean
  usage: number | null
  quota: number | null
  available: number | null
}

function storageManager() {
  return navigator.storage
}

export async function inspectMediaV2Storage(): Promise<MediaV2StorageCapacity> {
  const manager = storageManager()
  if (!manager?.getDirectory) return { supported: false, persisted: false, usage: null, quota: null, available: null }
  const [estimate, persisted] = await Promise.all([
    manager.estimate().catch((): StorageEstimate => ({})),
    manager.persisted?.().catch(() => false) ?? Promise.resolve(false),
  ])
  const usage = estimate.usage ?? null
  const quota = estimate.quota ?? null
  return {
    supported: true,
    persisted,
    usage,
    quota,
    available: usage !== null && quota !== null ? Math.max(0, quota - usage) : null,
  }
}

export async function requestMediaV2Persistence() {
  const manager = storageManager()
  if (!manager?.persist) return false
  return manager.persist()
}

export async function assertMediaV2StageCapacity(requiredBytes: number) {
  if (!Number.isSafeInteger(requiredBytes) || requiredBytes <= 0) throw new Error('Invalid media-v2 staging size.')
  const capacity = await inspectMediaV2Storage()
  if (!capacity.supported) throw new Error('This browser does not support durable large-media staging.')
  if (capacity.available !== null && capacity.available < requiredBytes + MIN_FREE_BYTES_AFTER_STAGE) {
    throw new Error('Not enough browser storage is available to prepare this media.')
  }
  return capacity
}

async function stagingDirectory(create: boolean) {
  const root = await storageManager().getDirectory()
  const syncup = await root.getDirectoryHandle(ROOT_DIRECTORY, { create })
  return syncup.getDirectoryHandle(STAGING_DIRECTORY, { create })
}

function safeStageName(jobId: string) {
  if (!/^[0-9a-z_-]{8,128}$/iu.test(jobId)) throw new Error('Invalid media-v2 staging id.')
  return `${jobId}.bin`
}

export async function stageMediaV2Blob(jobId: string, source: Blob) {
  await assertMediaV2StageCapacity(source.size)
  const directory = await stagingDirectory(true)
  const handle = await directory.getFileHandle(safeStageName(jobId), { create: true })
  const writable = await handle.createWritable({ keepExistingData: false })
  try {
    await source.stream().pipeTo(writable)
  } catch (error) {
    await writable.abort().catch(() => undefined)
    await directory.removeEntry(safeStageName(jobId)).catch(() => undefined)
    throw error
  }
  const file = await handle.getFile()
  if (file.size !== source.size) {
    await directory.removeEntry(safeStageName(jobId)).catch(() => undefined)
    throw new Error('Media-v2 staging verification failed.')
  }
  return { path: safeStageName(jobId), size: file.size, lastModified: file.lastModified }
}

export async function openMediaV2Stage(stagePath: string) {
  const directory = await stagingDirectory(false)
  const handle = await directory.getFileHandle(stagePath)
  return handle.getFile()
}

export async function hasMediaV2Stage(stagePath: string | null) {
  if (!stagePath) return false
  try {
    await openMediaV2Stage(stagePath)
    return true
  } catch {
    return false
  }
}

export async function deleteMediaV2Stage(stagePath: string | null) {
  if (!stagePath) return
  try {
    const directory = await stagingDirectory(false)
    await directory.removeEntry(stagePath)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return
    throw error
  }
}

export async function fingerprintMediaV2Source(source: Blob & { name?: string; lastModified?: number }) {
  const sampleBytes = 64 * 1024
  const first = new Uint8Array(await source.slice(0, Math.min(sampleBytes, source.size)).arrayBuffer())
  const lastStart = Math.max(0, source.size - sampleBytes)
  const last = new Uint8Array(await source.slice(lastStart, source.size).arrayBuffer())
  const metadata = new TextEncoder().encode(`${source.name ?? ''}|${source.size}|${source.type}|${source.lastModified ?? 0}|`)
  const combined = new Uint8Array(metadata.byteLength + first.byteLength + last.byteLength)
  combined.set(metadata, 0)
  combined.set(first, metadata.byteLength)
  combined.set(last, metadata.byteLength + first.byteLength)
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', combined))
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function sourceMatchesMediaV2Fingerprint(
  source: Blob & { name?: string; lastModified?: number },
  expectedFingerprint: string,
) {
  return (await fingerprintMediaV2Source(source)) === expectedFingerprint
}

export async function createMediaV2StageWriter(jobId: string, expectedBytes: number) {
  await assertMediaV2StageCapacity(expectedBytes)
  const directory = await stagingDirectory(true)
  const path = safeStageName(jobId)
  const handle = await directory.getFileHandle(path, { create: true })
  const writable = await handle.createWritable({ keepExistingData: false })
  let written = 0
  let closed = false
  return {
    path,
    async write(bytes: ArrayBuffer) {
      if (closed) throw new Error('Media-v2 staging writer is closed.')
      await writable.write(new Uint8Array(bytes)); written += bytes.byteLength
      if (written > expectedBytes) throw new Error('Media-v2 staged ciphertext exceeded its manifest.')
    },
    async close() {
      if (closed) return
      closed = true; await writable.close()
      if (written !== expectedBytes) { await directory.removeEntry(path).catch(() => undefined); throw new Error('Media-v2 staged ciphertext does not match its manifest.') }
    },
    async abort() {
      if (closed) return
      closed = true; await writable.abort().catch(() => undefined); await directory.removeEntry(path).catch(() => undefined)
    },
  }
}
