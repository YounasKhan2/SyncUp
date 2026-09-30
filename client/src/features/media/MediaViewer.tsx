import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Download, Minus, Plus, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { StagedAttachment } from '../../shared/types'
import { downloadAttachment, hydrateAttachment } from './mediaHydrator'

export type MediaViewerItem = {
  attachment: StagedAttachment
  senderName: string
  createdAt: string
}

export function MediaViewer({ items, activeId, onClose, onChange }: {
  items: MediaViewerItem[]
  activeId: string
  onClose: () => void
  onChange: (id: string) => void
}) {
  const activeIndex = Math.max(0, items.findIndex((item) => item.attachment.id === activeId))
  const active = items[activeIndex]
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(1)
  const [retry, setRetry] = useState(0)

  const previous = useMemo(() => items[activeIndex - 1], [activeIndex, items])
  const next = useMemo(() => items[activeIndex + 1], [activeIndex, items])

  useEffect(() => {
    if (!active) return
    let cancelled = false
    let objectUrl = ''
    setUrl('')
    setError('')
    setZoom(1)
    hydrateAttachment(active.attachment)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to open this image.')
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [active, retry])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft' && previous) onChange(previous.attachment.id)
      if (event.key === 'ArrowRight' && next) onChange(next.attachment.id)
      if (event.key === '+' || event.key === '=') setZoom((value) => Math.min(4, value + .25))
      if (event.key === '-') setZoom((value) => Math.max(1, value - .25))
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [next, onChange, onClose, previous])

  if (!active) return null

  return createPortal(
    <div className="media-viewer" role="dialog" aria-modal="true" aria-label={active.attachment.filename}>
      <header className="media-viewer-header">
        <button type="button" onClick={onClose} aria-label="Close media viewer"><X size={20} /></button>
        <div><strong>{active.senderName}</strong><small>{new Date(active.createdAt).toLocaleString()}</small></div>
        <button type="button" onClick={() => void downloadAttachment(active.attachment)} aria-label="Download image"><Download size={18} /></button>
      </header>
      <div className="media-viewer-stage" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
        {previous && <button className="media-viewer-nav media-viewer-prev" type="button" onClick={() => onChange(previous.attachment.id)} aria-label="Previous image"><ChevronLeft size={30} /></button>}
        {url
          ? <div className="media-viewer-pan"><img src={url} alt={active.attachment.filename} style={{ transform: `scale(${zoom})` }} /></div>
          : error
            ? <div className="media-viewer-error"><p>{error}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></div>
            : <div className="media-viewer-loading" role="status"><span />Decrypting image…</div>}
        {next && <button className="media-viewer-nav media-viewer-next" type="button" onClick={() => onChange(next.attachment.id)} aria-label="Next image"><ChevronRight size={30} /></button>}
      </div>
      <footer className="media-viewer-footer">
        <button type="button" onClick={() => setZoom((value) => Math.max(1, value - .25))} disabled={zoom <= 1} aria-label="Zoom out"><Minus size={16} /></button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((value) => Math.min(4, value + .25))} disabled={zoom >= 4} aria-label="Zoom in"><Plus size={16} /></button>
        <div className="media-viewer-strip">
          {items.slice(Math.max(0, activeIndex - 4), activeIndex + 5).map((item) => (
            <button key={item.attachment.id} type="button" className={item.attachment.id === activeId ? 'active' : ''} onClick={() => onChange(item.attachment.id)} aria-label={item.attachment.filename}>
              <span>{item.attachment.filename}</span>
            </button>
          ))}
        </div>
      </footer>
    </div>,
    document.body,
  )
}
