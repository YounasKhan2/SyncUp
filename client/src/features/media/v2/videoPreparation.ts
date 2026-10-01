export type VideoProbe = { durationMs: number; width: number; height: number }

export async function probeVideo(file: File): Promise<VideoProbe> {
  if (!['video/mp4', 'video/webm'].includes(file.type)) throw new Error('Choose an MP4 or WebM video.')
  const url = URL.createObjectURL(file)
  try {
    const video = document.createElement('video')
    video.preload = 'metadata'; video.muted = true; video.src = url
    await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error('Unable to read this video.')) })
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.videoWidth <= 0 || video.videoHeight <= 0) throw new Error('Video metadata is invalid.')
    const durationMs = Math.round(video.duration * 1000)
    return { durationMs, width: video.videoWidth, height: video.videoHeight }
  } finally { URL.revokeObjectURL(url) }
}

export async function createVideoPoster(file: File, maxWidth = 480) {
  const url = URL.createObjectURL(file)
  try {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.src = url
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('Unable to read this video preview.'))
    })
    video.currentTime = Math.min(video.duration * 0.1, Math.max(0, video.duration - 0.05))
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve()
      video.onerror = () => reject(new Error('Unable to create a video preview.'))
    })
    const scale = Math.min(1, maxWidth / video.videoWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Video preview rendering is unavailable.')
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Unable to encode a video preview.')),
        'image/jpeg',
        0.72,
      )
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}
