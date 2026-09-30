import { api } from '../../../shared/api'
import {
  getMediaV2Job,
  listRecoverableMediaV2Jobs,
  patchMediaV2Job,
  type MediaV2JobState,
  type MediaV2UploadJob,
} from './jobStore'
import { hasMediaV2Stage } from './staging'

type UploadSessionResponse = {
  uploadSession: {
    id: string
    transportVersion: number
    chunkSize: number
    chunkCount: number
    totalCiphertextBytes: number
    acknowledgedBytes: number
    state: 'active' | 'finalizing' | 'completed' | 'cancelled' | 'expired'
    expiresAt: string
  }
}

export type MediaV2PublicStatus = 'sending' | 'sent' | 'failed'

export type MediaV2UploadSnapshot = {
  jobId: string
  attachmentId: string
  chatId: string
  status: MediaV2PublicStatus
  progress: number
  internalState: MediaV2JobState
  lastError: string | null
}

export type MediaV2Transport = {
  uploadNext(job: MediaV2UploadJob, signal: AbortSignal): Promise<{ acknowledgedBytes: number; complete: boolean }>
  finalize(job: MediaV2UploadJob, signal: AbortSignal): Promise<void>
}

type Listener = (snapshots: MediaV2UploadSnapshot[]) => void

const MAX_RETRY_ATTEMPTS = 5
const BASE_RETRY_MS = 1_000
const MAX_RETRY_MS = 30_000

function publicStatus(state: MediaV2JobState): MediaV2PublicStatus {
  if (state === 'complete') return 'sent'
  if (state === 'failed_recoverable' || state === 'cancelled') return 'failed'
  return 'sending'
}

function progress(job: MediaV2UploadJob) {
  if (job.state === 'complete') return 100
  if (job.ciphertextSize <= 0) return 0
  return Math.max(0, Math.min(99, Math.floor((job.acknowledgedBytes / job.ciphertextSize) * 100)))
}

function snapshot(job: MediaV2UploadJob): MediaV2UploadSnapshot {
  return {
    jobId: job.id,
    attachmentId: job.attachmentId,
    chatId: job.chatId,
    status: publicStatus(job.state),
    progress: progress(job),
    internalState: job.state,
    lastError: job.lastError,
  }
}

function retryDelay(attempt: number) {
  const exponential = Math.min(MAX_RETRY_MS, BASE_RETRY_MS * (2 ** Math.max(0, attempt - 1)))
  return exponential + Math.floor(Math.random() * Math.min(1_000, exponential / 4))
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      window.clearTimeout(timeout)
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}

export class MediaV2UploadManager {
  private readonly jobs = new Map<string, MediaV2UploadJob>()
  private readonly listeners = new Set<Listener>()
  private readonly running = new Map<string, AbortController>()
  private initialized = false

  constructor(private readonly transport: MediaV2Transport) {}

  async initialize() {
    if (this.initialized) return
    this.initialized = true
    const jobs = await listRecoverableMediaV2Jobs()
    for (const job of jobs) this.jobs.set(job.id, job)
    this.emit()
    await Promise.all(jobs.map((job) => this.recover(job)))
    if (navigator.onLine) this.resumeEligible()
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    listener(this.getSnapshots())
    return () => this.listeners.delete(listener)
  }

  getSnapshots() {
    return [...this.jobs.values()].sort((left, right) => left.createdAt - right.createdAt).map(snapshot)
  }

  async track(job: MediaV2UploadJob) {
    this.jobs.set(job.id, job)
    this.emit()
    if (navigator.onLine) this.start(job.id)
  }

  async pause(jobId: string) {
    this.running.get(jobId)?.abort()
    const job = await this.update(jobId, { state: 'paused_user', lastError: null })
    this.jobs.set(jobId, job)
    this.emit()
  }

  async resume(jobId: string) {
    const job = this.jobs.get(jobId) ?? await getMediaV2Job(jobId)
    if (!job || job.state === 'complete' || job.state === 'cancelled') return
    const sourceAvailable = await hasMediaV2Stage(job.stagePath)
    if (!sourceAvailable) {
      await this.failRecoverable(job.id, 'Select the original media again to resume this upload.')
      return
    }
    await this.update(job.id, { state: navigator.onLine ? 'queued' : 'paused_offline', lastError: null })
    if (navigator.onLine) this.start(job.id)
  }

  async cancel(jobId: string) {
    this.running.get(jobId)?.abort()
    const job = this.jobs.get(jobId)
    if (!job) return
    try {
      await api<void>(`/api/uploads/v2/${job.attachmentId}/session`, { method: 'DELETE' })
    } finally {
      const cancelled = await this.update(jobId, { state: 'cancelled', lastError: null })
      this.jobs.set(jobId, cancelled)
      this.emit()
    }
  }

  handleOffline = () => {
    for (const [jobId, controller] of this.running) {
      controller.abort()
      void this.update(jobId, { state: 'paused_offline' }).then((job) => {
        this.jobs.set(jobId, job)
        this.emit()
      })
    }
  }

  handleOnline = () => {
    this.resumeEligible()
  }

  dispose() {
    for (const controller of this.running.values()) controller.abort()
    this.running.clear()
    this.listeners.clear()
  }

  private async recover(job: MediaV2UploadJob) {
    if (!(await hasMediaV2Stage(job.stagePath))) {
      await this.failRecoverable(job.id, 'Select the original media again to resume this upload.')
      return
    }
    try {
      const { uploadSession } = await api<UploadSessionResponse>(`/api/uploads/v2/${job.attachmentId}/session`)
      if (uploadSession.id !== job.uploadSessionId
        || uploadSession.transportVersion !== 2
        || uploadSession.totalCiphertextBytes !== job.ciphertextSize
        || uploadSession.chunkSize !== job.chunkSize
        || uploadSession.chunkCount !== job.chunkCount) {
        await this.failRecoverable(job.id, 'Upload session metadata no longer matches this media.')
        return
      }
      if (uploadSession.state === 'completed') {
        const complete = await this.update(job.id, { state: 'complete', acknowledgedBytes: job.ciphertextSize, lastError: null })
        this.jobs.set(job.id, complete)
      } else if (uploadSession.state === 'cancelled' || uploadSession.state === 'expired') {
        await this.failRecoverable(job.id, 'This upload session expired. Retry the media send.')
      } else {
        const next = await this.update(job.id, {
          acknowledgedBytes: uploadSession.acknowledgedBytes,
          state: navigator.onLine ? 'queued' : 'paused_offline',
          lastError: null,
        })
        this.jobs.set(job.id, next)
      }
      this.emit()
    } catch (error) {
      await this.failRecoverable(job.id, error instanceof Error ? error.message : 'Unable to recover this upload.')
    }
  }

  private resumeEligible() {
    for (const job of this.jobs.values()) {
      if (job.state === 'queued' || job.state === 'paused_offline' || job.state === 'retrying' || job.state === 'uploading') {
        void this.update(job.id, { state: 'queued' }).then(() => this.start(job.id))
      }
    }
  }

  private start(jobId: string) {
    if (this.running.has(jobId) || !navigator.onLine) return
    const controller = new AbortController()
    this.running.set(jobId, controller)
    void this.run(jobId, controller.signal).finally(() => this.running.delete(jobId))
  }

  private async run(jobId: string, signal: AbortSignal) {
    let attempts = 0
    while (!signal.aborted) {
      let job = this.jobs.get(jobId) ?? await getMediaV2Job(jobId)
      if (!job || job.state === 'complete' || job.state === 'cancelled' || job.state === 'paused_user') return
      if (!navigator.onLine) {
        job = await this.update(jobId, { state: 'paused_offline' })
        this.jobs.set(jobId, job)
        this.emit()
        return
      }
      try {
        job = await this.update(jobId, { state: 'uploading', lastError: null })
        this.jobs.set(jobId, job)
        this.emit()
        const result = await this.transport.uploadNext(job, signal)
        if (!Number.isSafeInteger(result.acknowledgedBytes)
          || result.acknowledgedBytes < job.acknowledgedBytes
          || result.acknowledgedBytes > job.ciphertextSize) {
          throw new Error('Upload transport returned an invalid acknowledgement.')
        }
        job = await this.update(jobId, { acknowledgedBytes: result.acknowledgedBytes })
        this.jobs.set(jobId, job)
        this.emit()
        attempts = 0
        if (!result.complete) continue

        job = await this.update(jobId, { state: 'finalizing' })
        this.jobs.set(jobId, job)
        this.emit()
        await this.transport.finalize(job, signal)
        job = await this.update(jobId, { state: 'complete', acknowledgedBytes: job.ciphertextSize, lastError: null })
        this.jobs.set(jobId, job)
        this.emit()
        return
      } catch (error) {
        if (signal.aborted) return
        attempts += 1
        const message = error instanceof Error ? error.message : 'Upload failed.'
        if (attempts >= MAX_RETRY_ATTEMPTS) {
          await this.failRecoverable(jobId, message)
          return
        }
        const retrying = await this.update(jobId, { state: 'retrying', lastError: message })
        this.jobs.set(jobId, retrying)
        this.emit()
        await sleep(retryDelay(attempts), signal)
      }
    }
  }

  private async update(jobId: string, patch: Partial<MediaV2UploadJob>) {
    const next = await patchMediaV2Job(jobId, patch)
    this.jobs.set(jobId, next)
    return next
  }

  private async failRecoverable(jobId: string, message: string) {
    const failed = await this.update(jobId, { state: 'failed_recoverable', lastError: message })
    this.jobs.set(jobId, failed)
    this.emit()
  }

  private emit() {
    const snapshots = this.getSnapshots()
    for (const listener of this.listeners) listener(snapshots)
  }
}
