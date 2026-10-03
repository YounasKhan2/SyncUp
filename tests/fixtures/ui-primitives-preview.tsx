// Real consumers, synthetic identity and explicit in-memory transport. Never contacts a backend.
import React, { useState } from 'react'
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
import { applyAppearancePreference, startAppearanceLifecycle } from '../../client/src/shared/appearance'
import type { AppearancePreference } from '../../client/src/shared/appearance'
import type { User } from '../../client/src/shared/types'

let finishRequest: (() => void) | undefined
window.fetch = async (input, init) => {
  const url = String(input)
  if (url === '/api/auth/sessions') return Response.json({ sessions: [], currentSessionId: 'preview' })
  if (url === '/api/blocks') return Response.json({ blockedUsers: [] })
  if (init?.method === 'POST' || init?.method === 'PATCH') {
    return new Promise<Response>((resolve) => { finishRequest = () => resolve(Response.json({ error: 'Isolated preview error' }, { status: 400 })) })
  }
  throw new Error(`Unsupported isolated request: ${url}`)
}
const stop = startAppearanceLifecycle()
const user = { id: 'preview', display_name: 'Sam Rivera', username: 'samrivera', email: 'sam@example.test', avatar_url: null } as User
const noop = () => {}

function Preview() {
  const [screen, setScreen] = useState('Auth')
  const [open, setOpen] = useState(true)
  const [appearance, setAppearance] = useState<AppearancePreference>('system')
  const [closed, setClosed] = useState(0)
  const [actions, setActions] = useState(0)
  const close = () => { setClosed((n) => n + 1); setOpen(false) }
  const theme = (value: AppearancePreference) => { setAppearance(value); applyAppearancePreference(value) }
  return <>
    <nav aria-label="Preview controls" style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 100, padding: 8,
      background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}>
      <select aria-label="Preview screen" value={screen} onChange={(e) => { setScreen(e.target.value); setOpen(true) }}>
        {['Auth', 'Unlock', 'Profile', 'Report', 'Native controls'].map((name) => <option key={name}>{name}</option>)}
      </select>
      <select aria-label="Preview theme" value={appearance} onChange={(e) => theme(e.target.value as AppearancePreference)}>
        {['system', 'light', 'dark'].map((name) => <option key={name}>{name}</option>)}
      </select>
      <button type="button" onClick={() => setOpen(true)}>Reopen dialog</button>
      <button type="button" onClick={() => { finishRequest?.(); finishRequest = undefined }}>Finish with error</button>
      <output aria-label="Close count">{closed}</output>
    </nav>
    {screen === 'Auth' && <AuthScreen onSignedIn={noop} />}
    {screen === 'Unlock' && <UnlockScreen onUnlocked={noop} />}
    {screen === 'Profile' && open && <AccountPanel user={user} appearance={appearance} onAppearanceChange={theme} onSaved={noop} onClose={close} />}
    {screen === 'Report' && open && <ReportDialog messageId="preview-message" onClose={close} />}
    {screen === 'Native controls' && <main style={{ padding: 40, maxWidth: 430 }}>
      <h1>Native activation probe</h1>
      <Button type="button" onClick={() => setActions((n) => n + 1)}>Enabled action</Button>
      <Button type="button" disabled onClick={() => setActions((n) => n + 1)}>Disabled action</Button>
      <IconButton type="button" aria-label="Enabled icon" title="Enabled icon" onClick={() => setActions((n) => n + 1)}><X size={15} aria-hidden="true" /></IconButton>
      <IconButton type="button" aria-label="Disabled icon" disabled onClick={() => setActions((n) => n + 1)}><X size={15} aria-hidden="true" /></IconButton>
      <output aria-label="Action count">{actions}</output>
    </main>}
  </>
}
const root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root')!)
if (import.meta.hot) import.meta.hot.data.root = root
root.render(<Preview />)
if (import.meta.hot) import.meta.hot.dispose(stop)
