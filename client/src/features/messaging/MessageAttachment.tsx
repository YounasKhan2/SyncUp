import { useEffect, useRef, useState } from 'react'
import { Download, FileText, Image as ImageIcon, Play, RefreshCw, Video } from 'lucide-react'
import type { StagedAttachment } from '../../shared/types'
import { formatFileSize } from '../../shared/utils/format'
import { downloadAttachment, hydrateAttachment } from '../media/mediaHydrator'

export function MessageAttachment({ attachment, pending = false, onOpen }: {
  attachment: StagedAttachment
  pending?: boolean
  onOpen?: () => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [visible, setVisible] = useState(pending)
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState('')
  const isImage = attachment.content_type.startsWith('image/')
  const isVideo = attachment.content_type.startsWith('video/')
  const isVisualMedia = isImage || isVideo

  useEffect(() => {
    if (!isVisualMedia || pending || visible) return
    const element = hostRef.current
    if (!element || !('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: '600px 0px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [isVisualMedia, pending, visible])

  useEffect(() => {
    if (pending || !isVisualMedia || !visible || !attachment.key_envelope) return
    let cancelled = false
    let objectUrl = ''
    setError('')
    hydrateAttachment(attachment)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setPreviewUrl(objectUrl)
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to open this media.')
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachment, attempt, isVisualMedia, pending, visible])

  return (
    <div className="message-attachment" ref={hostRef}>
      {isImage && previewUrl && (
        <button type="button" className="attachment-image-button" onClick={onOpen} aria-label={`Open ${attachment.filename}`}>
          <img src={previewUrl} alt={attachment.filename} />
        </button>
      )}
      {isVideo && previewUrl && (
        <button type="button" className="attachment-video-button" onClick={onOpen} aria-label={`Play ${attachment.filename}`}>
          <video src={previewUrl} preload="metadata" muted playsInline />
          <span className="attachment-video-play"><Play size={18} fill="currentColor" aria-hidden="true" /></span>
          <small><Video size={11} aria-hidden="true" /> {formatFileSize(attachment.size_bytes)} · encrypted</small>
        </button>
      )}
      {isVisualMedia && !previewUrl && !error && (
        <div className="attachment-image-skeleton" aria-label={pending ? 'Sending encrypted media' : 'Loading encrypted media'}>
          {isVideo ? <Video size={16} aria-hidden="true" /> : <ImageIcon size={16} aria-hidden="true" />}
          <span>{pending ? `Sending ${isVideo ? 'video' : 'image'}…` : `Decrypting ${isVideo ? 'video' : 'image'}…`}</span>
        </div>
      )}
      {isVisualMedia && error && (
        <button type="button" className="attachment-image-error" onClick={() => setAttempt((value) => value + 1)}>
          <RefreshCw size={13} aria-hidden="true" /><span>Retry {isVideo ? 'video' : 'image'}</span>
        </button>
      )}
      {!isVisualMedia && (
        <button type="button" className="attachment-file-button" onClick={() => void downloadAttachment(attachment).catch((downloadError: unknown) => setError(downloadError instanceof Error ? downloadError.message : 'Unable to download this file.'))} disabled={pending}>
          <Download size={14} aria-hidden="true" /><FileText size={14} aria-hidden="true" /><span><strong>{attachment.filename}</strong><small>{formatFileSize(attachment.size_bytes)} · encrypted</small></span>
        </button>
      )}
      {error && !isVisualMedia && <small className="attachment-error" role="alert">{error}</small>}
    </div>
  )
}
