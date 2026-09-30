import { PenLine } from 'lucide-react'
import type { Chat } from '../../shared/types'

export function ChatRow({ chat, draft, selected, onSelect }: { chat: Chat; draft?: string; selected: boolean; onSelect: (chatId: string) => void }) {
  const previewText = draft
    ? draft.length > 60 ? draft.slice(0, 60) + '…' : draft
    : chat.preview || (chat.kind === 'direct' ? 'End-to-end encrypted chat' : 'Encrypted group chat')

  return (
    <button type="button" className={`chat-list-item${selected ? ' selected' : ''}${draft ? ' has-draft' : ''}`} onClick={() => onSelect(chat.id)}>
      <span className={`avatar${chat.kind === 'group' ? ' group-avatar' : ''}`}>{chat.display_title.slice(0, 1).toUpperCase()}</span>
      <span className="chat-row-copy"><strong>{chat.display_title}</strong><small>{draft ? <><span className="draft-label"><PenLine size={9} aria-hidden="true" />Draft:</span> {previewText}</> : previewText}</small></span>
      <span className="chat-row-meta">{chat.last_message_created_at && new Date(chat.last_message_created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{Number(chat.unread_count) > 0 && <b>{chat.unread_count}</b>}</span>
    </button>
  )
}
