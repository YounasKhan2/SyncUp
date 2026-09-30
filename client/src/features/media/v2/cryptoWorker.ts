import type { MediaV2Kind } from './recordCodec'

type WorkerResponse = { id: string; ok: boolean; record?: ArrayBuffer; plaintext?: ArrayBuffer; error?: string }
type Pending = { resolve: (value: ArrayBuffer) => void; reject: (reason?: unknown) => void }

export class MediaV2CryptoWorker {
  private readonly worker = new Worker(new URL('./mediaCrypto.worker.ts', import.meta.url), { type: 'module' })
  private readonly pending = new Map<string, Pending>()

  constructor() {
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const pending = this.pending.get(event.data.id)
      if (!pending) return
      this.pending.delete(event.data.id)
      if (!event.data.ok) {
        pending.reject(new Error(event.data.error ?? 'Media-v2 crypto failed.'))
        return
      }
      const result = event.data.record ?? event.data.plaintext
      if (!result) {
        pending.reject(new Error('Media-v2 worker returned no data.'))
        return
      }
      pending.resolve(result)
    }
    this.worker.onerror = () => {
      for (const pending of this.pending.values()) pending.reject(new Error('Media-v2 crypto worker crashed.'))
      this.pending.clear()
    }
  }

  encrypt(input: {
    rawKey: ArrayBuffer
    attachmentId: string
    mediaKind: MediaV2Kind
    recordIndex: number
    recordCount: number
    plaintext: ArrayBuffer
  }) {
    return this.request('encrypt', input, input.plaintext)
  }

  decrypt(input: {
    rawKey: ArrayBuffer
    attachmentId: string
    mediaKind: MediaV2Kind
    recordIndex: number
    recordCount: number
    record: ArrayBuffer
  }) {
    return this.request('decrypt', input, input.record)
  }

  terminate() {
    this.worker.terminate()
    for (const pending of this.pending.values()) pending.reject(new Error('Media-v2 crypto worker terminated.'))
    this.pending.clear()
  }

  private request(type: 'encrypt' | 'decrypt', input: object, transferable: ArrayBuffer) {
    const id = crypto.randomUUID()
    const rawKey = (input as { rawKey: ArrayBuffer }).rawKey
    return new Promise<ArrayBuffer>((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.worker.postMessage({ id, type, ...input }, [rawKey, transferable])
    })
  }
}
