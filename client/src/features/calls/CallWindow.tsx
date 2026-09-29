import { Mic, MicOff, PhoneOff, Video, VideoOff } from 'lucide-react'
import type { RemoteParticipant, Room } from 'livekit-client'
import { useEffect, useRef, useState } from 'react'

async function callApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const run = () => fetch(path, {
    ...options,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  let response = await run()
  if (response.status === 401) {
    const refresh = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })
    if (refresh.ok) response = await run()
  }
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { error?: { message?: string } } | null
    throw new Error(result?.error?.message ?? 'Unable to connect this call.')
  }
  return response.json() as Promise<T>
}

export function CallWindow({ callId, title, video, onEnd }: {
  callId: string
  title: string
  video: boolean
  onEnd: () => void
}) {
  const mediaStage = useRef<HTMLDivElement>(null)
  const roomRef = useRef<Room | null>(null)
  const [muted, setMuted] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(video)
  const [connected, setConnected] = useState(false)
  const [peer, setPeer] = useState<{ id: string; name: string; microphoneEnabled: boolean; cameraEnabled: boolean } | null>(null)
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    let disconnect: (() => void) | null = null

    void (async () => {
      try {
        const { ParticipantEvent, Room, RoomEvent } = await import('livekit-client')
        if (cancelled) return
        const room = new Room({ adaptiveStream: true, dynacast: true })
        roomRef.current = room
        disconnect = () => { void room.disconnect() }
        const attach = (track: { attach: () => HTMLMediaElement }, identity: string, local = false) => {
          const element = track.attach()
          element.dataset.participant = identity
          element.autoplay = true
          if (element instanceof HTMLVideoElement) {
            element.playsInline = true
            element.muted = local
            element.className = `call-video-tile${local ? ' call-video-local' : ''}`
          } else if (element instanceof HTMLAudioElement) {
            element.className = 'call-audio-track'
          }
          mediaStage.current?.append(element)
        }
        const detach = (track: { detach: () => HTMLMediaElement[] }) => {
          for (const element of track.detach()) element.remove()
        }
        const syncPeer = (participant: RemoteParticipant) => {
          const update = () => setPeer({
            id: participant.identity,
            name: participant.name || participant.identity,
            microphoneEnabled: participant.isMicrophoneEnabled,
            cameraEnabled: participant.isCameraEnabled,
          })
          participant.on(ParticipantEvent.TrackMuted, update)
          participant.on(ParticipantEvent.TrackUnmuted, update)
          update()
        }
        room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => attach(track, participant.identity))
        room.on(RoomEvent.TrackUnsubscribed, detach)
        room.on(RoomEvent.ParticipantConnected, syncPeer)
        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          setPeer((current) => current?.id === participant.identity ? null : current)
        })
        room.on(RoomEvent.Disconnected, () => setConnected(false))
        const credentials = await callApi<{ url: string; token: string }>(`/api/calls/${callId}/token`, { method: 'POST' })
        if (cancelled) return
        await room.connect(credentials.url, credentials.token)
        if (cancelled) return
        for (const participant of room.remoteParticipants.values()) syncPeer(participant)
        await room.localParticipant.setMicrophoneEnabled(true)
        if (video) await room.localParticipant.setCameraEnabled(true)
        for (const publication of room.localParticipant.videoTrackPublications.values()) {
          if (publication.track) attach(publication.track, room.localParticipant.identity, true)
        }
        setConnected(true)
      } catch (connectionError) {
        if (!cancelled) setError(connectionError instanceof Error ? connectionError.message : 'Unable to join this call.')
      }
    })()

    return () => {
      cancelled = true
      disconnect?.()
      roomRef.current = null
    }
  }, [callId, video])

  useEffect(() => {
    let cancelled = false
    let finished = false
    const checkStatus = () => {
      callApi<{ status: string }>(`/api/calls/${callId}/status`)
        .then(({ status }) => {
          if (cancelled || finished || !['declined', 'missed', 'ended'].includes(status)) return
          finished = true
          setFinished(true)
          setConnected(false)
          setError(status === 'declined' ? 'The other person declined the call.' : status === 'missed' ? 'The call was missed.' : 'The other person ended the call.')
          void roomRef.current?.disconnect()
          roomRef.current = null
        })
        .catch((statusError: unknown) => {
          if (!cancelled) setError(statusError instanceof Error ? statusError.message : 'Unable to check call status.')
        })
    }
    const interval = window.setInterval(checkStatus, 4000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [callId])

  async function toggleMute() {
    const room = roomRef.current
    if (!room) return
    try {
      const next = !muted
      await room.localParticipant.setMicrophoneEnabled(!next)
      setMuted(next)
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to change microphone state.')
    }
  }

  async function toggleCamera() {
    const room = roomRef.current
    if (!room) return
    try {
      const next = !cameraEnabled
      await room.localParticipant.setCameraEnabled(next)
      setCameraEnabled(next)
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to change camera state.')
    }
  }

  return (
    <div className="overlay call-overlay" role="presentation">
      <section className="call-dialog" role="dialog" aria-modal="true" aria-label={`${video ? 'Video' : 'Audio'} call with ${title}`}>
        <header className="call-dialog-header">
          <div><span className="eyebrow">1:1 CALL · NOT END-TO-END ENCRYPTED</span><h2>{title}</h2></div>
          <span className={`call-connection${peer ? ' is-connected' : ''}`}><i />{connected ? peer ? `${peer.name} joined` : `Waiting for ${title} to join` : 'Joining call…'}</span>
        </header>
        <div className={`call-media-stage${video ? '' : ' audio-only'}`} ref={mediaStage}>
          {!connected && !error && <p>Connecting to the call service…</p>}
          {connected && !peer && !error && <p className="call-waiting">Waiting for {title} to join…</p>}
          {peer && (!video || !peer.cameraEnabled) && (
            <div className="call-peer-status">
              <strong>{peer.name}</strong>
              <span>{!peer.cameraEnabled && <><VideoOff size={13} aria-hidden="true" /> Camera off</>}{!peer.microphoneEnabled && <><MicOff size={13} aria-hidden="true" /> Mic muted</>}</span>
            </div>
          )}
          {video && !cameraEnabled && <p className="call-local-camera-status"><VideoOff size={13} aria-hidden="true" /> Your camera is off</p>}
          {error && <p className="call-error" role="alert">{error}</p>}
        </div>
        <footer className="call-controls">
          <button type="button" onClick={() => void toggleMute()} disabled={!connected} aria-pressed={muted} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'}>{muted ? <MicOff size={15} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}{muted ? 'Unmute' : 'Mute'}</button>
          {video && <button type="button" onClick={() => void toggleCamera()} disabled={!connected} aria-pressed={!cameraEnabled} aria-label={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}>{cameraEnabled ? <Video size={15} aria-hidden="true" /> : <VideoOff size={15} aria-hidden="true" />}{cameraEnabled ? 'Camera on' : 'Camera off'}</button>}
          <button type="button" className="call-end-button" onClick={onEnd}>{finished ? 'Close' : <><PhoneOff size={14} aria-hidden="true" /> End call</>}</button>
        </footer>
      </section>
    </div>
  )
}
