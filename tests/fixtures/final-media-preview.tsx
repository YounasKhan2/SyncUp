// Real VoiceRecorder/VoicePreview; silent synthesized WAV is playback evidence,
// not recorded hardware or upload/E2EE evidence. Nothing is sent to a backend.
import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../client/src/index.css'
import '../../client/src/App.css'
import { VoiceRecorder, VoicePreview } from '../../client/src/features/messaging/VoiceRecorder'
import type { VoiceDraft } from '../../client/src/features/messaging/VoiceRecorder'

const bytes = new ArrayBuffer(44 + 16000 * 2), view = new DataView(bytes)
const ascii = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)))
ascii(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); ascii(8, 'WAVE'); ascii(12, 'fmt ')
view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
view.setUint32(24, 8000, true); view.setUint32(28, 16000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
ascii(36, 'data'); view.setUint32(40, bytes.byteLength - 44, true)
const file = new File([bytes], 'silent-fixture.wav', { type: 'audio/wav' })
const seeded: VoiceDraft = { file, durationMs: 2000, waveform: [.1, .2, .3, .2, .1], url: URL.createObjectURL(file) }
function Preview() {
  const [draft, setDraft] = useState<VoiceDraft | null>(seeded), [action, setAction] = useState('none')
  useEffect(() => () => { URL.revokeObjectURL(seeded.url) }, [])
  return <main style={{ padding: 24, maxWidth: 500 }}>
    <h1>Final media browser smoke</h1>
    <p>Isolated controls; no transport or uploaded media.</p>
    <output aria-label="Browser recording capabilities">{JSON.stringify({ getUserMedia: Boolean(navigator.mediaDevices?.getUserMedia), MediaRecorder: typeof MediaRecorder !== 'undefined', AudioContext: typeof AudioContext !== 'undefined' })}</output>
    <VoiceRecorder disabled={false} onReady={value => { setDraft(value); setAction('recorded draft ready locally') }} />
    {draft && <VoicePreview draft={draft} disabled={false} onDelete={() => { setDraft(null); setAction('deleted locally') }} onSend={() => setAction('send callback only')} />}
    <output aria-label="Fixture action">{action}</output>
  </main>
}
createRoot(document.getElementById('root')!).render(<Preview />)
