/// <reference lib="webworker" />
import { decryptMediaV2Record, encryptMediaV2Record, importMediaV2Key, type MediaV2Kind } from './recordCodec'

type EncryptRequest = {
  id: string
  type: 'encrypt'
  rawKey: ArrayBuffer
  attachmentId: string
  mediaKind: MediaV2Kind
  recordIndex: number
  recordCount: number
  plaintext: ArrayBuffer
}

type DecryptRequest = {
  id: string
  type: 'decrypt'
  rawKey: ArrayBuffer
  attachmentId: string
  mediaKind: MediaV2Kind
  recordIndex: number
  recordCount: number
  record: ArrayBuffer
}

type Request = EncryptRequest | DecryptRequest

const scope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope

scope.onmessage = async (event: MessageEvent<Request>) => {
  const request = event.data
  try {
    const key = await importMediaV2Key(request.rawKey)
    if (request.type === 'encrypt') {
      const record = await encryptMediaV2Record(key, {
        attachmentId: request.attachmentId,
        mediaKind: request.mediaKind,
        recordIndex: request.recordIndex,
        recordCount: request.recordCount,
        plaintextLength: request.plaintext.byteLength,
      }, request.plaintext)
      scope.postMessage({ id: request.id, ok: true, record }, [record])
      return
    }
    const plaintext = await decryptMediaV2Record(key, request.attachmentId, request.record, {
      recordIndex: request.recordIndex,
      recordCount: request.recordCount,
      mediaKind: request.mediaKind,
    })
    scope.postMessage({ id: request.id, ok: true, plaintext }, [plaintext])
  } catch (error) {
    scope.postMessage({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : 'Media-v2 crypto failed.',
    })
  }
}
