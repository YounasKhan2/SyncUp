import { ArrowUpRight, Clock3, Plus, Search } from 'lucide-react'
import type { CallRecord, Chat, IncomingRequest } from '../../shared/types'
import { ChatRow } from './ChatRow'

type InboxPaneProps = {
  showCalls: boolean
  callHistory: CallRecord[]
  filter: 'all' | 'unread'
  showRequests: boolean
  requests: IncomingRequest[]
  error: string
  chats: Chat[]
  activeChatId: string | null
  online: boolean
  onSelectChat: (chatId: string) => void
  onSelectCall: (chatId: string) => void
  onSelectRequest: () => void
  onSelectFilter: (filter: 'all' | 'unread') => void
  onShowRequests: () => void
  onNewConversation: () => void
}

export function InboxPane({
  showCalls,
  callHistory,
  filter,
  showRequests,
  requests,
  error,
  chats,
  activeChatId,
  online,
  onSelectChat,
  onSelectCall,
  onSelectRequest,
  onSelectFilter,
  onShowRequests,
  onNewConversation,
}: InboxPaneProps) {
  const visibleChats = chats.filter((chat) => filter === 'all' || Number(chat.unread_count) > 0)

  return (
    <aside className="inbox-pane">
      <div className="pane-heading"><h1>{showCalls ? 'Calls' : 'Chats'}</h1>{!showCalls && <button className="icon-button add-button" type="button" aria-label="New conversation" onClick={onNewConversation}><Plus size={15} aria-hidden="true" /></button>}</div>
      {!showCalls && <>
        <div className="search-box"><Search size={13} aria-hidden="true" /><span>Find people by username</span></div>
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
            ? <div className="list-empty"><div className="empty-symbol"><Clock3 size={18} aria-hidden="true" /></div><p className="empty-title">No calls yet</p><p className="empty-copy">Audio and video calls with your contacts will appear here.</p></div>
            : <div className="call-history-list">{callHistory.map((call) => (
              <button className="call-history-item" type="button" key={call.id} onClick={() => onSelectCall(call.chat_id)}>
                <span className="avatar">{(call.other_name ?? '').slice(0, 1).toUpperCase()}</span>
                <span className="chat-row-copy"><strong>{call.other_name ?? 'Contact'}</strong><small>{call.status === 'declined' ? 'Declined' : call.status === 'ended' ? 'Completed' : call.end_reason ?? call.status} · {call.call_type === 'video' ? 'Video' : 'Audio'}</small></span>
                <time>{new Date(call.created_at).toLocaleDateString()}</time>
              </button>
            ))}</div>
        ) : showRequests ? (
          <div className="request-list-inline">
            {requests.length === 0 && <p>No message requests</p>}
            {requests.map((item) => <button className="chat-list-item" type="button" key={item.id} onClick={onSelectRequest}>
              <span className="avatar">{item.display_name.slice(0, 1).toUpperCase()}</span><span className="chat-row-copy"><strong>{item.display_name}</strong><small>Message request · @{item.username}</small></span><span className="unread-pill">New</span>
            </button>)}
          </div>
        ) : visibleChats.length === 0 ? (
          <div className="list-empty"><div className="empty-symbol"><ArrowUpRight size={18} aria-hidden="true" /></div><p className="empty-title">{filter === 'unread' ? 'All caught up' : 'Your chats start here'}</p><p className="empty-copy">{filter === 'unread' ? 'No unread conversations.' : 'Start a private message or bring a few contacts into a group.'}</p><button type="button" onClick={onNewConversation}><Plus size={13} aria-hidden="true" /> New chat</button></div>
        ) : (
          <>
            <p className="list-section-label">DIRECT MESSAGES</p>
            {visibleChats.filter((chat) => chat.kind === 'direct').map((chat) => <ChatRow key={chat.id} chat={chat} selected={activeChatId === chat.id} onSelect={onSelectChat} />)}
            <p className="list-section-label group-label">GROUPS</p>
            {visibleChats.filter((chat) => chat.kind === 'group').map((chat) => <ChatRow key={chat.id} chat={chat} selected={activeChatId === chat.id} onSelect={onSelectChat} />)}
          </>
        )}
      </div>
      {!showCalls && <div className="inbox-footnote"><span className={`status-dot${online ? '' : ' status-offline'}`} />{online ? 'Personal messages are end-to-end encrypted.' : 'Offline · queued messages send when connected.'}</div>}
    </aside>
  )
}
