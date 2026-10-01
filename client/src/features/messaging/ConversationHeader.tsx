import { ArrowLeft, Phone, Search, Users, Video } from 'lucide-react'

type ConversationHeaderProps = {
  title: string
  subtitle: string
  isGroup: boolean
  callStarting: boolean
  online: boolean
  onManageGroup: () => void
  onSearchMessages: () => void
  onBack: () => void
  onStartCall: (type: 'audio' | 'video') => void
}

export function ConversationHeader({ title, subtitle, isGroup, callStarting, online, onBack, onManageGroup, onSearchMessages, onStartCall }: ConversationHeaderProps) {
  return (
    <header className="conversation-header">
      <div className="chat-title-group">
        <button className="mobile-back" type="button" aria-label="Back to chat list" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /></button>
        <span className="avatar chat-avatar">{title.slice(0, 1).toUpperCase()}</span>
        <div><div className="conversation-heading">{title}</div><div className="conversation-subheading">{subtitle}</div></div>
      </div>
      <div className="conversation-header-actions">
        <button type="button" className="call-action" onClick={onSearchMessages} aria-label="Search messages in this chat"><Search size={15} aria-hidden="true" /></button>
        {isGroup && <button type="button" className="call-action" onClick={onManageGroup} aria-label="Manage group members"><Users size={15} aria-hidden="true" /></button>}
        <>
          <button type="button" className="call-action" disabled={callStarting} onClick={() => onStartCall('audio')} aria-label="Start audio call"><Phone size={15} aria-hidden="true" /></button>
          <button type="button" className="call-action" disabled={callStarting} onClick={() => onStartCall('video')} aria-label="Start video call"><Video size={15} aria-hidden="true" /></button>
        </>
        <span className={`connection-status${online ? '' : ' offline'}`}><i />{online ? 'Synced' : 'Offline'}</span>
      </div>
    </header>
  )
}
