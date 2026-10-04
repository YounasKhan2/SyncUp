import { ArrowLeft, Phone, Search, Video } from 'lucide-react'
import { Avatar } from '../../../shared/components/Avatar'

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
    <header className="conversation-header ui:bg-surface ui:text-primary ui:border-default">
      <div className="chat-title-group ui:flex ui:items-center ui:gap-3">
        <button className="mobile-back ui:text-secondary ui:bg-transparent ui:rounded-md ui:hover:bg-hover" type="button" aria-label="Back to chat list" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /></button>
        <button className="conversation-identity-button ui:text-primary ui:bg-transparent ui:rounded-md" type="button" onClick={onOpenDetails} disabled={!canOpenDetails} aria-label={`Open details for ${title}`}>
          <Avatar name={title} src={avatarUrl} className="chat-avatar ui:bg-brand-soft ui:text-primary" />
          <span><span className="conversation-heading ui:text-label ui:text-primary ui:truncate">{title}</span><span className="conversation-subheading ui:text-caption ui:text-secondary ui:truncate">{subtitle}</span></span>
        </button>
      </div>
      <div className="conversation-header-actions ui:flex ui:items-center ui:gap-2">
        <button type="button" className="call-action ui:grid ui:place-items-center ui:rounded-md ui:text-secondary ui:bg-transparent ui:hover:bg-hover ui:hover:text-primary" onClick={onSearchMessages} aria-label="Search messages in this chat"><Search size={15} aria-hidden="true" /></button>
        <>
          <button type="button" className="call-action ui:grid ui:place-items-center ui:rounded-md ui:text-secondary ui:bg-transparent ui:hover:bg-hover ui:hover:text-primary" disabled={callStarting} onClick={() => onStartCall('audio')} aria-label="Start audio call"><Phone size={15} aria-hidden="true" /></button>
          <button type="button" className="call-action ui:grid ui:place-items-center ui:rounded-md ui:text-secondary ui:bg-transparent ui:hover:bg-hover ui:hover:text-primary" disabled={callStarting} onClick={() => onStartCall('video')} aria-label="Start video call"><Video size={15} aria-hidden="true" /></button>
        </>
        <span className={`connection-status ui:text-caption ui:text-secondary${online ? '' : ' offline'}`}><i />{online ? 'Synced' : 'Offline'}</span>
      </div>
    </header>
  )
}
