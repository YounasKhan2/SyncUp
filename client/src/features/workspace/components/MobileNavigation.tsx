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
    <nav className="mobile-bottom-nav ui:w-dvw ui:bg-sidebar ui:text-secondary ui:border-default ui:px-4 ui:pt-2 ui:pb-[calc(var(--ds-space-2)+env(safe-area-inset-bottom))]" aria-label="Main navigation">
      <button className="ui:flex ui:items-center ui:flex-col ui:justify-center ui:gap-1 ui:p-2 ui:bg-transparent ui:text-secondary ui:cursor-pointer ui:hover:bg-hover ui:hover:text-primary ui:aria-[current=page]:bg-selected ui:aria-[current=page]:text-primary ui:aria-[current=page]:border-brand ui:min-w-9 ui:min-h-9 ui:border-transparent ui:rounded-md ui:text-caption ui:touch-manipulation ui:aria-[current=page]:[&>span:last-child]:text-label" type="button" aria-current={!accountOpen && section === 'chats' ? 'page' : undefined} aria-label={unreadConversationCount ? `Chats, ${unreadConversationCount} unread conversations` : 'Chats'} onClick={onShowChats}>
        <span className="mobile-nav-icon ui:relative ui:grid ui:place-items-center"><MessageSquare size={19} aria-hidden="true" />{unreadConversationCount > 0 && <b className="navigation-badge ui:absolute ui:grid ui:place-items-center ui:min-w-6 ui:h-6 ui:px-1 ui:border-sidebar ui:rounded-full ui:bg-danger ui:text-danger-foreground ui:text-label ui:leading-none">{unreadConversationCount > 99 ? '99+' : unreadConversationCount}</b>}</span>
        <span className="ui:text-caption">Chats</span>
      </button>
      <button className="ui:flex ui:items-center ui:flex-col ui:justify-center ui:gap-1 ui:p-2 ui:bg-transparent ui:text-secondary ui:cursor-pointer ui:hover:bg-hover ui:hover:text-primary ui:aria-[current=page]:bg-selected ui:aria-[current=page]:text-primary ui:aria-[current=page]:border-brand ui:min-w-9 ui:min-h-9 ui:border-transparent ui:rounded-md ui:text-caption ui:touch-manipulation ui:aria-[current=page]:[&>span:last-child]:text-label" type="button" aria-current={!accountOpen && section === 'calls' ? 'page' : undefined} onClick={onShowCalls}>
        <Phone size={19} aria-hidden="true" />
        <span className="ui:text-caption">Calls</span>
      </button>
      <button className="ui:flex ui:items-center ui:flex-col ui:justify-center ui:gap-1 ui:p-2 ui:bg-transparent ui:text-secondary ui:cursor-pointer ui:hover:bg-hover ui:hover:text-primary ui:aria-[current=page]:bg-selected ui:aria-[current=page]:text-primary ui:aria-[current=page]:border-brand ui:min-w-9 ui:min-h-9 ui:border-transparent ui:rounded-md ui:text-caption ui:touch-manipulation ui:aria-[current=page]:[&>span:last-child]:text-label" type="button" aria-current={!accountOpen && section === 'updates' ? 'page' : undefined} onClick={onShowUpdates}>
        <Sparkles size={19} aria-hidden="true" />
        <span className="ui:text-caption">Updates</span>
      </button>
      <button className="ui:flex ui:items-center ui:flex-col ui:justify-center ui:gap-1 ui:p-2 ui:bg-transparent ui:text-secondary ui:cursor-pointer ui:hover:bg-hover ui:hover:text-primary ui:aria-[current=page]:bg-selected ui:aria-[current=page]:text-primary ui:aria-[current=page]:border-brand ui:min-w-9 ui:min-h-9 ui:border-transparent ui:rounded-md ui:text-caption ui:touch-manipulation ui:aria-[current=page]:[&>span:last-child]:text-label" type="button" aria-current={!accountOpen && section === 'spaces' ? 'page' : undefined} onClick={onShowSpaces}>
        <Layers3 size={19} aria-hidden="true" />
        <span className="ui:text-caption">Spaces</span>
      </button>
      <button className="ui:flex ui:items-center ui:flex-col ui:justify-center ui:gap-1 ui:p-2 ui:bg-transparent ui:text-secondary ui:cursor-pointer ui:hover:bg-hover ui:hover:text-primary ui:aria-[current=page]:bg-selected ui:aria-[current=page]:text-primary ui:aria-[current=page]:border-brand ui:min-w-9 ui:min-h-9 ui:border-transparent ui:rounded-md ui:text-caption ui:touch-manipulation ui:aria-[current=page]:[&>span:last-child]:text-label" type="button" aria-current={accountOpen ? 'page' : undefined} onClick={onOpenAccount}>
        <UserRound size={19} aria-hidden="true" />
        <span className="ui:text-caption">You</span>
      </button>
    </nav>
  )
}
