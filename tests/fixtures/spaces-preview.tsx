// Isolated extracted presentation with existing shell classes/styles. Seeded
// plaintext only; no SpacesPage runtime, permission policy, transport or voice.
import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Hash, Layers3, Mic, Volume2 } from 'lucide-react'
import '../../client/src/index.css'
import '../../client/src/App.css'
import { SpaceVoiceChannelView } from '../../client/src/features/spaces/SpaceVoiceChannelView'
import { SpaceLegacyHistoryView } from '../../client/src/features/spaces/SpaceLegacyHistoryView'
import { WorkspaceRail } from '../../client/src/features/workspace/components/WorkspaceRail'
import { MobileNavigation } from '../../client/src/features/workspace/components/MobileNavigation'
import { applyAppearancePreference } from '../../client/src/shared/appearance'
import type { AppearancePreference } from '../../client/src/shared/appearance'
import type { DisplayMessage, User } from '../../client/src/shared/types'
import type { SpaceChannelMember } from '../../client/src/features/spaces/types'

window.fetch = async () => { throw new Error('Network disabled in isolated Spaces preview') }
const user: User = { id: 'me', display_name: 'Sam Rivera', username: 'sam', email: 'preview@example.invalid' }
const members = new Map<string, SpaceChannelMember>([['me', { id: 'me', display_name: 'Sam Rivera', username: 'sam' }]])
const messages = [
  { id: 'one', sender_id: 'me', text: 'Earlier project plans remain here.', deleted_at: null, reactions: [{ emoji: '👍', user_id: 'me' }, { emoji: '👍', user_id: 'peer' }] },
  { id: 'two', sender_id: 'unknown', text: '', deleted_at: '2026-10-02T10:00:00Z', reactions: [] },
].map(message => ({ ...message, chat_id: 'text', server_seq: '1', body_ciphertext: '', body_nonce: '', key_envelope: '', attachments: [], created_at: '2026-10-02T09:00:00Z' })) as DisplayMessage[]
const noop = () => {}

function Preview() {
  const [scene, setScene] = useState('voice')
  const [theme, setTheme] = useState<AppearancePreference>('light')
  const [action, setAction] = useState('none')
  useEffect(() => { applyAppearancePreference('light') }, [])
  const join = () => setAction('join callback only — no call created')
  const voice = scene === 'voice'
  return <>
    <nav aria-label="Fixture controls" style={{ position: 'fixed', right: 8, bottom: 50, zIndex: 100, maxWidth: 'calc(100vw - 16px)', padding: 8, background: 'var(--color-canvas)', color: 'var(--color-text)', border: '1px solid var(--color-border)' }}>
      <small>Isolated Spaces fixture · no backend</small><br />
      <label>Scene <select aria-label="Fixture scene" value={scene} onChange={event => setScene(event.target.value)}><option>voice</option><option>history</option><option>loading</option><option>empty</option><option>error</option></select></label>{' '}
      <label>Theme <select aria-label="Fixture theme" value={theme} onChange={event => { const value = event.target.value as AppearancePreference; setTheme(value); applyAppearancePreference(value) }}><option>light</option><option>dark</option></select></label>
      <output aria-label="Fixture callback" style={{ display: 'block', fontSize: 10 }}>{action}</output>
    </nav>
    <main className="workspace has-active-space">
      <WorkspaceRail user={user} showCalls={false} showUpdates={false} showSpaces unreadConversationCount={0} onShowChats={noop} onShowCalls={noop} onShowUpdates={noop} onShowSpaces={noop} onOpenAccount={noop} />
      <section className="spaces-page space-detail"><div className="space-work-area">
        <aside className="space-sidebar"><header className="space-server-header"><span className="space-server-icon"><Layers3 size={17} aria-hidden="true" /></span><div><strong>Project</strong><small>Team work</small></div></header><section className="space-category"><div className="space-section-heading"><span>Project</span></div><nav className="space-channel-list" aria-label="Project channels"><div className={`space-channel-row${voice ? '' : ' is-active'}`}><button className="space-channel" type="button" onClick={() => setScene('history')}><Hash size={14} aria-hidden="true" /><span>general</span></button></div><div className={`space-channel-row${voice ? ' is-active' : ''}`}><button className="space-channel" type="button" onClick={() => setScene('voice')}><Volume2 size={14} aria-hidden="true" /><span>voice</span></button></div></nav></section></aside>
        <section className="space-channel-view" aria-label={`Channel ${voice ? 'voice' : 'general'}`}>
          <header className="space-channel-header"><div><span>{voice ? <Volume2 size={16} aria-hidden="true" /> : <Hash size={16} aria-hidden="true" />}{voice ? 'voice' : 'general'}</span><small>{voice ? 'Persistent voice room · up to 16 people' : 'Project updates'}</small></div><div className="space-channel-actions">{voice && <button className="space-topic-edit" type="button" onClick={join}><Mic size={13} aria-hidden="true" /> Join voice</button>}</div></header>
          {voice ? <SpaceVoiceChannelView onJoin={join} /> : <><div className="space-message-list has-legacy-history"><SpaceLegacyHistoryView legacyMessages={scene === 'history' ? messages : []} legacyMembersById={members} userId="me" legacyHasMore={scene !== 'empty'} legacyLoading={scene === 'loading'} legacyError={scene === 'error' ? 'Unable to load encrypted group history.' : ''} onLoadEarlier={() => setAction('pagination callback only — no request')} /><p className="space-channel-after-history">New channel messages will appear here.</p></div><form className="space-message-composer" onSubmit={event => event.preventDefault()}><textarea rows={2} placeholder="Message #general" aria-label="Message #general" /><small className="space-composer-note">Messages in Spaces are visible to channel members and stored by SyncUp.</small></form></>}
        </section>
      </div></section>
      <MobileNavigation section="spaces" accountOpen={false} unreadConversationCount={0} onShowChats={noop} onShowCalls={noop} onShowUpdates={noop} onShowSpaces={noop} onOpenAccount={noop} />
    </main>
  </>
}
const root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root')!)
if (import.meta.hot) import.meta.hot.data.root = root
root.render(<Preview />)
