const MAX_LOCAL_MEDIA = 4
const sources = new Map<string, File>()

export function rememberLocalMediaV2Source(attachmentId: string, file: File) {
  sources.delete(attachmentId)
  sources.set(attachmentId, file)
  while (sources.size > MAX_LOCAL_MEDIA) {
    const oldest = sources.keys().next().value
    if (!oldest) break
    sources.delete(oldest)
  }
}

export function getLocalMediaV2Source(attachmentId: string) {
  const file = sources.get(attachmentId)
  if (!file) return null
  sources.delete(attachmentId)
  sources.set(attachmentId, file)
  return file
}
