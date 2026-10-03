import { FileText, Hash, LockKeyhole, Megaphone, Mic, Search, Settings2, Volume2 } from 'lucide-react'
import type { SpaceChannel } from '../types'

type SpaceChannelHeaderProps = {
  channelName: string
  channelType: SpaceChannel['type']
  topic: string
  spaceName: string
  canEdit: boolean
  onSearch: () => void
  onFiles: () => void
  onEdit: () => void
  onJoinVoice: () => void
}

export function SpaceChannelHeader({ channelName, channelType, topic, spaceName, canEdit, onSearch, onFiles, onEdit, onJoinVoice }: SpaceChannelHeaderProps) {
  return (
    <header className="space-channel-header"><div>
              <span>{channelType === 'announcement' ? <Megaphone size={16} aria-hidden="true" /> : channelType === 'private' ? <LockKeyhole size={16} aria-hidden="true" /> : channelType === 'voice' ? <Volume2 size={16} aria-hidden="true" /> : <Hash size={16} aria-hidden="true" />}{channelName}</span>
              <small>{topic || (channelType === 'announcement' ? 'Only Space moderators can post here' : channelType === 'private' ? 'Private channel' : channelType === 'voice' ? 'Persistent voice room · up to 16 people' : 'Visible to invited members')}</small>
            </div>
            <div className="space-channel-actions">
              {channelType !== 'voice' && <>
                <button className="space-topic-edit" type="button" onClick={onSearch} aria-label={`Search ${spaceName}`} title="Search this Space"><Search size={14} aria-hidden="true" /><span>Search</span></button>
                <button className="space-topic-edit" type="button" onClick={onFiles} aria-label={`Files in ${channelName}`} title="Channel files"><FileText size={14} aria-hidden="true" /><span>Files</span></button>
              </>}
              {canEdit && <button className="space-topic-edit" type="button" onClick={onEdit}><Settings2 size={13} aria-hidden="true" /> Edit channel</button>}
              {channelType === 'voice' && <button className="space-topic-edit" type="button" onClick={onJoinVoice}><Mic size={13} aria-hidden="true" /> Join voice</button>}
            </div>
            </header>
  )
}
