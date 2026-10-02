import { Mic, Volume2 } from 'lucide-react'

// The parent owns permissions and construction of the voice-room call payload.
export function SpaceVoiceChannelView({ onJoin }: { onJoin: () => void }) {
  return <div className="space-voice-welcome">
    <span><Volume2 size={25} aria-hidden="true" /></span>
    <strong>Voice room is always here</strong>
    <p>Join to talk with people who have access to this channel. Up to 16 people can join.</p>
    <button className="primary-button" type="button" onClick={onJoin}><Mic size={14} aria-hidden="true" /> Join voice</button>
  </div>
}
