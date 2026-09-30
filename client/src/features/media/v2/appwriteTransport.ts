import { api } from '../../../shared/api'
import { openMediaV2Stage } from './staging'
import type { MediaV2Transport } from './uploadManager'

type RangeResponse = { acknowledgedBytes: number; complete: boolean }

async function uploadRange(path: string, bytes: Blob, start: number, total: number, signal: AbortSignal) {
  const end = start + bytes.size - 1
  const response = await fetch(path, {
    method: 'PUT',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${total}`,
    },
    body: bytes,
    signal,
  })
  if (response.status === 409) {
    const conflict = await response.json().catch(() => null) as { acknowledgedBytes?: number } | null
    if (Number.isSafeInteger(conflict?.acknowledgedBytes)) {
      return { acknowledgedBytes: conflict!.acknowledgedBytes!, complete: conflict!.acknowledgedBytes === total }
    }
  }
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(result?.error?.message ?? 'Encrypted media range upload failed.')
  }
  return response.json() as Promise<RangeResponse>
}

export const appwriteMediaV2Transport: MediaV2Transport = {
  async uploadNext(job, signal) {
    if (!job.stagePath) throw new Error('Encrypted media staging is unavailable.')
    const staged = await openMediaV2Stage(job.stagePath)
    if (staged.size !== job.ciphertextSize) {
      throw new Error('Staged encrypted media does not match the upload manifest.')
    }
    if (job.acknowledgedBytes >= job.ciphertextSize) {
      return { acknowledgedBytes: job.ciphertextSize, complete: true }
    }
    const endExclusive = Math.min(job.ciphertextSize, job.acknowledgedBytes + job.chunkSize)
    const range = staged.slice(job.acknowledgedBytes, endExclusive, 'application/octet-stream')
    return uploadRange(
      `/api/uploads/v2/${job.attachmentId}/range`,
      range,
      job.acknowledgedBytes,
      job.ciphertextSize,
      signal,
    )
  },

  async finalize(job, signal) {
    await api<void>(`/api/uploads/v2/${job.attachmentId}/finalize`, { method: 'POST', signal })
  },
}
