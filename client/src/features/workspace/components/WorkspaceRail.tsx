import { Layers3, MessageSquare, Phone, Sparkles } from 'lucide-react'
import { BrandMark } from '../../../shared/components/BrandMark'
import type { User } from '../../../shared/types'
import { Avatar } from '../../../shared/components/Avatar'

type WorkspaceRailProps = {
  user: User
  showCalls: boolean
  showUpdates: boolean
  showSpaces: boolean
  unreadConversationCount: number
  onShowChats: () => void
  onShowCalls: () => void
  onShowUpdates: () => void
  onShowSpaces: () => void
  onOpenAccount: () => void
}

export function WorkspaceRail({ user, showCalls, showUpdates, showSpaces, unreadConversationCount, onShowChats, onShowCalls, onShowUpdates, onShowSpaces, onOpenAccount }: WorkspaceRailProps) {
  return (
    <aside className="primary-rail ui:flex ui:items-center ui:flex-col ui:gap-5 ui:py-5 ui:px-2 ui:bg-sidebar ui:text-secondary ui:border-default ui:[&>.brand-mark]:w-8 ui:[&>.brand-mark]:h-8 ui:[&>.brand-mark]:mb-5 ui:[&>.brand-mark]:rounded-lg ui:[&>.brand-mark]:bg-brand-soft ui:[&>.brand-mark>svg]:w-7 ui:[&>.brand-mark>svg]:h-7" aria-label="Main navigation">
      <BrandMark small />
      <button className={`rail-item ui:flex ui:items-center ui:flex-col ui:justify-center ui:gap-1 ui:p-2 ui:bg-transparent ui:text-secondary ui:cursor-pointer ui:hover:bg-hover ui:hover:text-primary ui:aria-[current=page]:bg-selected ui:aria-[current=page]:text-primary ui:aria-[current=page]:border-brand ui:w-9 ui:min-h-9 ui:border-transparent ui:rounded-md${!showCalls && !showUpdates && !showSpaces ? ' rail-item-active' : ''}`} type="button" aria-current={!showCalls && !showUpdates && !showSpaces ? 'page' : undefined} aria-label={unreadConversationCount ? `Chats, ${unreadConversationCount} unread conversations` : 'Chats'} onClick={onShowChats}>
        <span className="rail-item-icon ui:relative ui:grid ui:place-items-center"><MessageSquare size={15} aria-hidden="true" />{unreadConversationCount > 0 && <b className="navigation-badge ui:absolute ui:grid ui:place-items-center ui:min-w-6 ui:h-6 ui:px-1 ui:border-sidebar ui:rounded-full ui:bg-danger ui:text-danger-foreground ui:text-label ui:leading-none">{unreadConversationCount > 99 ? '99+' : unreadConversationCount}</b>}</span><span className="ui:text-label">Chats</span>
      </button>
      <button className={`rail-item ui:flex ui:items-center ui:flex-col ui:justify-center ui:gap-1 ui:p-2 ui:bg-transparent ui:text-secondary ui:cursor-pointer ui:hover:bg-hover ui:hover:text-primary ui:aria-[current=page]:bg-selected ui:aria-[current=page]:text-primary ui:aria-[current=page]:border-brand ui:w-9 ui:min-h-9 ui:border-transparent ui:rounded-md${showCalls ? ' rail-item-active' : ''}`} type="button" aria-current={showCalls ? 'page' : undefined} onClick={onShowCalls}>
        <Phone size={15} aria-hidden="true" /><span className="ui:text-label">Calls</span>
      </button>
      <button className={`rail-item ui:flex ui:items-center ui:flex-col ui:justify-center ui:gap-1 ui:p-2 ui:bg-transparent ui:text-secondary ui:cursor-pointer ui:hover:bg-hover ui:hover:text-primary ui:aria-[current=page]:bg-selected ui:aria-[current=page]:text-primary ui:aria-[current=page]:border-brand ui:w-9 ui:min-h-9 ui:border-transparent ui:rounded-md${showUpdates ? ' rail-item-active' : ''}`} type="button" aria-current={showUpdates ? 'page' : undefined} onClick={onShowUpdates}>
        <Sparkles size={15} aria-hidden="true" /><span className="ui:text-label">Updates</span>
      </button>
      <button className={`rail-item ui:flex ui:items-center ui:flex-col ui:justify-center ui:gap-1 ui:p-2 ui:bg-transparent ui:text-secondary ui:cursor-pointer ui:hover:bg-hover ui:hover:text-primary ui:aria-[current=page]:bg-selected ui:aria-[current=page]:text-primary ui:aria-[current=page]:border-brand ui:w-9 ui:min-h-9 ui:border-transparent ui:rounded-md${showSpaces ? ' rail-item-active' : ''}`} type="button" aria-current={showSpaces ? 'page' : undefined} onClick={onShowSpaces}>
        <Layers3 size={15} aria-hidden="true" /><span className="ui:text-label">Spaces</span>
      </button>
      <div className="rail-spacer ui:flex-1" />
      <button className="profile-trigger ui:grid ui:place-items-center ui:w-9 ui:min-h-9 ui:p-2 ui:border-default ui:rounded-md ui:bg-transparent ui:cursor-pointer ui:hover:bg-hover ui:[&>.avatar]:bg-brand-soft ui:[&>.avatar]:text-primary" type="button" onClick={onOpenAccount} aria-label="Open profile and settings">
        <Avatar name={user.display_name} src={user.avatar_url} className="avatar-you" />
      </button>
    </aside>
  )
}
