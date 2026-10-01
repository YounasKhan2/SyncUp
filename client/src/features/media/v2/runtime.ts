import { pendingMediaV2Transport } from './pendingTransport'
import { MediaV2UploadManager } from './uploadManager'

export const mediaV2UploadManager = new MediaV2UploadManager(pendingMediaV2Transport)

let started = false

export function startMediaV2Runtime() {
  if (started) return
  started = true
  window.addEventListener('offline', mediaV2UploadManager.handleOffline)
  window.addEventListener('online', mediaV2UploadManager.handleOnline)
  void mediaV2UploadManager.initialize()
}

export function stopMediaV2Runtime() {
  if (!started) return
  started = false
  window.removeEventListener('offline', mediaV2UploadManager.handleOffline)
  window.removeEventListener('online', mediaV2UploadManager.handleOnline)
  mediaV2UploadManager.dispose()
}
