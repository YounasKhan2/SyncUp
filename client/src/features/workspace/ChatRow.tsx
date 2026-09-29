import type { Chat } from '../../shared/types'

export function ChatRow({ chat, selected, onSelect }: { chat: Chat; selected: boolean; onSelect: (chatId: string) => void }) {
  return (
    <button type="button" className={`chat-list-item${selected ? ' selected' : ''}`} onClick={() => onSelect(chat.id)}>
      <span className={`avatar${chat.kind === 'group' ? ' group-avatar' : ''}`}>{chat.display_title.slice(0, 1).toUpperCase()}</span>
      <span className="chat-row-copy"><strong>{chat.display_title}</strong><small>{chat.preview || (chat.kind === 'direct' ? 'End-to-end encrypted chat' : 'Encrypted group chat')}</small></span>
      <span className="chat-row-meta">{chat.last_message_created_at && new Date(chat.last_message_created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{Number(chat.unread_count) > 0 && <b>{chat.unread_count}</b>}</span>
    </button>
  )
}
