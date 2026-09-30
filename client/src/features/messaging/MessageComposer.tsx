import type { FormEvent } from 'react'
import { LockKeyhole, Paperclip, Send, X } from 'lucide-react'
import type { DisplayMessage, StagedAttachment } from '../../shared/types'

type MessageComposerProps = {
  draft: string
  replyTo: DisplayMessage | null
  editing: boolean
  replyAuthor: string
  attachments: StagedAttachment[]
  uploading: boolean
  submitting: boolean
  chatTitle: string
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onDraftChange: (draft: string) => void
  onTypingChange: (draft: string) => void
  onClearReply: () => void
  onRemoveAttachment: (attachmentId: string) => void
  onUpload: (file: File) => void
}

export function MessageComposer({
  draft,
  replyTo,
  editing,
  replyAuthor,
  attachments,
  uploading,
  submitting,
  chatTitle,
  onSubmit,
  onDraftChange,
  onTypingChange,
  onClearReply,
  onRemoveAttachment,
  onUpload,
}: MessageComposerProps) {
  return (
    <form className="message-composer" onSubmit={onSubmit}>
      {replyTo && <div className="composer-reply"><span>{editing ? 'Editing message' : `Replying to ${replyAuthor}: ${replyTo.text}`}</span><button type="button" onClick={onClearReply} aria-label={editing ? 'Cancel editing' : 'Cancel reply'}><X size={13} aria-hidden="true" /></button></div>}
      {attachments.length > 0 && <div className="staged-attachments">
        {attachments.map((attachment) => <span key={attachment.id}>{attachment.filename}<button type="button" onClick={() => onRemoveAttachment(attachment.id)} aria-label={`Remove ${attachment.filename}`}><X size={12} aria-hidden="true" /></button></span>)}
      </div>}
      <textarea
        aria-label="Message"
        placeholder={`Message ${chatTitle}`}
        value={draft}
        maxLength={32000}
        onChange={(event) => {
          onDraftChange(event.target.value)
          onTypingChange(event.target.value)
        }}
        onBlur={() => onTypingChange('')}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            event.currentTarget.form?.requestSubmit()
          }
        }}
      />
      <div className="composer-toolbar">
        {!editing && <label className="attach-file-button" aria-label="Attach an encrypted file">
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip,text/plain" disabled={uploading || attachments.length >= 10} onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            if (file) onUpload(file)
            event.currentTarget.value = ''
          }} />
          {uploading ? 'Encrypting…' : <><Paperclip size={12} aria-hidden="true" /> File</>}
        </label>}
        <span className="encryption-indicator"><LockKeyhole size={11} aria-hidden="true" /> End-to-end encrypted</span>
        <span className="composer-hint">Enter to send · Shift+Enter for a new line</span>
        <button type="submit" disabled={uploading || submitting || (!draft.trim() && attachments.length === 0)} aria-label="Send message"><Send size={14} aria-hidden="true" /></button>
      </div>
    </form>
  )
}
