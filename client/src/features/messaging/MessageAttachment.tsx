import { useEffect, useState } from 'react'
import { Download, FileText, Image as ImageIcon } from 'lucide-react'
import { api } from '../../shared/api'
import { decryptAttachment } from '../auth/crypto/crypto'
import type { StagedAttachment } from '../../shared/types'
import { formatFileSize } from '../../shared/utils/format'
export function MessageAttachment({ attachment, pending = false }: {
  attachment: StagedAttachment
  pending?: boolean
}) {
  const [previewUrl, setPreviewUrl] = useState('')
  const [error, setError] = useState('')
  const isImage = attachment.content_type.startsWith('image/')

  useEffect(() => {
    if (pending || !isImage || !attachment.key_envelope) return
    let cancelled = false
    let objectUrl = ''
    api<{ attachment: { downloadUrl: string; nonce: string; keyEnvelope: string | null } }>(`/api/uploads/${attachment.id}`)
      .then(async ({ attachment: result }) => {
        const response = await fetch(result.downloadUrl)
        if (!response.ok) throw new Error('Unable to download this encrypted image.')
        const ciphertext = await response.arrayBuffer()
        const keyEnvelope = result.keyEnvelope ?? attachment.key_envelope
        if (!keyEnvelope) throw new Error('This file was not encrypted for your account.')
        const plaintext = await decryptAttachment(ciphertext, result.nonce, keyEnvelope)
        if (cancelled) return
        objectUrl = URL.createObjectURL(new Blob([plaintext], { type: attachment.content_type }))
        setPreviewUrl(objectUrl)
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Unable to open this image.')
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [attachment.content_type, attachment.id, attachment.key_envelope, isImage, pending])

  async function download() {
    setError('')
    try {
      const result = await api<{ attachment: { downloadUrl: string; nonce: string; keyEnvelope: string | null } }>(`/api/uploads/${attachment.id}`)
      const response = await fetch(result.attachment.downloadUrl)
      if (!response.ok) throw new Error('Unable to download this encrypted file.')
      const ciphertext = await response.arrayBuffer()
      const keyEnvelope = result.attachment.keyEnvelope ?? attachment.key_envelope
      if (!keyEnvelope) throw new Error('This file was not encrypted for your account.')
      const plaintext = await decryptAttachment(
        ciphertext,
        result.attachment.nonce,
        keyEnvelope,
      )
      const url = URL.createObjectURL(new Blob([plaintext], { type: attachment.content_type }))
      const link = document.createElement('a')
      link.href = url
      link.download = attachment.filename
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download this file.')
    }
  }

  return (
    <div className="message-attachment">
      {isImage && previewUrl
        ? <img src={previewUrl} alt={attachment.filename} loading="lazy" />
        : isImage && !pending
          ? <span className="attachment-preview-placeholder"><ImageIcon size={13} aria-hidden="true" /> Encrypted image · {formatFileSize(attachment.size_bytes)}</span>
          : null}
      {!isImage && (
        <button type="button" className="attachment-file-button" onClick={() => void download()} disabled={pending}>
          <Download size={14} aria-hidden="true" /><FileText size={14} aria-hidden="true" /><span><strong>{attachment.filename}</strong><small>{formatFileSize(attachment.size_bytes)} · encrypted</small></span>
        </button>
      )}
      {error && <small className="attachment-error" role="alert">{error}</small>}
    </div>
  )
}
