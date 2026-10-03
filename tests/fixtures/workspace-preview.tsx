// Test-only fixture: real navigation hook, rail, inbox, mobile nav and extracted
// presentation. No Workspace runtime effects, API, persistence, crypto or Calls.
import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../client/src/index.css'
import '../../client/src/App.css'
import { useWorkspaceNavigation } from '../../client/src/features/workspace/hooks/useWorkspaceNavigation'
import { WorkspaceRail } from '../../client/src/features/workspace/components/WorkspaceRail'
import { InboxPane } from '../../client/src/features/workspace/components/InboxPane'
import { MobileNavigation } from '../../client/src/features/workspace/components/MobileNavigation'
import { CallsHome } from '../../client/src/features/workspace/components/CallsHome'
import { IncomingCallBanner } from '../../client/src/features/workspace/components/IncomingCallBanner'
import { applyAppearancePreference } from '../../client/src/shared/appearance'
import type { AppearancePreference } from '../../client/src/shared/appearance'
import type { CallRecord, Chat, IncomingCall, User } from '../../client/src/shared/types'

window.fetch = async () => { throw new Error('Network disabled in isolated Workspace preview') }
const user: User = { id: 'preview', email: 'preview@example.invalid', username: 'preview', display_name: 'Sam Rivera' }
const chat = { id: 'chat', kind: 'direct', display_title: 'Alex Chen', unread_count: 1, preview: 'See you tomorrow', last_message_created_at: '2026-10-02T10:00:00Z' } as Chat
const direct: IncomingCall = { id: 'incoming', chat_id: 'chat', call_type: 'video', caller_name: 'Alex Chen', caller_username: 'alex' }
// Test-only URL controls are installed before the production relocation so both
// sides use the same fixture, dates and effective System scheme.
const parameters = new URLSearchParams(window.location.search)
const scene = parameters.get('scene') ?? 'calls'
const initialTheme = parameters.get('theme') as AppearancePreference | null
const fixtureTheme = initialTheme === 'dark' || initialTheme === 'system' ? initialTheme : 'light'
const history = [{ id: 'history', chat_id: 'chat', caller_id: 'preview', callee_id: 'peer', call_type: 'video', status: 'ended', other_name: 'Alex Chen', created_at: '2026-10-02T10:00:00Z', accepted_at: '2026-10-02T10:00:00Z', ended_at: '2026-10-02T10:01:05Z' }] as CallRecord[]

function Preview() {
  const nav = useWorkspaceNavigation()
  const [banner, setBanner] = useState(scene === 'direct' || scene === 'group' ? scene : 'none')
  const [action, setAction] = useState('none')
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [theme, setTheme] = useState<AppearancePreference>(fixtureTheme)
  useEffect(() => {
    if (scene === 'inbox' || scene === 'direct' || scene === 'group') nav.showChatsHome()
    else if (scene === 'selected') nav.selectChat('chat')
    else nav.openCalls()
    applyAppearancePreference(fixtureTheme)
  }, [])
  const newCall = (type: string) => setAction(`${type} callback`)
  return <>
    <nav aria-label="Fixture controls" style={{ position: 'fixed', right: 8, top: 8, zIndex: 100, maxWidth: 'calc(100vw - 16px)', padding: 8, background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}>
      <small>Isolated Workspace fixture · no backend</small><br />
      <label>Theme <select aria-label="Fixture theme" value={theme} onChange={(event) => { const value = event.target.value as AppearancePreference; setTheme(value); applyAppearancePreference(value) }}><option>light</option><option>dark</option><option>system</option></select></label>{' '}
      <label>Incoming <select aria-label="Fixture incoming call" value={banner} onChange={(event) => setBanner(event.target.value)}><option>none</option><option>direct</option><option>group</option></select></label>
      <output aria-label="Fixture callback">{action}</output>
      <output aria-label="Fixture state" style={{ display: 'block', fontSize: 10 }}>{JSON.stringify({ calls: nav.showCalls, updates: nav.showUpdates, spaces: nav.showSpaces, requests: nav.showRequests, chat: nav.activeChatId, target: nav.updatesTarget })}</output>
    </nav>
    <a className="skip-link" href="#workspace-main">Skip to main content</a>
    <main id="workspace-main" tabIndex={-1} className={`workspace${nav.activeChatId ? ' has-active-chat' : ''}${nav.showCalls ? ' has-active-calls' : ''}${nav.showSpaces ? ' has-active-space' : ''}${nav.showUpdates ? ' has-active-updates' : ''}`}>
      <WorkspaceRail user={user} showCalls={nav.showCalls} showUpdates={nav.showUpdates} showSpaces={nav.showSpaces} unreadConversationCount={1}
        onShowChats={nav.showChatsHome} onShowCalls={nav.openCalls} onShowUpdates={nav.openUpdates} onShowSpaces={nav.openSpaces} onOpenAccount={() => setAction('account callback')} />
      <InboxPane showCalls={nav.showCalls} callHistory={scene === 'history' ? history : []} userId={user.id} filter={filter} showRequests={nav.showRequests} requests={[]} error="" chats={[chat]} drafts={{}} activeChatId={nav.activeChatId} online
        onSelectChat={nav.selectChat} onSelectCall={nav.selectChat} onCallAgain={() => setAction('redial callback')} onNewCall={() => newCall('audio')}
        onSelectRequest={() => nav.setShowRequests(false)} onSelectFilter={(value) => { setFilter(value); nav.setShowRequests(false) }} onShowRequests={() => { nav.setShowRequests(true); setFilter('all') }}
        onNewConversation={() => setAction('new conversation callback')} onOpenSearch={() => setAction('search callback')} />
      {nav.showCalls ? <CallsHome onAudioCall={() => newCall('audio')} onVideoCall={() => newCall('video')} /> :
        <section className="conversation-pane"><header className="conversation-header"><strong>{nav.activeChatId ? 'Alex Chen' : 'Conversation fixture'}</strong></header><div className="message-list"><p>Domain views are not exercised in this fixture.</p></div></section>}
      <MobileNavigation section={nav.showSpaces ? 'spaces' : nav.showUpdates ? 'updates' : nav.showCalls ? 'calls' : 'chats'} accountOpen={false} unreadConversationCount={1}
        onShowChats={nav.showChatsHome} onShowCalls={nav.openCalls} onShowUpdates={nav.openUpdates} onShowSpaces={nav.openSpaces} onOpenAccount={() => setAction('account callback')} />
      <footer className="workspace-footer"><button type="button" onClick={() => setAction('sign out callback')}>Sign out</button><span>Chats · End-to-end encrypted</span></footer>
      {banner !== 'none' && <IncomingCallBanner incomingCall={banner === 'group' ? { ...direct, is_group: true, group_title: 'Design team' } : direct}
        onAnswer={() => setAction('answer callback')} onDecline={() => setAction('decline callback')} />}
    </main>
  </>
}

const root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root')!)
if (import.meta.hot) import.meta.hot.data.root = root
root.render(<Preview />)
