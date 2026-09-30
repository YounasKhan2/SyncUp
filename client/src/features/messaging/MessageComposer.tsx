import type { FormEvent } from 'react'
import { Paperclip, Send, X } from 'lucide-react'
import { VoicePreview, VoiceRecorder, type VoiceDraft } from './VoiceRecorder'
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
  voiceDraft: VoiceDraft | null
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onDraftChange: (draft: string) => void
  onTypingChange: (draft: string) => void
  onClearReply: () => void
  onRemoveAttachment: (attachmentId: string) => void
  onUpload: (file: File) => void
  onVoiceReady: (draft: VoiceDraft) => void
  onDeleteVoice: () => void
  onSendVoice: () => void
}

export function MessageComposer(props: MessageComposerProps) {
  const { draft, replyTo, editing, replyAuthor, attachments, uploading, submitting, chatTitle } = props
  return (
    <form className="message-composer" onSubmit={props.onSubmit}>
      {replyTo && <div className="composer-reply"><span>{editing ? 'Editing message' : `Replying to ${replyAuthor}: ${replyTo.text}`}</span><button type="button" onClick={props.onClearReply} aria-label={editing ? 'Cancel editing' : 'Cancel reply'}><X size={13} /></button></div>}


      {attachments.length > 0 && <div className="staged-attachments">
        {attachments.map((attachment) => <span key={attachment.id}>{attachment.filename}<button type="button" onClick={() => props.onRemoveAttachment(attachment.id)} aria-label={`Remove ${attachment.filename}`}><X size={12} /></button></span>)}
      </div>}

      <textarea aria-label="Message" placeholder={`Message ${chatTitle}`} value={draft} maxLength={32000}
        onChange={(event) => { props.onDraftChange(event.target.value); props.onTypingChange(event.target.value) }}
        onBlur={() => props.onTypingChange('')}
        onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} />

      {props.voiceDraft && <VoicePreview draft={props.voiceDraft} onDelete={props.onDeleteVoice} onSend={props.onSendVoice} disabled={uploading || submitting} />}

      <div className="composer-toolbar">
        {!editing && <label className="attach-file-button" aria-label="Add media or file">
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip,text/plain"
            disabled={uploading || attachments.length >= 10}
            onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) props.onUpload(file); event.currentTarget.value = '' }} />
          {uploading ? <span className="composer-preparing">…</span> : <Paperclip size={16} />}
        </label>}
        {!editing && !props.voiceDraft && <VoiceRecorder disabled={uploading || submitting} onReady={props.onVoiceReady} />}
        <span className="composer-hint">Enter to send · Shift+Enter for a new line</span>
        <button type="submit" disabled={uploading || submitting || (!draft.trim() && attachments.length === 0)} aria-label="Send message"><Send size={14} /></button>
      </div>
    </form>
  )
}
