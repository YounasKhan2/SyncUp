import type { FormEvent } from 'react'
import { Paperclip, Send, X } from 'lucide-react'
import type { DisplayMessage, StagedAttachment } from '../../shared/types'
import type { MediaV2UploadSnapshot } from '../media/v2/uploadManager'
import type { VideoMode } from '../media/v2/videoPreparation'

export type PendingVideoChoice = { file: File; mode: VideoMode }

type MessageComposerProps = {
  draft: string
  replyTo: DisplayMessage | null
  editing: boolean
  replyAuthor: string
  attachments: StagedAttachment[]
  uploading: boolean
  submitting: boolean
  chatTitle: string
  videoChoice: PendingVideoChoice | null
  videoSends: MediaV2UploadSnapshot[]
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onDraftChange: (draft: string) => void
  onTypingChange: (draft: string) => void
  onClearReply: () => void
  onRemoveAttachment: (attachmentId: string) => void
  onUpload: (file: File) => void
  onChooseVideoMode: (mode: VideoMode) => void
  onCancelVideoChoice: () => void
  onRetryVideo: (jobId: string) => void
  onCancelVideo: (jobId: string) => void
}

function friendlyVideoStatus(item: MediaV2UploadSnapshot) {
  if (item.status === 'sent') return 'Sent'
  if (item.status === 'failed') return 'Couldn’t send'
  if (item.internalState === 'preparing' || item.internalState === 'optimizing' || item.internalState === 'queued') return 'Preparing…'
  if (item.internalState === 'paused_offline') return 'Waiting for connection…'
  if (item.internalState === 'paused_user') return 'Paused'
  return `Sending ${item.progress}%`
}

export function MessageComposer(props: MessageComposerProps) {
  const { draft, replyTo, editing, replyAuthor, attachments, uploading, submitting, chatTitle, videoChoice, videoSends } = props
  return (
    <form className="message-composer" onSubmit={props.onSubmit}>
      {replyTo && <div className="composer-reply"><span>{editing ? 'Editing message' : `Replying to ${replyAuthor}: ${replyTo.text}`}</span><button type="button" onClick={props.onClearReply} aria-label={editing ? 'Cancel editing' : 'Cancel reply'}><X size={13} /></button></div>}

      {videoChoice && <div className="video-send-choice">
        <div><strong>{videoChoice.file.name}</strong><small>Choose video quality</small></div>
        <div className="video-quality-options">
          {(['standard', 'hd', 'original'] as VideoMode[]).map((mode) => <button key={mode} type="button" className={videoChoice.mode === mode ? 'active' : ''} onClick={() => props.onChooseVideoMode(mode)}>
            {mode === 'standard' ? 'Standard' : mode === 'hd' ? 'HD' : 'Original'}
          </button>)}
          <button type="button" className="video-choice-cancel" onClick={props.onCancelVideoChoice}>Cancel</button>
        </div>
        <small>{videoChoice.mode === 'standard' ? 'Smaller size · faster to send' : videoChoice.mode === 'hd' ? 'Better quality · recommended' : 'Full original quality · largest size'}</small>
      </div>}

      {videoSends.length > 0 && <div className="video-send-progress">
        {videoSends.map((item) => <div className="video-send-progress-row" key={item.jobId}>
          <span>{friendlyVideoStatus(item)}</span>
          {item.status === 'failed'
            ? <><button type="button" onClick={() => props.onRetryVideo(item.jobId)}>Retry</button><button type="button" onClick={() => props.onCancelVideo(item.jobId)}>Remove</button></>
            : item.status !== 'sent' && <button type="button" onClick={() => props.onCancelVideo(item.jobId)}>Cancel</button>}
        </div>)}
      </div>}

      {attachments.length > 0 && <div className="staged-attachments">
        {attachments.map((attachment) => <span key={attachment.id}>{attachment.filename}<button type="button" onClick={() => props.onRemoveAttachment(attachment.id)} aria-label={`Remove ${attachment.filename}`}><X size={12} /></button></span>)}
      </div>}

      <textarea aria-label="Message" placeholder={`Message ${chatTitle}`} value={draft} maxLength={32000}
        onChange={(event) => { props.onDraftChange(event.target.value); props.onTypingChange(event.target.value) }}
        onBlur={() => props.onTypingChange('')}
        onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} />

      <div className="composer-toolbar">
        {!editing && <label className="attach-file-button" aria-label="Add media or file">
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip,text/plain"
            disabled={uploading || Boolean(videoChoice) || attachments.length >= 10}
            onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) props.onUpload(file); event.currentTarget.value = '' }} />
          {uploading ? 'Preparing…' : <><Paperclip size={12} /> Media / file</>}
        </label>}
        <span className="composer-hint">Enter to send · Shift+Enter for a new line</span>
        <button type="submit" disabled={uploading || submitting || Boolean(videoChoice) || (!draft.trim() && attachments.length === 0)} aria-label="Send message"><Send size={14} /></button>
      </div>
    </form>
  )
}
