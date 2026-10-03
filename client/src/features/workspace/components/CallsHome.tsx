import { Phone, Video } from 'lucide-react'

type CallsHomeProps = {
  onAudioCall: () => void
  onVideoCall: () => void
}

export function CallsHome({ onAudioCall, onVideoCall }: CallsHomeProps) {
  return (
    <section className="calls-home">
      <div className="calls-home-content">
        <span className="calls-home-icon"><Phone size={26} aria-hidden="true" /></span>
        <p className="eyebrow">PRIVATE CALLS</p>
        <h2>Hear from your people.</h2>
        <p>Start an encrypted audio or video call, or choose a recent call to return to that conversation.</p>
        <div className="calls-home-actions">
          <button className="calls-home-button" type="button" onClick={onAudioCall}><Phone size={16} aria-hidden="true" /> Audio call</button>
          <button className="calls-home-button is-video" type="button" onClick={onVideoCall}><Video size={16} aria-hidden="true" /> Video call</button>
        </div>
        <small>Calls are end-to-end encrypted.</small>
      </div>
    </section>
  )
}
