import { Check, CheckCheck, Copy, Flag, Mic, Pin, Phone, SmilePlus, Trash2, Video } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { RefObject } from 'react'
import type { CallRecord, ChatMember, DisplayMessage } from '../../shared/types'
import { Avatar } from '../../shared/components/Avatar'
import { FullEmojiPicker } from '../../shared/components/FullEmojiPicker'
import type { MediaV2UploadSnapshot } from '../media/v2/uploadManager'
import { MessageAttachment } from './MessageAttachment'
import { MediaViewer, type MediaViewerItem } from '../media/MediaViewer'
import { sortChronologically, splitMessageLinks } from '../../shared/presentation'

type MessageListProps = {
  messages: DisplayMessage[]
  calls: CallRecord[]
  members: ChatMember[]
  currentUserId: string
  loading: boolean
  error: string
  emptyMessage?: string
  scrollContainerRef: RefObject<HTMLDivElement | null>
  onScroll: () => void
  loadingOlder: boolean
  mediaSends: MediaV2UploadSnapshot[]
  onRetryMedia: (jobId: string) => void
  onCancelMedia: (jobId: string) => void
  onReply: (message: DisplayMessage) => void
  onJumpToMessage: (messageId: string, serverSeq: string) => void
  onReact: (message: DisplayMessage, emoji: string) => void
  onEdit: (message: DisplayMessage) => void
  onDelete: (message: DisplayMessage, scope: 'me' | 'everyone') => void
  onPin: (message: DisplayMessage) => void
  onCopy: (message: DisplayMessage) => void
  onReport: (message: DisplayMessage) => void
}

export function MessageList({ messages, calls, members, currentUserId, loading, error, emptyMessage, scrollContainerRef, onScroll, loadingOlder, mediaSends, onRetryMedia, onCancelMedia, onReply, onJumpToMessage, onReact, onEdit, onDelete, onPin, onCopy, onReport }: MessageListProps) {
  const membersById = new Map(members.map((member) => [member.id, member]))
  const messagesById = new Map(messages.map((message) => [message.id, message]))
  const [viewerAttachmentId, setViewerAttachmentId] = useState<string | null>(null)
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null)
  const timeline = sortChronologically([
    ...messages.map((message) => ({ type: 'message' as const, id: message.id, created_at: message.created_at, message })),
    ...calls.map((call) => ({ type: 'call' as const, id: call.id, created_at: call.created_at, call })),
  ])

  const mediaItems = useMemo<MediaViewerItem[]>(() => messages.flatMap((message) =>
    (message.deleted_at ? [] : message.attachments ?? [])
    .filter((attachment) => !attachment.is_preview
      && (attachment.content_type.startsWith('image/') || attachment.content_type.startsWith('video/'))
      && !message.pending)
      .map((attachment) => ({
        attachment,
        senderName: members.find((member) => member.id === message.sender_id)?.displayName ?? (message.sender_id === currentUserId ? 'You' : 'Member'),
        createdAt: message.created_at,
      })),
  ), [currentUserId, members, messages])

  return (
    <>
      <div className="message-list" aria-live="polite" ref={scrollContainerRef} onScroll={onScroll}>
        {loadingOlder && <div className="older-messages-loading" role="status">Loading earlier messages…</div>}
        {loading && <div className="conversation-loading">Loading messages…</div>}
        {error && <div className="inline-error" role="alert">{error}</div>}
        {!loading && messages.length === 0 && <div className="message-empty">{emptyMessage ?? 'This is the beginning of your conversation.'}</div>}
        {timeline.map((entry) => {
          if (entry.type === 'call') {
            const call = entry.call
            const duration = call.accepted_at && call.ended_at ? Math.max(1, Math.round((Date.parse(call.ended_at) - Date.parse(call.accepted_at)) / 60_000)) : 0
            return (
              <div className="call-history-message" key={call.id}>
                {call.call_type === 'video' ? <Video size={13} aria-hidden="true" /> : <Phone size={13} aria-hidden="true" />}
                <span>{call.status === 'declined' ? 'Call declined' : call.status === 'ended' ? `${call.is_group ? 'Group ' : ''}${call.call_type === 'video' ? 'Video' : 'Audio'} call · ${duration} min` : call.end_reason === 'cancelled' ? 'Call cancelled' : 'Missed call'}</span>
                <time>{new Date(call.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
              </div>
            )
          }
          const message = entry.message
          const mine = message.sender_id === currentUserId
          const sender = membersById.get(message.sender_id)
          const parent = message.reply_to_id
            ? message.reply_context ?? messagesById.get(message.reply_to_id)
            : undefined
          const recipients = members.filter((member) => member.id !== currentUserId)
          const deliveredUsers = new Set(message.delivery_receipts ?? [])
          const readUsers = new Set(message.read_by ?? [])
          const deliveredCount = recipients.filter((member) => deliveredUsers.has(member.id)).length
          const readCount = recipients.filter((member) => readUsers.has(member.id)).length
          const groupReceipt = recipients.length > 1
          const receiptLabel = readCount > 0
            ? groupReceipt ? `Read ${readCount}/${recipients.length}` : 'Read'
            : deliveredCount > 0
              ? groupReceipt ? `Delivered ${deliveredCount}/${recipients.length}` : 'Delivered'
              : 'Sent'
          const receiptState = readCount > 0 ? 'read' : deliveredCount > 0 ? 'delivered' : 'sent'
          const textParts = message.deleted_at || message.pending ? [{ text: '' }] : splitMessageLinks(message.text)
          const reactions = [...new Set(message.reactions.map((reaction) => reaction.emoji))]
            .map((emoji) => ({
              emoji,
              users: message.reactions.filter((reaction) => reaction.emoji === emoji),
            }))
          return (
            <article id={`message-${message.id}`} data-message-id={message.id} className={`message-row${mine ? ' message-mine' : ''}${message.pinned_at ? ' message-pinned' : ''}`} key={message.id}>
              {!mine && <Avatar name={sender?.displayName ?? 'Member'} src={sender?.avatar_url} className="message-avatar" />}
              <div className="message-content">
                {!mine && <div className="message-meta"><strong>{sender?.displayName ?? 'Member'}</strong><span>@{sender?.username}</span></div>}
                <div className="message-bubble">
                  {message.reply_to_id && <button
                    type="button"
                    className="reply-quote"
                    disabled={!parent}
                    onClick={() => parent && onJumpToMessage(parent.id, parent.server_seq)}
                    aria-label={parent ? `Go to message from ${membersById.get(parent.sender_id)?.displayName ?? 'member'}` : 'Original message unavailable'}
                  >
                    <strong>{parent ? membersById.get(parent.sender_id)?.displayName ?? 'Member' : 'Reply'}</strong>
                    <span>{parent
                      ? parent.deleted_at
                        ? 'Message deleted'
                        : parent.text.trim() || ('attachment_types' in parent
                          ? parent.attachment_types.some((type) => type.startsWith('image/'))
                            ? 'Photo'
                            : parent.attachment_types.some((type) => type.startsWith('video/'))
                              ? 'Video'
                              : parent.attachment_types.some((type) => type.startsWith('audio/'))
                                ? 'Voice message'
                                : parent.attachment_types.length ? 'Attachment' : 'Message'
                          : parent.attachments?.some((attachment) => attachment.content_type.startsWith('image/'))
                            ? 'Photo'
                            : parent.attachments?.some((attachment) => attachment.content_type.startsWith('video/'))
                              ? 'Video'
                              : parent.attachments?.some((attachment) => attachment.content_type.startsWith('audio/'))
                                ? 'Voice message'
                                : parent.attachments?.length ? 'Attachment' : 'Message')
                      : 'Original message unavailable'}</span>
                  </button>}
                  {message.pinned_at && <span className="message-pinned-label"><Pin size={10} aria-hidden="true" /> Pinned in this chat</span>}
                  <p>{message.deleted_at ? 'This message was deleted.' : message.pending ? (message.attachments?.some((a: {content_type: string}) => a.content_type.startsWith('audio/')) && !message.text ? '' : 'Sending…') : textParts.map((part, index) => part.href
                    ? <a href={part.href} target="_blank" rel="noopener noreferrer" key={`${index}:${part.href}`}>{part.text}</a>
                    : <span key={index}>{part.text}</span>)}</p>
                  {!message.deleted_at && message.attachments?.filter((attachment) => !attachment.is_preview).map((attachment) => <MessageAttachment key={attachment.id} attachment={attachment} pending={message.pending} onOpen={(attachment.content_type.startsWith('image/') || attachment.content_type.startsWith('video/')) && !message.pending ? () => setViewerAttachmentId(attachment.id) : undefined} />)}
                  {message.edited_at && !message.deleted_at && <span className="message-edited">edited</span>}
                  <span className="message-footer">
                    <time className="message-time">{message.pending ? (message.failed ? 'Waiting to reconnect' : 'Pending') : new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
                    {!message.pending && mine && !message.deleted_at && <span className={`message-receipt ${receiptState}`} role="img" aria-label={receiptLabel} title={receiptLabel}>
                      {receiptState === 'sent' ? <Check size={10} aria-hidden="true" /> : <CheckCheck size={12} aria-hidden="true" />}
                      {groupReceipt && (readCount > 0 || deliveredCount > 0) && <span>{readCount > 0 ? readCount : deliveredCount}/{recipients.length}</span>}
                    </span>}
                  </span>
                </div>
                {reactions.length > 0 && <div className="message-reactions" aria-label="Reactions">
                  {reactions.map(({ emoji, users }) => {
                    const mineReacted = users.some((reaction) => reaction.user_id === currentUserId)
                    return <button key={emoji} type="button" aria-pressed={mineReacted} aria-label={`${emoji}, ${users.length} ${users.length === 1 ? 'reaction' : 'reactions'}${mineReacted ? ', reacted by you' : ''}`} onClick={() => onReact(message, emoji)}>
                      <span>{emoji}</span><span>{users.length}</span>
                    </button>
                  })}
                </div>}
                {!message.pending && !message.deleted_at && <div className="message-actions">
                  <button type="button" onClick={() => onReply(message)}>Reply</button>
                  <button type="button" aria-label="Add reaction" aria-expanded={reactionPickerMessageId === message.id} onClick={() => setReactionPickerMessageId((current) => current === message.id ? null : message.id)}><SmilePlus size={12} aria-hidden="true" /></button>
                  {!message.attachments?.length && message.text.trim() && <button type="button" onClick={() => onCopy(message)} aria-label="Copy message"><Copy size={12} aria-hidden="true" /></button>}
                  <button type="button" className={message.pinned_at ? 'message-pin-active' : ''} aria-label={message.pinned_at ? 'Unpin message for everyone' : 'Pin message for everyone'} aria-pressed={Boolean(message.pinned_at)} onClick={() => onPin(message)}><Pin size={12} aria-hidden="true" />{message.pinned_at ? 'Pinned' : 'Pin'}</button>
                  {mine && !message.attachments?.length && <button type="button" onClick={() => onEdit(message)}>Edit</button>}
                  {mine && <button type="button" onClick={() => onDelete(message, 'everyone')} aria-label="Delete for everyone"><Trash2 size={12} aria-hidden="true" />Everyone</button>}
                  <button type="button" onClick={() => onDelete(message, 'me')} aria-label="Delete for me"><Trash2 size={12} aria-hidden="true" />Me</button>
                  {!mine && <button type="button" onClick={() => onReport(message)} aria-label="Report message"><Flag size={12} aria-hidden="true" />Report</button>}
                </div>}
                {reactionPickerMessageId === message.id && <div className="reaction-picker-popover">
                  <FullEmojiPicker
                    onSelect={(emoji) => {
                      onReact(message, emoji)
                      setReactionPickerMessageId(null)
                    }}
                    onClose={() => setReactionPickerMessageId(null)}
                  />
                </div>}
              </div>
            </article>
          )
        })}
        {mediaSends.map((item) => {
          const waiting = item.internalState === 'paused_offline'
          const preparing = item.internalState === 'preparing' || item.internalState === 'optimizing' || item.internalState === 'queued'
          const failed = item.status === 'failed'
          const label = failed ? 'Couldn’t send' : waiting ? 'Waiting for connection…' : preparing ? 'Encrypting…' : `Sending ${item.progress}%`
          return (
            <article className="message-row message-mine message-media-pending" key={item.jobId}>
              <div className="message-content">
                <div className="message-bubble media-pending-bubble">
                  <div className={`media-pending-preview media-pending-${item.mediaKind}`}>
                    {item.mediaKind === 'voice' ? <span className="media-pending-voice-icon"><Mic size={15} /></span> : <Video size={18} aria-hidden="true" />}
                    <div><strong>{item.mediaKind === 'voice' ? 'Voice note' : item.filename}</strong><small>{label}</small></div>
                    {!failed && !waiting && <span className="media-progress-ring" style={{ '--media-progress': `${item.progress * 3.6}deg` } as React.CSSProperties} />}
                  </div>
                  {failed && <div className="media-pending-actions"><button type="button" onClick={() => onRetryMedia(item.jobId)}>Retry</button><button type="button" onClick={() => onCancelMedia(item.jobId)}>Remove</button></div>}
                  {!failed && <button type="button" className="media-pending-cancel" onClick={() => onCancelMedia(item.jobId)}>Cancel</button>}
                </div>
              </div>
            </article>
          )
        })}
      </div>
      {viewerAttachmentId && <MediaViewer items={mediaItems} activeId={viewerAttachmentId} onClose={() => setViewerAttachmentId(null)} onChange={setViewerAttachmentId} />}
    </>
  )
}
