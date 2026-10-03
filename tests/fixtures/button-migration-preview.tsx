import React, { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../client/src/index.css'
import '../../client/src/App.css'
import { AuthScreen } from '../../client/src/features/auth/AuthScreen'
import { UnlockScreen } from '../../client/src/features/auth/UnlockScreen'
import { AccountPanel } from '../../client/src/features/account/AccountPanel'
import { ReportDialog } from '../../client/src/features/messaging/components/ReportDialog'
import { Button } from '../../client/src/shared/components/Button'
import { IconButton } from '../../client/src/shared/components/IconButton'
import { X } from 'lucide-react'
import { applyAppearancePreference } from '../../client/src/shared/appearance'
import type { AppearancePreference } from '../../client/src/shared/appearance'
import type { User } from '../../client/src/shared/types'

const params = new URLSearchParams(location.search), scene = params.get('scene') ?? 'native'
const appearance = (params.get('theme') ?? 'light') as AppearancePreference
applyAppearancePreference(appearance)
window.fetch = async input => {
  if (String(input) === '/api/auth/sessions') return Response.json({ sessions: [], currentSessionId: 'preview' })
  if (String(input) === '/api/blocks') return Response.json({ blockedUsers: [] })
  return new Promise<Response>(() => {}) // Busy-state probe; no backend requests.
}
const noop = () => {}, user = { id: 'preview', display_name: 'Sam Rivera', username: 'samrivera', email: 'sam@example.test', avatar_url: null } as User
function NativeProbe() {
  const [clicks, setClicks] = useState(0), [submits, setSubmits] = useState(0), [bubbles, setBubbles] = useState(0)
  const button = useRef<HTMLButtonElement>(null), icon = useRef<HTMLButtonElement>(null)
  return <main style={{ padding: 24, maxWidth: 430 }} onClick={() => setBubbles(n => n + 1)}>
    <h1>Native button contract</h1>
    <a href="#probe" id="start">Keyboard start</a>
    <form id="probe" onSubmit={event => { event.preventDefault(); setSubmits(n => n + 1) }}>
      <Button id="default" ref={button} name="intent" value="default" data-contract="forwarded" aria-describedby="hint" onClick={() => setClicks(n => n + 1)}>Default submit<span aria-hidden="true">→</span></Button>
      <Button id="explicit" type="button" onClick={() => setClicks(n => n + 1)}>Explicit button</Button>
      <Button id="submit" type="submit" onClick={() => setClicks(n => n + 1)}>Explicit submit</Button>
      <Button id="disabled" type="submit" disabled onClick={() => setClicks(n => n + 1)}>Disabled action</Button>
      <IconButton id="icon" ref={icon} type="button" aria-label="Enabled icon" title="Enabled icon" onClick={() => setClicks(n => n + 1)}><X size={15} aria-hidden="true" /></IconButton>
      <IconButton id="disabled-icon" type="button" aria-label="Disabled icon" disabled onClick={() => setClicks(n => n + 1)}><X size={15} aria-hidden="true" /></IconButton>
    </form>
    <p id="hint">Native default and explicit types</p>
    <output id="counts">{JSON.stringify({ clicks, submits, bubbles })}</output>
    <button id="inspect-refs" type="button" onClick={() => {
      document.getElementById('refs')!.textContent = JSON.stringify({ button: button.current?.tagName, buttonId: button.current?.id, icon: icon.current?.tagName, iconId: icon.current?.id })
    }}>Inspect refs</button><output id="refs" />
  </main>
}
createRoot(document.getElementById('root')!).render(scene === 'auth' ? <AuthScreen onSignedIn={noop} /> : scene === 'unlock' ? <UnlockScreen onUnlocked={noop} /> : scene === 'profile' ? <AccountPanel user={user} appearance={appearance} onAppearanceChange={noop} onClose={noop} onSaved={noop} /> : scene === 'report' ? <ReportDialog messageId="preview" onClose={noop} /> : <NativeProbe />)
document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(() => { document.documentElement.dataset.visualReady = 'true' })))
