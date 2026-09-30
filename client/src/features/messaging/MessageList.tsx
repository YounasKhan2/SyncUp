import { Copy, Flag, Heart, Pin, Phone, ThumbsUp, Trash2, Video } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import type { CallRecord, ChatMember, DisplayMessage } from '../../shared/types'
import type { MediaV2UploadSnapshot } from '../media/v2/uploadManager'
import { MessageAttachment } from './MessageAttachment'
import { MediaViewer, type MediaViewerItem } from '../media/MediaViewer'

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
  onReact: (message: DisplayMessage, emoji: string) => void
  onEdit: (message: DisplayMessage) => void
  onDelete: (message: DisplayMessage, scope: 'me' | 'everyone') => void
  onPin: (message: DisplayMessage) => void
  onCopy: (message: DisplayMessage) => void
  onReport: (message: DisplayMessage) => void
}

export function MessageList({ messages, calls, members, currentUserId, loading, error, emptyMessage, scrollContainerRef, onScroll, loadingOlder, mediaSends, onRetryMedia, onCancelMedia, onReply, onReact, onEdit, onDelete, onPin, onCopy, onReport }: MessageListProps) {
  const membersById = new Map(members.map((member) => [member.id, member]))
  const messagesById = new Map(messages.map((message) => [message.id, message]))
  const [viewerAttachmentId, setViewerAttachmentId] = useState<string | null>(null)

  const mediaItems = useMemo<MediaViewerItem[]>(() => messages.flatMap((message) =>
    (message.deleted_at ? [] : message.attachments ?? [])
      .filter((attachment) => (attachment.content_type.startsWith('image/') || attachment.content_type.startsWith('video/')) && !message.pending)
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
        {loading && <div className="conversation-loading">Loading encrypted messages…</div>}
        {error && <div className="inline-error" role="alert">{error}</div>}
        {!loading && messages.length === 0 && <div className="message-empty">{emptyMessage ?? 'This is the beginning of your encrypted conversation.'}</div>}
        {messages.map((message) => {
          const mine = message.sender_id === currentUserId
          const sender = membersById.get(message.sender_id)
          const parent = message.reply_to_id ? messagesById.get(message.reply_to_id) : undefined
          return (
            <article className={`message-row${mine ? ' message-mine' : ''}`} key={message.id}>
              {!mine && <span className="avatar message-avatar">{sender?.displayName.slice(0, 1).toUpperCase() ?? '?'}</span>}
              <div className="message-content">
                {!mine && <div className="message-meta"><strong>{sender?.displayName ?? 'Member'}</strong><span>@{sender?.username}</span></div>}
                <div className="message-bubble">
                  {parent && <div className="reply-quote">{membersById.get(parent.sender_id)?.displayName}: {parent.deleted_at ? 'Message deleted' : parent.text}</div>}
                  <p>{message.deleted_at ? 'This message was deleted.' : message.pending ? 'Sending encrypted message…' : message.text}</p>
                  {!message.deleted_at && message.attachments?.map((attachment) => <MessageAttachment key={attachment.id} attachment={attachment} pending={message.pending} onOpen={(attachment.content_type.startsWith('image/') || attachment.content_type.startsWith('video/')) && !message.pending ? () => setViewerAttachmentId(attachment.id) : undefined} />)}
                  {message.edited_at && !message.deleted_at && <span className="message-edited">edited</span>}
                  <span className="message-time">{message.pending ? (message.failed ? 'Waiting to reconnect' : 'Pending') : new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                </div>
                {!message.pending && !message.deleted_at && <div className="message-actions">
                  <button type="button" onClick={() => onReply(message)}>Reply</button>
                  <button type="button" onClick={() => onReact(message, '👍')}><ThumbsUp size={12} aria-hidden="true" /> {message.reactions.filter((reaction) => reaction.emoji === '👍').length || ''}</button>
                  <button type="button" onClick={() => onReact(message, '❤️')}><Heart size={12} aria-hidden="true" /> {message.reactions.filter((reaction) => reaction.emoji === '❤️').length || ''}</button>
                  <button type="button" onClick={() => onCopy(message)} aria-label="Copy message"><Copy size={12} aria-hidden="true" /></button>
                  <button type="button" onClick={() => onPin(message)} aria-label={message.pinned_by_me ? 'Unpin message' : 'Pin message'}><Pin size={12} aria-hidden="true" />{message.pinned_by_me ? 'Pinned' : ''}</button>
                  {mine && !message.attachments?.length && <button type="button" onClick={() => onEdit(message)}>Edit</button>}
                  {mine && <button type="button" onClick={() => onDelete(message, 'everyone')} aria-label="Delete for everyone"><Trash2 size={12} aria-hidden="true" />Everyone</button>}
                  <button type="button" onClick={() => onDelete(message, 'me')} aria-label="Delete for me"><Trash2 size={12} aria-hidden="true" />Me</button>
                  {!mine && <button type="button" onClick={() => onReport(message)} aria-label="Report message"><Flag size={12} aria-hidden="true" />Report</button>}
                </div>}
              </div>
            </article>
          )
        })}
        {mediaSends.map((item) => {
          const waiting = item.internalState === 'paused_offline'
          const preparing = item.internalState === 'preparing' || item.internalState === 'optimizing' || item.internalState === 'queued'
          const failed = item.status === 'failed'
          const label = failed ? 'Couldn’t send' : waiting ? 'Waiting for connection…' : preparing ? 'Preparing…' : `Sending ${item.progress}%`
          return (
            <article className="message-row message-mine message-media-pending" key={item.jobId}>
              <div className="message-content">
                <div className="message-bubble media-pending-bubble">
                  <div className={`media-pending-preview media-pending-${item.mediaKind}`}>
                    {item.mediaKind === 'voice' ? <span className="media-pending-voice-icon">●</span> : item.posterUrl ? <img className="media-pending-poster" src={item.posterUrl} alt="" /> : <Video size={18} aria-hidden="true" />}
                    <div><strong>{item.mediaKind === 'voice' ? 'Voice note' : item.filename}</strong><small>{label}</small></div>
                    {!failed && !waiting && <span className="media-progress-ring" style={{ '--media-progress': `${item.progress * 3.6}deg` } as CSSProperties} />}
                  </div>
                  {failed && <div className="media-pending-actions"><button type="button" onClick={() => onRetryMedia(item.jobId)}>Retry</button><button type="button" onClick={() => onCancelMedia(item.jobId)}>Remove</button></div>}
                  {!failed && <button type="button" className="media-pending-cancel" onClick={() => onCancelMedia(item.jobId)}>Cancel</button>}
                </div>
              </div>
            </article>
          )
        })}
        {calls.map((call) => {
          const duration = call.accepted_at && call.ended_at ? Math.max(1, Math.round((Date.parse(call.ended_at) - Date.parse(call.accepted_at)) / 60_000)) : 0
          return (
            <div className="call-history-message" key={call.id}>
              {call.call_type === 'video' ? <Video size={13} aria-hidden="true" /> : <Phone size={13} aria-hidden="true" />}
              <span>{call.status === 'declined' ? 'Call declined' : call.status === 'ended' ? `${call.call_type === 'video' ? 'Video' : 'Audio'} call · ${duration} min` : call.end_reason === 'cancelled' ? 'Call cancelled' : 'Missed call'}</span>
              <time>{new Date(call.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
            </div>
          )
        })}
      </div>
      {viewerAttachmentId && <MediaViewer items={mediaItems} activeId={viewerAttachmentId} onClose={() => setViewerAttachmentId(null)} onChange={setViewerAttachmentId} />}
    </>
  )
}
