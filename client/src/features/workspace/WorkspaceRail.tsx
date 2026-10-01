import { MessageSquare, Phone } from 'lucide-react'
import { BrandMark } from '../../shared/components/BrandMark'
import type { User } from '../../shared/types'
import { Avatar } from '../../shared/components/Avatar'

type WorkspaceRailProps = {
  user: User
  showCalls: boolean
  unreadConversationCount: number
  onShowChats: () => void
  onShowCalls: () => void
  onOpenAccount: () => void
}

export function WorkspaceRail({ user, showCalls, unreadConversationCount, onShowChats, onShowCalls, onOpenAccount }: WorkspaceRailProps) {
  return (
    <aside className="primary-rail" aria-label="Main navigation">
      <BrandMark small />
      <button className={`rail-item${!showCalls ? ' rail-item-active' : ''}`} type="button" aria-current={!showCalls ? 'page' : undefined} aria-label={unreadConversationCount ? `Chats, ${unreadConversationCount} unread conversations` : 'Chats'} onClick={onShowChats}>
        <span className="rail-item-icon"><MessageSquare size={15} aria-hidden="true" />{unreadConversationCount > 0 && <b className="navigation-badge">{unreadConversationCount > 99 ? '99+' : unreadConversationCount}</b>}</span><span>Chats</span>
      </button>
      <button className={`rail-item${showCalls ? ' rail-item-active' : ''}`} type="button" aria-current={showCalls ? 'page' : undefined} onClick={onShowCalls}>
        <Phone size={15} aria-hidden="true" /><span>Calls</span>
      </button>
      <div className="rail-spacer" />
      <button className="profile-trigger" type="button" onClick={onOpenAccount} aria-label="Open profile and settings">
        <Avatar name={user.display_name} src={user.avatar_url} className="avatar-you" />
      </button>
    </aside>
  )
}
