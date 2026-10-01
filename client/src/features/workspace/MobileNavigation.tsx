import { MessageSquare, Phone, UserRound } from 'lucide-react'

type MobileNavigationProps = {
  section: 'chats' | 'calls'
  accountOpen: boolean
  onShowChats: () => void
  onShowCalls: () => void
  onOpenAccount: () => void
}

export function MobileNavigation({ section, accountOpen, onShowChats, onShowCalls, onOpenAccount }: MobileNavigationProps) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Main navigation">
      <button type="button" aria-current={!accountOpen && section === 'chats' ? 'page' : undefined} onClick={onShowChats}>
        <MessageSquare size={19} aria-hidden="true" />
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
