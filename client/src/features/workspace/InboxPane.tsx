import { ArrowDownLeft, ArrowUpRight, Clock3, Phone, PhoneMissed, PhoneOutgoing, Plus, Search, Video } from 'lucide-react'
import type { CallRecord, Chat, IncomingRequest } from '../../shared/types'
import { ChatRow } from './ChatRow'
import { Avatar } from '../../shared/components/Avatar'

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
    <aside className="inbox-pane">
      <div className="pane-heading"><h1>{showCalls ? 'Calls' : 'Chats'}</h1>{showCalls
        ? <button className="icon-button add-button" type="button" aria-label="Start a new call" onClick={onNewCall}><Phone size={15} aria-hidden="true" /></button>
        : <button className="icon-button add-button" type="button" aria-label="New conversation" onClick={onNewConversation}><Plus size={15} aria-hidden="true" /></button>}</div>
      {!showCalls && <>
        <button className="search-box" type="button" onClick={onOpenSearch}><Search size={13} aria-hidden="true" /><span>Search people and chats</span><kbd>Ctrl K</kbd></button>
        <div className="inbox-filters" aria-label="Conversation filters">
          <button type="button" className={filter === 'all' && !showRequests ? 'filter-active' : ''} onClick={() => onSelectFilter('all')}>All</button>
          <button type="button" className={filter === 'unread' && !showRequests ? 'filter-active' : ''} onClick={() => onSelectFilter('unread')}>Unread</button>
          <button type="button" className={showRequests ? 'filter-active' : ''} onClick={onShowRequests}>Requests{requests.length > 0 && <span className="request-count">{requests.length}</span>}</button>
        </div>
      </>}
      <div className="chat-list">
        {error && <div className="list-error" role="alert">{error}</div>}
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
            {requests.map((item) => <button className="chat-list-item" type="button" key={item.id} onClick={onSelectRequest}>
              <Avatar name={item.display_name} src={item.avatar_url} /><span className="chat-row-copy"><strong>{item.display_name}</strong><small>Message request · @{item.username}</small></span><span className="unread-pill">New</span>
            </button>)}
          </div>
        ) : visibleChats.length === 0 ? (
          <div className="list-empty"><div className="empty-symbol"><ArrowUpRight size={18} aria-hidden="true" /></div><p className="empty-title">{filter === 'unread' ? 'All caught up' : 'Your chats start here'}</p><p className="empty-copy">{filter === 'unread' ? 'No unread conversations.' : 'Start a private message or bring a few contacts into a group.'}</p><button type="button" onClick={onNewConversation}><Plus size={13} aria-hidden="true" /> New chat</button></div>
        ) : (
          <>
            <p className="list-section-label">DIRECT MESSAGES</p>
            {visibleChats.filter((chat) => chat.kind === 'direct').map((chat) => <ChatRow key={chat.id} chat={chat} draft={drafts[chat.id]} selected={activeChatId === chat.id} onSelect={onSelectChat} />)}
            <p className="list-section-label group-label">GROUPS</p>
            {visibleChats.filter((chat) => chat.kind === 'group').map((chat) => <ChatRow key={chat.id} chat={chat} draft={drafts[chat.id]} selected={activeChatId === chat.id} onSelect={onSelectChat} />)}
          </>
        )}
      </div>
      {!showCalls && <div className="inbox-footnote"><span className={`status-dot${online ? '' : ' status-offline'}`} />{online ? 'Personal messages are end-to-end encrypted.' : 'Offline · queued messages send when connected.'}</div>}
    </aside>
  )
}
