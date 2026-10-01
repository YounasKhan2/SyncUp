import { ArrowLeft, Phone, Search, Video } from 'lucide-react'
import { Avatar } from '../../shared/components/Avatar'

type ConversationHeaderProps = {
  title: string
  avatarUrl?: string | null
  subtitle: string
  canOpenDetails: boolean
  callStarting: boolean
  online: boolean
  onOpenDetails: () => void
  onSearchMessages: () => void
  onBack: () => void
  onStartCall: (type: 'audio' | 'video') => void
}

export function ConversationHeader({ title, avatarUrl, subtitle, canOpenDetails, callStarting, online, onOpenDetails, onBack, onSearchMessages, onStartCall }: ConversationHeaderProps) {
  return (
    <header className="conversation-header">
      <div className="chat-title-group">
        <button className="mobile-back" type="button" aria-label="Back to chat list" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /></button>
        <button className="conversation-identity-button" type="button" onClick={onOpenDetails} disabled={!canOpenDetails} aria-label={`Open details for ${title}`}>
          <Avatar name={title} src={avatarUrl} className="chat-avatar" />
          <span><span className="conversation-heading">{title}</span><span className="conversation-subheading">{subtitle}</span></span>
        </button>
      </div>
      <div className="conversation-header-actions">
        <button type="button" className="call-action" onClick={onSearchMessages} aria-label="Search messages in this chat"><Search size={15} aria-hidden="true" /></button>
        <>
          <button type="button" className="call-action" disabled={callStarting} onClick={() => onStartCall('audio')} aria-label="Start audio call"><Phone size={15} aria-hidden="true" /></button>
          <button type="button" className="call-action" disabled={callStarting} onClick={() => onStartCall('video')} aria-label="Start video call"><Video size={15} aria-hidden="true" /></button>
        </>
        <span className={`connection-status${online ? '' : ' offline'}`}><i />{online ? 'Synced' : 'Offline'}</span>
      </div>
    </header>
  )
}
