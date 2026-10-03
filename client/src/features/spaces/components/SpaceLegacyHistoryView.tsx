import { LockKeyhole } from 'lucide-react'
import { MessageAttachment } from '../../messaging/MessageAttachment'
import type { DisplayMessage } from '../../../shared/types'
import type { SpaceChannelMember } from '../types'

// Already decrypted data and display identity only; access and pagination stay
// with SpacesPage. This component owns no crypto, transport or lifecycle.
export function SpaceLegacyHistoryView({ legacyMessages, legacyMembersById, userId, legacyHasMore, legacyLoading, legacyError, onLoadEarlier }: {
  legacyMessages: DisplayMessage[]
  legacyMembersById: Map<string, SpaceChannelMember>
  userId: string
  legacyHasMore: boolean
  legacyLoading: boolean
  legacyError: string
  onLoadEarlier: () => void
}) {
  return (
    <section className="legacy-history-inline" aria-label="Earlier encrypted group history">
      <header><div><strong><LockKeyhole size={13} aria-hidden="true" /> Earlier encrypted history</strong><p>These messages remain end-to-end encrypted and visible only to original group members.</p></div>
        {legacyHasMore && <button type="button" onClick={onLoadEarlier} disabled={legacyLoading}>{legacyLoading ? 'Loading…' : 'Load earlier'}</button>}
      </header>
      {legacyError && <div className="inline-error" role="alert">{legacyError}</div>}
      {legacyLoading && legacyMessages.length === 0 && <p className="legacy-history-status" role="status">Loading earlier messages…</p>}
      {!legacyLoading && legacyMessages.length === 0 && !legacyError && <p className="legacy-history-status">No earlier messages in this group.</p>}
      {legacyMessages.map((message) => {
        const sender = legacyMembersById.get(message.sender_id)
        return <article className="space-message legacy-space-message" key={message.id}>
          <div className="space-message-heading">
            <strong>{sender?.display_name ?? (message.sender_id === userId ? 'You' : 'Group member')}</strong>
            {sender?.username && <small>@{sender.username} · {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(message.created_at))}</small>}
            {!sender?.username && <small>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(message.created_at))}</small>}
          </div>
          {message.deleted_at
            ? <p>This message was deleted.</p>
            : message.text && <p>{message.text}</p>}
          {!message.deleted_at && message.attachments?.filter((attachment) => !attachment.is_preview).map((attachment) =>
            <MessageAttachment key={attachment.id} attachment={attachment} />,
          )}
          {message.reactions.length > 0 && <div className="message-reactions" aria-label="Reactions">
            {[...new Set(message.reactions.map((reaction) => reaction.emoji))].map((emoji) => {
              const count = message.reactions.filter((reaction) => reaction.emoji === emoji).length
              return <span key={emoji} aria-label={`${emoji}, ${count} ${count === 1 ? 'reaction' : 'reactions'}`}><span>{emoji}</span><span>{count}</span></span>
            })}
          </div>}
        </article>
      })}
    </section>
  )
}
