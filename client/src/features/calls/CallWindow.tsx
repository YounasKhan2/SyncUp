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

type CallParticipant = {
  id: string
  name: string
  microphoneEnabled: boolean
  cameraEnabled: boolean
}

export function CallWindow({ callId, title, video, isGroup = false, isHost = false, e2eeKey, isVoiceRoom = false, voiceSpaceId, voiceChannelId, canPublish = true, onEnd, onClose }: {
  callId: string
  title: string
  video: boolean
  isGroup?: boolean
  isHost?: boolean
  e2eeKey?: Uint8Array
  isVoiceRoom?: boolean
  voiceSpaceId?: string
  voiceChannelId?: string
  canPublish?: boolean
  onEnd: () => void
  onClose: () => void
}) {
  const mediaStage = useRef<HTMLDivElement>(null)
  const roomRef = useRef<Room | null>(null)
  const encryptionWorkerRef = useRef<Worker | null>(null)
  const [muted, setMuted] = useState(false)
  const [cameraEnabled, setCameraEnabled] = useState(video)
  const [connected, setConnected] = useState(false)
  const [localIdentity, setLocalIdentity] = useState('')
  const [peers, setPeers] = useState<Record<string, CallParticipant>>({})
  const [groupRoster, setGroupRoster] = useState<{ user_id: string; display_name: string; status: string }[]>([])
  const [voiceRoster, setVoiceRoster] = useState<{ user_id: string; display_name: string; can_speak: boolean }[]>([])
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState('')
  const peer = Object.values(peers)[0] ?? null

  useEffect(() => {
    let cancelled = false
    let disconnect: (() => void) | null = null
    let encryptionWorker: Worker | null = null

    void (async () => {
      try {
        const { ExternalE2EEKeyProvider, isE2EESupported, ParticipantEvent, Room, RoomEvent } = await import('livekit-client')
        if (cancelled) return
        let roomOptions: ConstructorParameters<typeof Room>[0] = { adaptiveStream: true, dynacast: true }
        if (isGroup) {
          if (!e2eeKey || !isE2EESupported()) {
            throw new Error('This browser cannot securely encrypt group-call media.')
          }
          const keyProvider = new ExternalE2EEKeyProvider()
          await keyProvider.setKey(e2eeKey.slice().buffer)
          encryptionWorker = new Worker(new URL('livekit-client/e2ee-worker', import.meta.url), { type: 'module' })
          encryptionWorkerRef.current = encryptionWorker
          roomOptions = {
            ...roomOptions,
            encryption: { keyProvider, worker: encryptionWorker },
          }
        }
        const room = new Room(roomOptions)
        if (isGroup) await room.setE2EEEnabled(true)
        roomRef.current = room
        disconnect = () => {
          void room.disconnect()
          encryptionWorkerRef.current?.terminate()
          encryptionWorkerRef.current = null
          encryptionWorker = null
        }
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
        const syncedParticipants = new Set<string>()
        const syncPeer = (participant: RemoteParticipant) => {
          const update = () => setPeers((current) => ({
            ...current,
            [participant.identity]: {
              id: participant.identity,
              name: participant.name || participant.identity,
              microphoneEnabled: participant.isMicrophoneEnabled,
              cameraEnabled: participant.isCameraEnabled,
            },
          }))
          if (!syncedParticipants.has(participant.identity)) {
            participant.on(ParticipantEvent.TrackMuted, update)
            participant.on(ParticipantEvent.TrackUnmuted, update)
            syncedParticipants.add(participant.identity)
          }
          update()
        }
        room.on(RoomEvent.TrackSubscribed, (track, _publication, participant) => {
          attach(track, participant.identity)
          syncPeer(participant)
        })
        room.on(RoomEvent.TrackUnsubscribed, detach)
        room.on(RoomEvent.ParticipantConnected, syncPeer)
        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          syncedParticipants.delete(participant.identity)
          setPeers((current) => {
            const next = { ...current }
            delete next[participant.identity]
            return next
          })
        })
        room.on(RoomEvent.Disconnected, () => setConnected(false))
        if (isGroup) {
          room.on(RoomEvent.EncryptionError, (encryptionError) => {
            setError(`Group-call encryption failed: ${encryptionError.message}`)
            setConnected(false)
            setFinished(true)
            e2eeKey?.fill(0)
            void room.disconnect()
            encryptionWorkerRef.current?.terminate()
            encryptionWorkerRef.current = null
            void callApi(`/api/group-calls/${callId}/${isHost ? 'end' : 'leave'}`, { method: 'POST' })
              .catch((leaveError: unknown) => {
                setError(`Group-call encryption failed, and ending your call participation also failed: ${leaveError instanceof Error ? leaveError.message : 'unknown error'}`)
              })
          })
        }
        const credentialsPath = isVoiceRoom && voiceSpaceId && voiceChannelId
          ? `/api/spaces/${voiceSpaceId}/channels/${voiceChannelId}/voice/token`
          : `/api/${isGroup ? 'group-calls' : 'calls'}/${callId}/token`
        const credentials = await callApi<{ url: string; token: string }>(credentialsPath, { method: 'POST' })
        if (cancelled) return
        await room.connect(credentials.url, credentials.token)
        if (cancelled) return
        setLocalIdentity(room.localParticipant.identity)
        for (const participant of room.remoteParticipants.values()) syncPeer(participant)
        await room.localParticipant.setMicrophoneEnabled(!isVoiceRoom || canPublish)
        if (video) await room.localParticipant.setCameraEnabled(true)
        for (const publication of room.localParticipant.videoTrackPublications.values()) {
          if (publication.track) attach(publication.track, room.localParticipant.identity, true)
        }
        setConnected(true)
      } catch (connectionError) {
        encryptionWorker?.terminate()
        encryptionWorkerRef.current?.terminate()
        encryptionWorkerRef.current = null
        encryptionWorker = null
        if (!cancelled) {
          const message = connectionError instanceof Error ? connectionError.message : 'Unable to join this call.'
          setError(message)
          if (isGroup) {
            setFinished(true)
            e2eeKey?.fill(0)
            void callApi(`/api/group-calls/${callId}/${isHost ? 'end' : 'leave'}`, { method: 'POST' })
              .catch((leaveError: unknown) => {
                setError(`${message} Unable to end your group-call participation: ${leaveError instanceof Error ? leaveError.message : 'unknown error'}`)
              })
          }
        }
      }
    })()

    return () => {
      cancelled = true
      disconnect?.()
      encryptionWorkerRef.current?.terminate()
      encryptionWorkerRef.current = null
      e2eeKey?.fill(0)
      roomRef.current = null
    }
  }, [callId, video, isGroup, isHost, e2eeKey, isVoiceRoom, voiceSpaceId, voiceChannelId, canPublish])

  useEffect(() => {
    if (isVoiceRoom || !callId) return
    let cancelled = false
    let finished = false
    const checkStatus = () => {
      callApi<{ status: string; participants?: { user_id: string; display_name: string; status: string }[] }>(`/api/${isGroup ? 'group-calls' : 'calls'}/${callId}/status`)
        .then(({ status, participants }) => {
          if (isGroup && participants) setGroupRoster(participants.map((participant) => ({
            user_id: participant.user_id,
            display_name: participant.display_name,
            status: participant.status,
          })))
          if (cancelled || finished || !['declined', 'missed', 'ended'].includes(status)) return
          finished = true
          setFinished(true)
          setConnected(false)
          setError(status === 'declined' ? 'The other person declined the call.' : status === 'missed' ? 'The call was missed.' : 'The other person ended the call.')
          void roomRef.current?.disconnect()
          roomRef.current = null
          e2eeKey?.fill(0)
          encryptionWorkerRef.current?.terminate()
          encryptionWorkerRef.current = null
        })
        .catch((statusError: unknown) => {
          if (cancelled) return
          if (isGroup && statusError instanceof Error && statusError.message === 'Group call not found.') {
            finished = true
            setFinished(true)
            setConnected(false)
            e2eeKey?.fill(0)
            void roomRef.current?.disconnect()
            roomRef.current = null
            encryptionWorkerRef.current?.terminate()
            encryptionWorkerRef.current = null
            return
          }
          setError(statusError instanceof Error ? statusError.message : 'Unable to check call status.')
        })
    }
    checkStatus()
    const interval = window.setInterval(checkStatus, 4000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [callId, isGroup, e2eeKey, isVoiceRoom])

  useEffect(() => {
    if (!isVoiceRoom || !voiceSpaceId || !voiceChannelId) return
    let cancelled = false
    const refreshRoster = () => callApi<{ participants: typeof voiceRoster }>(
      `/api/spaces/${voiceSpaceId}/channels/${voiceChannelId}/voice`,
    ).then(({ participants }) => {
      if (!cancelled) setVoiceRoster(participants)
    }).catch((rosterError: unknown) => {
      if (cancelled) return
      const message = rosterError instanceof Error ? rosterError.message : 'Unable to refresh voice room access.'
      setError(message)
      if (/not found/iu.test(message)) {
        setFinished(true)
        setConnected(false)
        void roomRef.current?.disconnect()
        roomRef.current = null
      }
    })
    void refreshRoster()
    const interval = window.setInterval(() => { void refreshRoster() }, 5000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [isVoiceRoom, voiceSpaceId, voiceChannelId])

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
      <section className="call-dialog" role="dialog" aria-modal="true" aria-label={isVoiceRoom ? `Voice room ${title}` : `${video ? 'Video' : 'Audio'} call with ${title}`}>
        <header className="call-dialog-header">
          <div><span className="eyebrow">{isVoiceRoom ? 'SPACE VOICE ROOM · NOT END-TO-END ENCRYPTED' : isGroup ? 'GROUP CALL · END-TO-END ENCRYPTED' : '1:1 CALL · NOT END-TO-END ENCRYPTED'}</span><h2>{title}</h2></div>
          <span className={`call-connection${connected && (isVoiceRoom ? voiceRoster.length > 0 : isGroup ? groupRoster.some((participant) => participant.status === 'joined') : Boolean(peer)) ? ' is-connected' : ''}`}><i />{connected ? isVoiceRoom ? `${Math.max(voiceRoster.length, 1)} in room` : isGroup ? `${groupRoster.filter((participant) => participant.status === 'joined').length} joined` : peer ? `${peer.name} joined` : `Waiting for ${title} to join` : 'Joining call…'}</span>
        </header>
        <div className={`call-media-stage${video ? '' : ' audio-only'}`} ref={mediaStage}>
          {!connected && !error && <p>Connecting to the call service…</p>}
          {connected && isVoiceRoom && voiceRoster.length <= 1 && !error && <p className="call-waiting">You’re in the room. Others can join anytime.</p>}
          {connected && isGroup && groupRoster.every((participant) => participant.user_id === localIdentity || participant.status !== 'joined') && !error && <p className="call-waiting">Waiting for group members to join…</p>}
          {connected && !isGroup && !peer && !error && <p className="call-waiting">Waiting for {title} to join…</p>}
          {!isGroup && peer && (!video || !peer.cameraEnabled) && (
            <div className="call-peer-status">
              <strong>{peer.name}</strong>
              <span>{!peer.cameraEnabled && <><VideoOff size={13} aria-hidden="true" /> Camera off</>}{!peer.microphoneEnabled && <><MicOff size={13} aria-hidden="true" /> Mic muted</>}</span>
            </div>
          )}
          {isVoiceRoom && voiceRoster.filter((participant) => participant.user_id !== localIdentity).map((participant) => (
            <div className="call-group-participant" key={participant.user_id}>
              <strong>{participant.display_name}</strong>
              <span>{participant.can_speak ? 'Can speak' : 'Listening'}</span>
            </div>
          ))}
          {isGroup && groupRoster.filter((participant) => participant.status === 'joined' && participant.user_id !== localIdentity).map((participant) => (
            <div className="call-group-participant" key={participant.user_id}>
              <strong>{participant.display_name}</strong>
              <span>{peers[participant.user_id]?.cameraEnabled ? 'Camera on' : 'Camera off'} · {peers[participant.user_id]?.microphoneEnabled === false ? 'Mic muted' : 'Mic on'}</span>
            </div>
          ))}
          {video && !cameraEnabled && <p className="call-local-camera-status"><VideoOff size={13} aria-hidden="true" /> Your camera is off</p>}
          {error && <p className="call-error" role="alert">{error}</p>}
        </div>
        {isVoiceRoom && <div className="call-participant-list" aria-label="Voice room participants">
          {voiceRoster.map((participant) => <span key={participant.user_id}>{participant.display_name}{participant.user_id === localIdentity ? ' · you' : ''}{participant.can_speak ? '' : ' · listening'}</span>)}
        </div>}
        {isGroup && <div className="call-participant-list" aria-label="Group call participants">
          {groupRoster.map((participant) => (
            <span key={participant.user_id}>{participant.display_name} · {participant.status}</span>
          ))}
        </div>}
        <footer className="call-controls">
          <button type="button" onClick={() => void toggleMute()} disabled={!connected || (isVoiceRoom && !canPublish)} aria-pressed={muted || (isVoiceRoom && !canPublish)} aria-label={isVoiceRoom && !canPublish ? 'You can listen but cannot speak' : muted ? 'Unmute microphone' : 'Mute microphone'}>{muted || (isVoiceRoom && !canPublish) ? <MicOff size={15} aria-hidden="true" /> : <Mic size={15} aria-hidden="true" />}{isVoiceRoom && !canPublish ? 'Listening only' : muted ? 'Unmute' : 'Mute'}</button>
          {video && <button type="button" onClick={() => void toggleCamera()} disabled={!connected} aria-pressed={!cameraEnabled} aria-label={cameraEnabled ? 'Turn camera off' : 'Turn camera on'}>{cameraEnabled ? <Video size={15} aria-hidden="true" /> : <VideoOff size={15} aria-hidden="true" />}{cameraEnabled ? 'Camera on' : 'Camera off'}</button>}
          <button type="button" className="call-end-button" onClick={finished ? onClose : onEnd}>{finished ? 'Close' : <><PhoneOff size={14} aria-hidden="true" /> {isVoiceRoom || (isGroup && !isHost) ? 'Leave room' : 'End call'}</>}</button>
        </footer>
      </section>
    </div>
  )
}
