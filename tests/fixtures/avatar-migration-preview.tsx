import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../client/src/index.css'
import '../../client/src/App.css'
import { Avatar } from '../../client/src/shared/components/Avatar'
import { AccountPanel } from '../../client/src/features/account/AccountPanel'
import { CallWindow } from '../../client/src/features/calls/CallWindow'
import { RequestsPanel } from '../../client/src/features/messaging/RequestsPanel'
import { SearchDialog } from '../../client/src/features/messaging/SearchDialog'
import { applyAppearancePreference } from '../../client/src/shared/appearance'
const params = new URLSearchParams(location.search), scene = params.get('scene') ?? 'probe'
const image = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="96" height="64"><rect width="96" height="64" fill="#76546f"/><circle cx="48" cy="25" r="15" fill="#fffcf8"/><path d="M20 64a28 28 0 0 1 56 0" fill="#d2b8cb"/></svg>')
const broken = '/broken-avatar', noop = () => {}
applyAppearancePreference((params.get('theme') ?? 'light') as 'light' | 'dark' | 'system')
window.fetch = async input => {
  if (String(input) === '/api/auth/sessions') return Response.json({ sessions: [], currentSessionId: 'preview' })
  if (String(input) === '/api/blocks') return Response.json({ blockedUsers: [] })
  throw Error('Unexpected isolated request: ' + input)
}
export function useAvatarState(name: string, fallback: unknown) {
  const seed: Record<string, unknown> = {
    'CallWindow:connected': true, 'CallWindow:localIdentity': 'sam',
    'CallWindow:voiceRoster': [{ user_id: 'sam', display_name: 'Sam Rivera', avatar_url: image, can_speak: true }, { user_id: 'alex', display_name: 'Alex Chen', avatar_url: null, can_speak: false }, { user_id: 'robin', display_name: 'Robin Lee', avatar_url: broken, can_speak: true }],
    'RequestsPanel:previews': { request: 'Hello from the isolated fixture' },
    'SearchDialog:query': 'sam',
    'SearchDialog:results': { people: [{ id: 'sam', username: 'sam', display_name: 'Sam Rivera', avatar_url: image }, { id: 'alex', username: 'alex', display_name: 'Alex Chen', avatar_url: broken }], chats: [{ id: 'chat', kind: 'direct', display_title: 'Sam Rivera', peer_username: 'sam', peer_avatar_url: null }], privacy: 'Isolated search fixture' },
  }
  return useState(name in seed ? seed[name] : fallback)
}
function Probe() {
  const [src, setSrc] = useState<string | null>(broken), [name, setName] = useState('Robin Lee'), [extension, setExtension] = useState('profile-avatar'), [revision, setRevision] = useState(0)
  return <main style={{ padding: 24 }}>
    <h1>Avatar native state characterization</h1>
    <section id="states" style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
      <Avatar name="Sam Rivera" src={image} />
      <Avatar name=" Alex Chen " />
      <Avatar name="Robin Lee" src={broken} />
      <Avatar name="" src="" />
    </section>
    <section id="changing"><Avatar name={name} src={src} className={extension} /></section>
    <nav aria-label="State controls">
      <button type="button" onClick={() => setRevision(n => n + 1)}>Same props rerender</button>
      <button type="button" onClick={() => setName('Riley Lee')}>Change name</button>
      <button type="button" onClick={() => setExtension('profile-avatar extension')}>Change class</button>
      <button type="button" onClick={() => setSrc(image)}>Valid source</button>
      <button type="button" onClick={() => setSrc(null)}>Missing source</button>
      <button type="button" onClick={() => setSrc(broken)}>Broken source</button>
    </nav><output id="revision">{revision}</output>
  </main>
}
const user = { id: 'sam', display_name: 'Sam Rivera', username: 'sam', email: 'sam@example.test', avatar_url: image }
createRoot(document.getElementById('root')!).render(scene === 'profile' ? <AccountPanel user={user as never} appearance={(params.get('theme') ?? 'light') as never} onAppearanceChange={noop} onSaved={noop} onClose={noop} /> : scene === 'voice' ? <CallWindow callId="fixture" title="Design room" video={false} isVoiceRoom canPublish onClose={noop} onEnd={noop} /> : scene === 'requests' ? <RequestsPanel requests={[{ id: 'request', display_name: 'Robin Lee', username: 'robin', avatar_url: broken } as never]} onAccept={noop} onIgnore={noop} onClose={noop} /> : scene === 'search' ? <SearchDialog chats={[{ id: 'chat', kind: 'direct', display_title: 'Sam Rivera' } as never]} messages={[]} onSelectChat={noop} onSelectPerson={noop} onClose={noop} /> : <Probe />)
