import { MessageSquare, Phone, UserRound } from 'lucide-react'

type MobileNavigationProps = {
  section: 'chats' | 'calls'
  accountOpen: boolean
  unreadConversationCount: number
  onShowChats: () => void
  onShowCalls: () => void
  onOpenAccount: () => void
}

export function MobileNavigation({ section, accountOpen, unreadConversationCount, onShowChats, onShowCalls, onOpenAccount }: MobileNavigationProps) {
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
      <button type="button" aria-current={accountOpen ? 'page' : undefined} onClick={onOpenAccount}>
        <UserRound size={19} aria-hidden="true" />
        <span>You</span>
      </button>
    </nav>
  )
}
