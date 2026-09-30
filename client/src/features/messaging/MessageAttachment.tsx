import { useEffect, useRef, useState } from 'react'
import { Download, FileText, Image as ImageIcon, Pause, Play, RefreshCw, Video } from 'lucide-react'
import type { StagedAttachment } from '../../shared/types'
import { formatFileSize } from '../../shared/utils/format'
import { downloadAttachment, hydrateAttachment } from '../media/mediaHydrator'
import { hydrateMediaV2 } from '../media/v2/mediaHydratorV2'

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
  const [voiceUrl, setVoiceUrl] = useState('')
  const [voiceLoading, setVoiceLoading] = useState(false)
  const [voicePlaying, setVoicePlaying] = useState(false)
  const [voiceReady, setVoiceReady] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const isImage = attachment.content_type.startsWith('image/')
  const isVideo = attachment.content_type.startsWith('video/')
  const isVoice = attachment.content_type.startsWith('audio/')
  const isVisualMedia = isImage || isVideo
  const isMediaV2 = attachment.transport_version === 2

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
    if (pending || isMediaV2 || !isVisualMedia || !visible || !attachment.key_envelope) return
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
  }, [attachment, attempt, isMediaV2, isVisualMedia, pending, visible])

  useEffect(() => {
    if (!isMediaV2 || !isVoice || pending || voiceUrl || voiceLoading) return
    let cancelled = false
    let objectUrl = ''
    setVoiceLoading(true)
    setError('')
    hydrateMediaV2(attachment)
      .then((file) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(file)
        setVoiceUrl(objectUrl)
        setVoiceReady(true)
      })
      .catch(() => { if (!cancelled) setError('Couldn’t load this voice note.') })
      .finally(() => { if (!cancelled) setVoiceLoading(false) })
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [attachment, isMediaV2, isVoice, pending, voiceLoading, voiceUrl])

  async function toggleVoice() {
    if (pending || !voiceReady || !voiceUrl) return
    setError('')
    try {
      const url = voiceUrl
      const audio = audioRef.current
      if (!audio) return
      if (audio.src !== url) audio.src = url
      if (audio.paused) await audio.play()
      else audio.pause()
    } catch (voiceError) {
      setError(voiceError instanceof Error ? voiceError.message : 'Unable to play this voice note.')
    } finally {
      setVoiceLoading(false)
    }
  }

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
          <small><Video size={11} aria-hidden="true" /> {formatFileSize(attachment.size_bytes)}</small>
        </button>
      )}
      {isMediaV2 && isVideo && !previewUrl && !error && (
        <button type="button" className="attachment-v2-video-ready" onClick={onOpen} aria-label={`Open ${attachment.filename}`}>
          <span className="attachment-video-play"><Play size={18} fill="currentColor" aria-hidden="true" /></span>
          <strong>{attachment.filename}</strong><small>{formatFileSize(attachment.size_bytes)}</small>
        </button>
      )}
      {isVisualMedia && !isMediaV2 && !previewUrl && !error && (
        <div className="attachment-image-skeleton" aria-label={pending ? 'Sending media' : 'Loading media'}>
          {isVideo ? <Video size={16} aria-hidden="true" /> : <ImageIcon size={16} aria-hidden="true" />}
          <span>{pending ? `Sending ${isVideo ? 'video' : 'image'}…` : `Loading ${isVideo ? 'video' : 'image'}…`}</span>
        </div>
      )}
      {isVisualMedia && error && (
        <button type="button" className="attachment-image-error" onClick={() => setAttempt((value) => value + 1)}>
          <RefreshCw size={13} aria-hidden="true" /><span>Retry {isVideo ? 'video' : 'image'}</span>
        </button>
      )}
      {isMediaV2 && isVoice && <div className="voice-message"><button type="button" onClick={() => void toggleVoice()} disabled={pending || voiceLoading || !voiceReady} aria-label={voicePlaying ? 'Pause voice note' : 'Play voice note'}>{voicePlaying ? <Pause size={14}/> : <Play size={14}/>}</button><audio ref={audioRef} onPlay={() => setVoicePlaying(true)} onPause={() => setVoicePlaying(false)} onEnded={() => setVoicePlaying(false)}/><div className="voice-message-wave">{Array.from({ length: 28 }, (_, index) => <i key={index} style={{ height: `${4 + ((index * 7) % 13)}px` }}/>)}</div><small>{voiceLoading ? 'Loading…' : error ? 'Couldn’t load · Retry later' : 'Voice note'}</small></div>}
      {!isVisualMedia && !isVoice && (
        <button type="button" className="attachment-file-button" onClick={() => void downloadAttachment(attachment).catch((downloadError: unknown) => setError(downloadError instanceof Error ? downloadError.message : 'Unable to download this file.'))} disabled={pending}>
          <Download size={14} aria-hidden="true" /><FileText size={14} aria-hidden="true" /><span><strong>{attachment.filename}</strong><small>{formatFileSize(attachment.size_bytes)}</small></span>
        </button>
      )}
      {error && !isVisualMedia && <small className="attachment-error" role="alert">{error}</small>}
    </div>
  )
}
