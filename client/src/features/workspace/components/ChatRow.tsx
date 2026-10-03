import { PenLine } from 'lucide-react'
import type { Chat } from '../../../shared/types'
import { Avatar } from '../../../shared/components/Avatar'

export function ChatRow({ chat, draft, selected, onSelect }: { chat: Chat; draft?: string; selected: boolean; onSelect: (chatId: string) => void }) {
  const previewText = draft
    ? draft.length > 60 ? draft.slice(0, 60) + '…' : draft
    : chat.preview || (chat.kind === 'direct' ? 'End-to-end encrypted chat' : 'Encrypted group chat')

  return (
    <button type="button" className={`chat-list-item ui:flex ui:w-full ui:min-h-9 ui:items-center ui:gap-5 ui:px-6 ui:py-4 ui:rounded-none ui:bg-transparent ui:text-primary ui:text-left ui:cursor-pointer ui:hover:bg-hover ui:[&.selected]:bg-selected ui:[&.selected]:border-l-brand ui:[&:is(:hover,.selected)_.chat-row-copy_small]:text-primary ui:[&:is(:hover,.selected)_.chat-row-meta]:text-primary${selected ? ' selected' : ''}${draft ? ' has-draft' : ''}`} onClick={() => onSelect(chat.id)}>
      <Avatar name={chat.display_title} src={chat.peer_avatar_url} className={`ui:bg-brand-soft ui:text-primary${chat.kind === 'group' ? ' group-avatar' : ''}`} />
      <span className="chat-row-copy ui:flex ui:flex-1 ui:flex-col ui:gap-1 ui:overflow-hidden"><strong className="ui:truncate ui:text-label ui:text-primary">{chat.display_title}</strong><small className="ui:truncate ui:text-body-sm ui:text-secondary">{draft ? <><span className="draft-label ui:inline-flex ui:items-center ui:gap-1 ui:text-label ui:text-brand"><PenLine size={9} aria-hidden="true" />Draft:</span> {previewText}</> : previewText}</small></span>
      <span className="chat-row-meta ui:flex ui:shrink-0 ui:flex-col ui:items-end ui:gap-2 ui:text-caption ui:text-secondary ui:whitespace-nowrap">{chat.last_message_created_at && new Date(chat.last_message_created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}{Number(chat.unread_count) > 0 && <b className="ui:inline-grid ui:min-w-6 ui:h-6 ui:place-items-center ui:px-2 ui:rounded-full ui:bg-brand ui:text-brand-foreground ui:text-label">{chat.unread_count}</b>}</span>
    </button>
  )
}
