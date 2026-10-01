import type { FormEvent } from 'react'
import { Paperclip, Send, Smile, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { VoicePreview, VoiceRecorder, type VoiceDraft } from './VoiceRecorder'
import type { DisplayMessage, StagedAttachment } from '../../shared/types'
import { insertAtSelection } from '../../shared/presentation'

const commonEmojis = [
  ['😀', 'Grinning face'], ['😂', 'Face with tears of joy'], ['😊', 'Smiling face'], ['😍', 'Heart eyes'],
  ['🥰', 'Smiling face with hearts'], ['😎', 'Smiling face with sunglasses'], ['🤔', 'Thinking face'], ['😭', 'Loudly crying face'],
  ['👍', 'Thumbs up'], ['👎', 'Thumbs down'], ['👏', 'Clapping hands'], ['🙏', 'Folded hands'],
  ['👋', 'Waving hand'], ['❤️', 'Red heart'], ['💚', 'Green heart'], ['🎉', 'Party popper'],
  ['🔥', 'Fire'], ['✨', 'Sparkles'], ['✅', 'Check mark button'], ['💯', 'Hundred points'],
] as const

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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)

  function insertEmoji(emoji: string) {
    const textarea = textareaRef.current
    const selectionStart = textarea?.selectionStart ?? draft.length
    const selectionEnd = textarea?.selectionEnd ?? draft.length
    const insertion = insertAtSelection(draft, selectionStart, selectionEnd, emoji)
    props.onDraftChange(insertion.value)
    props.onTypingChange(insertion.value)
    setEmojiPickerOpen(false)
    requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(insertion.cursor, insertion.cursor)
    })
  }

  return (
    <form className="message-composer" onSubmit={props.onSubmit}>
      {replyTo && <div className="composer-reply"><span>{editing ? 'Editing message' : `Replying to ${replyAuthor}: ${replyTo.text}`}</span><button type="button" onClick={props.onClearReply} aria-label={editing ? 'Cancel editing' : 'Cancel reply'}><X size={13} /></button></div>}

      {attachments.length > 0 && <div className="staged-attachments">
        {attachments.map((attachment) => <span key={attachment.id}>{attachment.filename}<button type="button" onClick={() => props.onRemoveAttachment(attachment.id)} aria-label={`Remove ${attachment.filename}`}><X size={12} /></button></span>)}
      </div>}

      <textarea ref={textareaRef} aria-label="Message" placeholder={`Message ${chatTitle}`} value={draft} maxLength={32000}
        onChange={(event) => { props.onDraftChange(event.target.value); props.onTypingChange(event.target.value) }}
        onBlur={() => props.onTypingChange('')}
        onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} />

      {props.voiceDraft && <VoicePreview draft={props.voiceDraft} onDelete={props.onDeleteVoice} onSend={props.onSendVoice} disabled={uploading || submitting} />}

      <div className="composer-toolbar">
        <button type="button" className="emoji-picker-toggle" aria-label={emojiPickerOpen ? 'Close emoji picker' : 'Open emoji picker'} aria-expanded={emojiPickerOpen} aria-controls="composer-emoji-picker" onClick={() => setEmojiPickerOpen((open) => !open)}><Smile size={16} aria-hidden="true" /></button>
        {!editing && <label className="attach-file-button" aria-label="Add media or file">
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip,text/plain"
            disabled={uploading || attachments.length >= 10}
            onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) props.onUpload(file); event.currentTarget.value = '' }} />
          {uploading ? 'Preparing…' : <><Paperclip size={12} /> Media / file</>}
        </label>}
        {!editing && !props.voiceDraft && <VoiceRecorder disabled={uploading || submitting} onReady={props.onVoiceReady} />}
        <span className="composer-hint">Enter to send · Shift+Enter for a new line</span>
        <button type="submit" disabled={uploading || submitting || (!draft.trim() && attachments.length === 0)} aria-label="Send message"><Send size={14} /></button>
      </div>
      {emojiPickerOpen && <div id="composer-emoji-picker" className="emoji-picker" role="group" aria-label="Choose an emoji" onKeyDown={(event) => {
        if (event.key === 'Escape') setEmojiPickerOpen(false)
      }}>
        {commonEmojis.map(([emoji, label]) => <button type="button" key={label} aria-label={label} title={label} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}
      </div>}
    </form>
  )
}
