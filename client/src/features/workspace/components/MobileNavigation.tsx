import { Layers3, MessageSquare, Phone, Sparkles, UserRound } from 'lucide-react'

type MobileNavigationProps = {
  section: 'chats' | 'calls' | 'updates' | 'spaces'
  accountOpen: boolean
  unreadConversationCount: number
  onShowChats: () => void
  onShowCalls: () => void
  onShowUpdates: () => void
  onShowSpaces: () => void
  onOpenAccount: () => void
}

export function MobileNavigation({ section, accountOpen, unreadConversationCount, onShowChats, onShowCalls, onShowUpdates, onShowSpaces, onOpenAccount }: MobileNavigationProps) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Main navigation">
      <button type="button" aria-current={!accountOpen && section === 'chats' ? 'page' : undefined} aria-label={unreadConversationCount ? `Chats, ${unreadConversationCount} unread conversations` : 'Chats'} onClick={onShowChats}>
        <span className="mobile-nav-icon"><MessageSquare size={19} aria-hidden="true" />{unreadConversationCount > 0 && <b className="navigation-badge">{unreadConversationCount > 99 ? '99+' : unreadConversationCount}</b>}</span>
        <span>Chats</span>
      </button>
      <button type="button" aria-current={!accountOpen && section === 'calls' ? 'page' : undefined} onClick={onShowCalls}>
        <Phone size={19} aria-hidden="true" />
        <span>Calls</span>
      </button>
      <button type="button" aria-current={!accountOpen && section === 'updates' ? 'page' : undefined} onClick={onShowUpdates}>
        <Sparkles size={19} aria-hidden="true" />
        <span>Updates</span>
      </button>
      <button type="button" aria-current={!accountOpen && section === 'spaces' ? 'page' : undefined} onClick={onShowSpaces}>
        <Layers3 size={19} aria-hidden="true" />
        <span>Spaces</span>
      </button>
      <button type="button" aria-current={accountOpen ? 'page' : undefined} onClick={onOpenAccount}>
        <UserRound size={19} aria-hidden="true" />
        <span>You</span>
      </button>
    </nav>
  )
}
