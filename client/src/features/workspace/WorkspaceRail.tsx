import { MessageSquare, Phone } from 'lucide-react'
import { BrandMark } from '../../shared/components/BrandMark'
import type { User } from '../../shared/types'

type WorkspaceRailProps = {
  user: User
  showCalls: boolean
  onShowChats: () => void
  onShowCalls: () => void
  onOpenAccount: () => void
}

export function WorkspaceRail({ user, showCalls, onShowChats, onShowCalls, onOpenAccount }: WorkspaceRailProps) {
  return (
    <aside className="primary-rail" aria-label="Main navigation">
      <BrandMark small />
      <button className={`rail-item${!showCalls ? ' rail-item-active' : ''}`} type="button" aria-current={!showCalls ? 'page' : undefined} onClick={onShowChats}>
        <MessageSquare size={15} aria-hidden="true" /><span>Chats</span>
      </button>
      <button className={`rail-item${showCalls ? ' rail-item-active' : ''}`} type="button" aria-current={showCalls ? 'page' : undefined} onClick={onShowCalls}>
        <Phone size={15} aria-hidden="true" /><span>Calls</span>
      </button>
      <div className="rail-spacer" />
      <button className="profile-trigger" type="button" onClick={onOpenAccount} aria-label="Open profile and settings">
        <span className="avatar avatar-you">{user.display_name.slice(0, 1).toUpperCase()}</span>
      </button>
    </aside>
  )
}
