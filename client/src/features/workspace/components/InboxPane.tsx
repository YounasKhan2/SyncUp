import { ArrowDownLeft, ArrowUpRight, Clock3, Phone, PhoneMissed, PhoneOutgoing, Plus, Search, Video } from 'lucide-react'
import type { CallRecord, Chat, IncomingRequest } from '../../../shared/types'
import { ChatRow } from './ChatRow'
import { Avatar } from '../../../shared/components/Avatar'

type InboxPaneProps = {
  showCalls: boolean
  callHistory: CallRecord[]
  userId: string
  filter: 'all' | 'unread'
  showRequests: boolean
  requests: IncomingRequest[]
  error: string
  chats: Chat[]
  drafts: Record<string, string>
  activeChatId: string | null
  online: boolean
  onSelectChat: (chatId: string) => void
  onSelectCall: (chatId: string) => void
  onCallAgain: (call: CallRecord, callType: 'audio' | 'video') => void
  onNewCall: () => void
  onSelectRequest: () => void
  onSelectFilter: (filter: 'all' | 'unread') => void
  onShowRequests: () => void
  onNewConversation: () => void
  onOpenSearch: () => void
}

export function InboxPane({
  showCalls,
  callHistory,
  userId,
  filter,
  showRequests,
  requests,
  error,
  chats,
  drafts,
  activeChatId,
  online,
  onSelectChat,
  onSelectCall,
  onCallAgain,
  onNewCall,
  onSelectRequest,
  onSelectFilter,
  onShowRequests,
  onNewConversation,
  onOpenSearch,
}: InboxPaneProps) {
  const visibleChats = chats.filter((chat) => filter === 'all' || Number(chat.unread_count) > 0)
  const callStatus = (call: CallRecord) => {
    if (call.status === 'ringing') return 'Ringing'
    if (call.status === 'active') return 'In progress'
    if (call.status === 'declined') return call.callee_id === userId ? 'Declined by you' : 'Declined'
    if (call.status === 'missed') return call.callee_id === userId ? 'Missed call' : 'No answer'
    if (call.status === 'ended') return call.end_reason === 'cancelled' ? 'Cancelled' : 'Completed'
    return call.end_reason ?? call.status
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const weekStart = new Date(today)
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
  const callSections = [
    { title: 'Today', start: today, end: tomorrow },
    { title: 'Yesterday', start: yesterday, end: today },
    { title: 'This week', start: weekStart, end: yesterday },
    { title: 'Earlier', start: new Date(0), end: weekStart },
  ].map((section) => {
    const calls = callHistory.filter((call) => {
      const created = new Date(call.created_at)
      return created >= section.start && created < section.end
    })
    return { title: section.title, calls }
  }).filter((section) => section.calls.length > 0)
  const callDuration = (call: CallRecord) => {
    if (!call.accepted_at || !call.ended_at) return ''
    const seconds = Math.floor((Date.parse(call.ended_at) - Date.parse(call.accepted_at)) / 1000)
    if (!Number.isFinite(seconds) || seconds <= 0) return ''
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)} hr ${Math.floor(seconds % 3600 / 60)} min`
    if (seconds >= 60) return `${Math.floor(seconds / 60)} min ${seconds % 60} sec`
    return `${seconds} sec`
  }
  const callTitle = (call: CallRecord) => call.group_title ?? call.other_name ?? 'Contact'
  const callMissed = (call: CallRecord) => call.status === 'missed' || call.status === 'declined'
  const direction = (call: CallRecord) => call.is_group
    ? call.caller_id === userId ? 'Started group call' : 'Joined group call'
    : call.caller_id === userId ? 'Outgoing' : 'Incoming'

  return (
    <aside className={`inbox-pane${showCalls ? '' : ' inbox-content'} ui:bg-surface ui:text-secondary ui:border-default`}>
      <div className="pane-heading ui:flex ui:shrink-0 ui:items-center ui:justify-between ui:px-6"><h1 className="ui:m-0 ui:text-h3 ui:text-primary">{showCalls ? 'Calls' : 'Chats'}</h1>{showCalls
        ? <button className="icon-button add-button" type="button" aria-label="Start a new call" onClick={onNewCall}><Phone size={15} aria-hidden="true" /></button>
        : <button className="inbox-action ui:grid ui:shrink-0 ui:place-items-center ui:rounded-md ui:text-brand ui:bg-brand-soft ui:hover:bg-selected ui:cursor-pointer" type="button" aria-label="New conversation" onClick={onNewConversation}><Plus size={15} aria-hidden="true" /></button>}</div>
      {!showCalls && <>
        <button className="search-box ui:flex ui:shrink-0 ui:items-center ui:gap-4 ui:mx-6 ui:mb-4 ui:px-5 ui:rounded-md ui:bg-surface ui:text-secondary ui:text-left ui:hover:bg-hover ui:cursor-pointer ui:hover:text-primary" type="button" onClick={onOpenSearch}><Search size={13} aria-hidden="true" /><span className="ui:truncate ui:text-body-sm">Search people and chats</span><kbd className="ui:ml-auto ui:shrink-0 ui:text-caption ui:text-inherit ui:max-two-pane:hidden">Ctrl K</kbd></button>
        <div className="inbox-filters ui:flex ui:shrink-0 ui:items-center ui:gap-2 ui:mx-6 ui:mb-4" aria-label="Conversation filters">
          <button type="button" className={`ui:inline-flex ui:items-center ui:justify-center ui:flex-1 ui:gap-2 ui:px-4 ui:rounded-sm ui:bg-transparent ui:text-secondary ui:hover:bg-hover ui:hover:text-primary ui:[&.filter-active]:bg-selected ui:[&.filter-active]:text-primary${filter === 'all' && !showRequests ? ' filter-active' : ''}`} onClick={() => onSelectFilter('all')}>All</button>
          <button type="button" className={`ui:inline-flex ui:items-center ui:justify-center ui:flex-1 ui:gap-2 ui:px-4 ui:rounded-sm ui:bg-transparent ui:text-secondary ui:hover:bg-hover ui:hover:text-primary ui:[&.filter-active]:bg-selected ui:[&.filter-active]:text-primary${filter === 'unread' && !showRequests ? ' filter-active' : ''}`} onClick={() => onSelectFilter('unread')}>Unread</button>
          <button type="button" className={`ui:inline-flex ui:items-center ui:justify-center ui:flex-1 ui:gap-2 ui:px-4 ui:rounded-sm ui:bg-transparent ui:text-secondary ui:hover:bg-hover ui:hover:text-primary ui:[&.filter-active]:bg-selected ui:[&.filter-active]:text-primary${showRequests ? ' filter-active' : ''}`} onClick={onShowRequests}>Requests{requests.length > 0 && <span className="request-count ui:inline-grid ui:min-w-6 ui:h-6 ui:place-items-center ui:px-2 ui:rounded-full ui:bg-brand ui:text-brand-foreground ui:text-label">{requests.length}</span>}</button>
        </div>
      </>}
      <div className={showCalls ? 'chat-list' : 'chat-list inbox-chat-list ui:flex-1 ui:overflow-x-hidden ui:overflow-y-auto ui:py-4'}>
        {error && <div className={showCalls ? 'list-error' : 'list-error inbox-error ui:mx-6 ui:my-4 ui:px-5 ui:py-4 ui:rounded-md ui:bg-danger-soft ui:text-primary ui:text-body-sm'} role="alert">{error}</div>}
        {showCalls ? (
          callHistory.length === 0
            ? <div className="list-empty"><div className="empty-symbol"><Clock3 size={18} aria-hidden="true" /></div><p className="empty-title">No calls yet</p><p className="empty-copy">Your audio and video call history will appear here.</p><button type="button" onClick={onNewCall}><Phone size={14} aria-hidden="true" /> Start a call</button></div>
            : <div className="call-history-list">{callSections.map((section) => <section className="call-history-day" key={section.title}>
              <p className="list-section-label">{section.title}</p>
              {section.calls.map((call) => {
                const missed = callMissed(call)
                const CallDirection = missed ? PhoneMissed : call.caller_id === userId ? PhoneOutgoing : ArrowDownLeft
                const CallType = call.call_type === 'video' ? Video : Phone
                const duration = callDuration(call)
                const ongoing = call.status === 'active' || call.status === 'ringing'
                return <article className={`call-history-item${missed ? ' is-missed' : ''}`} key={call.id}>
                  <button className="call-history-open" type="button" onClick={() => onSelectCall(call.chat_id)} aria-label={`Open chat with ${callTitle(call)}`}>
                    <span className="call-history-avatar"><Avatar name={callTitle(call)} src={call.is_group ? undefined : call.other_avatar_url} /><CallDirection size={14} aria-hidden="true" /></span>
                    <span className="call-history-copy">
                      <strong>{callTitle(call)}</strong>
                      <small><CallDirection size={13} aria-hidden="true" /><span>{direction(call)} · {callStatus(call)}{duration ? ` · ${duration}` : ''}</span></small>
                    </span>
                    <time dateTime={call.created_at}>{new Date(call.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
                  </button>
                  <button className="call-history-again" type="button" disabled={ongoing} onClick={() => onCallAgain(call, call.call_type)} aria-label={ongoing ? `Call with ${callTitle(call)} is already in progress` : `Call ${callTitle(call)} again by ${call.call_type}`}>
                    <CallType size={17} aria-hidden="true" />
                  </button>
                </article>
              })}
            </section>)}</div>
        ) : showRequests ? (
          <div className="request-list-inline">
            {requests.length === 0 && <p>No message requests</p>}
            {requests.map((item) => <button className="chat-list-item ui:flex ui:w-full ui:min-h-9 ui:items-center ui:gap-5 ui:px-6 ui:py-4 ui:rounded-none ui:bg-transparent ui:text-primary ui:text-left ui:cursor-pointer ui:hover:bg-hover ui:[&.selected]:bg-selected ui:[&.selected]:border-l-brand ui:[&:is(:hover,.selected)_.chat-row-copy_small]:text-primary ui:[&:is(:hover,.selected)_.chat-row-meta]:text-primary" type="button" key={item.id} onClick={onSelectRequest}>
              <Avatar name={item.display_name} src={item.avatar_url} className="ui:bg-brand-soft ui:text-primary" /><span className="chat-row-copy ui:flex ui:flex-1 ui:flex-col ui:gap-1 ui:overflow-hidden"><strong className="ui:truncate ui:text-label ui:text-primary">{item.display_name}</strong><small className="ui:truncate ui:text-body-sm ui:text-secondary">Message request · @{item.username}</small></span><span className="unread-pill ui:shrink-0 ui:inline-grid ui:min-w-6 ui:h-6 ui:place-items-center ui:px-2 ui:rounded-full ui:bg-brand ui:text-brand-foreground ui:text-label">New</span>
            </button>)}
          </div>
        ) : visibleChats.length === 0 ? (
          <div className="list-empty inbox-empty-state ui:flex ui:h-full ui:flex-col ui:items-center ui:justify-center ui:p-6 ui:text-center"><div className="empty-symbol inbox-empty-symbol ui:grid ui:w-8 ui:h-8 ui:place-items-center ui:rounded-md ui:text-brand ui:bg-brand-soft"><ArrowUpRight size={18} aria-hidden="true" /></div><p className="empty-title inbox-empty-title ui:mt-5 ui:mb-2 ui:text-label ui:text-primary">{filter === 'unread' ? 'All caught up' : 'Your chats start here'}</p><p className="empty-copy inbox-empty-copy ui:text-body-sm ui:text-secondary">{filter === 'unread' ? 'No unread conversations.' : 'Start a private message or bring a few contacts into a group.'}</p><button className="inbox-empty-action ui:inline-flex ui:items-center ui:justify-center ui:gap-2 ui:mt-5 ui:px-5 ui:rounded-md ui:bg-brand ui:text-brand-foreground ui:hover:bg-brand-hover ui:cursor-pointer" type="button" onClick={onNewConversation}><Plus size={13} aria-hidden="true" /> New chat</button></div>
        ) : (
          <>
            <p className="list-section-label inbox-section-label ui:mx-6 ui:mt-5 ui:mb-3 ui:text-overline ui:text-secondary">DIRECT MESSAGES</p>
            {visibleChats.filter((chat) => chat.kind === 'direct').map((chat) => <ChatRow key={chat.id} chat={chat} draft={drafts[chat.id]} selected={activeChatId === chat.id} onSelect={onSelectChat} />)}
            <p className="list-section-label group-label inbox-section-label ui:mx-6 ui:mt-6 ui:mb-3 ui:text-overline ui:text-secondary">GROUPS</p>
            {visibleChats.filter((chat) => chat.kind === 'group').map((chat) => <ChatRow key={chat.id} chat={chat} draft={drafts[chat.id]} selected={activeChatId === chat.id} onSelect={onSelectChat} />)}
          </>
        )}
      </div>
      {!showCalls && <div className="inbox-footnote ui:flex ui:shrink-0 ui:items-center ui:gap-4 ui:px-6 ui:py-5 ui:text-caption ui:text-secondary"><span className={`status-dot${online ? '' : ' status-offline'}`} />{online ? 'Personal messages are end-to-end encrypted.' : 'Offline · queued messages send when connected.'}</div>}
    </aside>
  )
}
