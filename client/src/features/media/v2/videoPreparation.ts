export type VideoMode = 'standard' | 'hd' | 'original'
export type VideoProbe = { durationMs: number; width: number; height: number; sizeBytes: number; contentType: string; estimatedBitrate: number | null }
export type VideoPreparationPolicy = { mode: VideoMode; shouldTranscode: boolean; reason: string; targetMaxHeight: number | null; targetBitrate: number | null }

export async function probeVideo(file: File): Promise<VideoProbe> {
  if (!['video/mp4', 'video/webm'].includes(file.type)) throw new Error('Choose an MP4 or WebM video.')
  const url = URL.createObjectURL(file)
  try {
    const video = document.createElement('video')
    video.preload = 'metadata'; video.muted = true; video.src = url
    await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error('Unable to read this video.')) })
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.videoWidth <= 0 || video.videoHeight <= 0) throw new Error('Video metadata is invalid.')
    const durationMs = Math.round(video.duration * 1000)
    return { durationMs, width: video.videoWidth, height: video.videoHeight, sizeBytes: file.size, contentType: file.type, estimatedBitrate: Math.round((file.size * 8 * 1000) / durationMs) }
  } finally { URL.revokeObjectURL(url) }
}

export function chooseVideoPolicy(probe: VideoProbe, mode: VideoMode): VideoPreparationPolicy {
  if (mode === 'original') return { mode, shouldTranscode: false, reason: 'Original preserves the exact source bytes.', targetMaxHeight: null, targetBitrate: null }
  const targetMaxHeight = mode === 'standard' ? 720 : 1080
  const targetBitrate = mode === 'standard' ? 2_500_000 : 5_000_000
  const alreadyEfficient = probe.height <= targetMaxHeight && (probe.estimatedBitrate ?? 0) <= targetBitrate * 1.15
  return { mode, shouldTranscode: !alreadyEfficient, reason: alreadyEfficient ? 'Source already fits the selected delivery profile.' : 'Source would benefit from optimization.', targetMaxHeight, targetBitrate }
}

export async function createVideoPoster(file: File, maxWidth = 640) {
  const url = URL.createObjectURL(file)
  try {
    const video = document.createElement('video')
    video.preload = 'auto'; video.muted = true; video.playsInline = true; video.src = url
    await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error('Unable to create a video preview.')) })
    video.currentTime = Math.min(Math.max(video.duration * 0.1, 0), Math.max(0, video.duration - 0.05))
    await new Promise<void>((resolve, reject) => { video.onseeked = () => resolve(); video.onerror = () => reject(new Error('Unable to seek video for preview.')) })
    const scale = Math.min(1, maxWidth / video.videoWidth)
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(video.videoWidth * scale)); canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
    const context = canvas.getContext('2d'); if (!context) throw new Error('Video preview rendering is unavailable.')
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Unable to encode video preview.')), 'image/jpeg', 0.82))
    return { blob, width: canvas.width, height: canvas.height }
  } finally { URL.revokeObjectURL(url) }
}
