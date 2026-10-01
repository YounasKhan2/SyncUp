export const MEDIA_V2_TRANSPORT_CHUNK_BYTES = 5 * 1024 * 1024
export const MEDIA_V2_RECORD_PLAINTEXT_BYTES = 4 * 1024 * 1024
export const MEDIA_V2_VIDEO_MAX_BYTES = 2 * 1024 * 1024 * 1024
export const MEDIA_V2_VOICE_MAX_BYTES = 256 * 1024 * 1024

export function mediaV2RecordCount(plaintextBytes: number) {
  if (!Number.isSafeInteger(plaintextBytes) || plaintextBytes <= 0) throw new Error('Invalid media size.')
  return Math.ceil(plaintextBytes / MEDIA_V2_RECORD_PLAINTEXT_BYTES)
}
export function mediaV2CiphertextSize(plaintextBytes: number, overheadBytes: number) {
  return plaintextBytes + mediaV2RecordCount(plaintextBytes) * overheadBytes
}
export function mediaV2TransportChunkCount(ciphertextBytes: number) {
  if (!Number.isSafeInteger(ciphertextBytes) || ciphertextBytes <= 0) throw new Error('Invalid media size.')
  return Math.ceil(ciphertextBytes / MEDIA_V2_TRANSPORT_CHUNK_BYTES)
}
export function mediaV2SourceLimit(kind: 'video'|'voice') {
  if (kind === 'voice') return MEDIA_V2_VOICE_MAX_BYTES
  return MEDIA_V2_VIDEO_MAX_BYTES
}
