import { Layers3, MessageSquare, Phone, Sparkles } from 'lucide-react'
import { BrandMark } from '../../shared/components/BrandMark'
import type { User } from '../../shared/types'
import { Avatar } from '../../shared/components/Avatar'

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
    <aside className="primary-rail" aria-label="Main navigation">
      <BrandMark small />
      <button className={`rail-item${!showCalls && !showUpdates && !showSpaces ? ' rail-item-active' : ''}`} type="button" aria-current={!showCalls && !showUpdates && !showSpaces ? 'page' : undefined} aria-label={unreadConversationCount ? `Chats, ${unreadConversationCount} unread conversations` : 'Chats'} onClick={onShowChats}>
        <span className="rail-item-icon"><MessageSquare size={15} aria-hidden="true" />{unreadConversationCount > 0 && <b className="navigation-badge">{unreadConversationCount > 99 ? '99+' : unreadConversationCount}</b>}</span><span>Chats</span>
      </button>
      <button className={`rail-item${showCalls ? ' rail-item-active' : ''}`} type="button" aria-current={showCalls ? 'page' : undefined} onClick={onShowCalls}>
        <Phone size={15} aria-hidden="true" /><span>Calls</span>
      </button>
      <button className={`rail-item${showUpdates ? ' rail-item-active' : ''}`} type="button" aria-current={showUpdates ? 'page' : undefined} onClick={onShowUpdates}>
        <Sparkles size={15} aria-hidden="true" /><span>Updates</span>
      </button>
      <button className={`rail-item${showSpaces ? ' rail-item-active' : ''}`} type="button" aria-current={showSpaces ? 'page' : undefined} onClick={onShowSpaces}>
        <Layers3 size={15} aria-hidden="true" /><span>Spaces</span>
      </button>
      <div className="rail-spacer" />
      <button className="profile-trigger" type="button" onClick={onOpenAccount} aria-label="Open profile and settings">
        <Avatar name={user.display_name} src={user.avatar_url} className="avatar-you" />
      </button>
    </aside>
  )
}
