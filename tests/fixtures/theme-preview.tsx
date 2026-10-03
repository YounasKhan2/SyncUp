// Test-only visual harness. Real Auth/Unlock components; representative shell markup.
// No authenticated product flow, backend, worker, or database is exercised.
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../client/src/index.css'
import '../../client/src/App.css'
import { AuthScreen } from '../../client/src/features/auth/AuthScreen'
import { UnlockScreen } from '../../client/src/features/auth/UnlockScreen'
import { WorkspaceRail } from '../../client/src/features/workspace/components/WorkspaceRail'
import { applyAppearancePreference, saveAppearancePreference, startAppearanceLifecycle } from '../../client/src/shared/appearance'
import type { AppearancePreference } from '../../client/src/shared/appearance'
import type { User } from '../../client/src/shared/types'

window.fetch = async () => { throw new Error('Network disabled in isolated theme preview') }
const stop = startAppearanceLifecycle()
if (import.meta.hot) import.meta.hot.dispose(stop)
const user = { id: 'preview', display_name: 'Sam Rivera', avatar_url: null } as User
const noop = () => {}

function Preview() {
  const [screen, setScreen] = useState('Auth')
  const [settings, setSettings] = useState(false)
  const [active, setActive] = useState(true)
  return <>
    <nav aria-label="Preview controls" style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 100,
      padding: 8, background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}>
      <span>Isolated preview </span>
      <select aria-label="Preview screen" value={screen} onChange={(e) => { setScreen(e.target.value); setSettings(false) }}>
        {['Auth', 'Unlock', 'Shell', 'Spaces'].map((name) => <option key={name}>{name}</option>)}
      </select>
      <select aria-label="Preview theme" defaultValue="system" onChange={(e) => {
        const mode = e.target.value as AppearancePreference
        saveAppearancePreference(mode); applyAppearancePreference(mode)
      }}>{['system', 'light', 'dark'].map((name) => <option key={name}>{name}</option>)}</select>
    </nav>
    {screen === 'Auth' ? <AuthScreen onSignedIn={noop} /> : screen === 'Unlock' ? <UnlockScreen onUnlocked={noop} /> :
      <main className={`workspace${screen === 'Spaces' ? ' has-active-space' : active ? ' has-active-chat' : ''}`}>
        <WorkspaceRail user={user} showCalls={false} showUpdates={false} showSpaces={screen === 'Spaces'} unreadConversationCount={1}
          onShowChats={() => setScreen('Shell')} onShowCalls={noop} onShowUpdates={noop} onShowSpaces={() => setScreen('Spaces')} onOpenAccount={() => setSettings(true)} />
        {screen === 'Spaces' ? <section className="spaces-page"><header className="spaces-topbar"><div><p className="eyebrow">SPACES</p><h1>Design team</h1></div></header>
          <div className="space-work-area"><aside className="space-sidebar"><header className="space-server-header"><div><strong>Design team</strong><small>3 channels</small></div></header><button className="space-channel is-active"># general</button></aside>
            <div><header className="space-channel-header"><div><span># general</span><small>Team discussions</small></div></header><div className="spaces-intro"><h2>Welcome to general</h2><p>Representative Spaces styling fixture.</p><button className="primary-button">New shared item</button></div></div></div></section> : <>
          <aside className="inbox-pane"><header className="pane-heading"><h1>Chats</h1></header><div className="search-box">Search conversations</div>
            <div className="inbox-filters"><button className="filter-active">All</button><button>Unread</button></div>
            <button className="chat-list-item selected" onClick={() => setActive(true)}><span className="chat-row-copy"><strong>Alex Chen</strong><small>See you tomorrow</small></span><span className="chat-row-meta"><b>1</b></span></button>
            <button className="chat-list-item"><span className="chat-row-copy"><strong>Project team</strong><small>Review complete</small></span></button></aside>
          <section className="conversation-pane"><header className="conversation-header"><button className="icon-button" onClick={() => setActive(false)}>Back</button><strong className="conversation-heading">Alex Chen</strong></header>
            <div className="message-list"><div className="message-row"><div className="message-content"><div className="message-bubble"><p>Can we review the proposal tomorrow?</p><span className="message-time">10:42</span></div></div></div>
              <div className="message-row message-mine"><div className="message-content"><div className="message-bubble"><p>Yes, the updated draft is ready.</p><span className="message-time">10:43</span></div></div></div>
              <p className="form-error">Preview error state; no request was sent.</p><p className="form-success">Preview success state.</p></div>
            <div className="message-composer"><textarea placeholder="Write a message" /><div className="composer-toolbar"><button className="composer-send-button" disabled>Send</button></div></div></section>
        </>}
      </main>}
    {settings && <div className="overlay"><section className="account-dialog"><h2>Account settings</h2><p className="appearance-caption">Representative settings fixture</p><form className="profile-form"><label><span>Display name</span><input defaultValue="Sam Rivera" /></label><label><span>Appearance</span><select defaultValue="system"><option>system</option><option>light</option><option>dark</option></select></label></form><button className="primary-button" onClick={() => setSettings(false)}>Done</button></section></div>}
  </>
}
const root = createRoot(document.getElementById('root')!)
root.render(<Preview />)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
