// Isolated real presentation with seeded data; no SpacesPage effects/API/crypto/voice runtime.
import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ArrowLeft, ChevronDown, ChevronRight, FileText, Hash, Layers3, LockKeyhole, Megaphone, Mic, Search, Settings2, Volume2 } from 'lucide-react'
import '../../client/src/index.css'
import '../../client/src/App.css'
import { SpaceVoiceChannelView } from '../../client/src/features/spaces/SpaceVoiceChannelView'
import { SpaceLegacyHistoryView } from '../../client/src/features/spaces/SpaceLegacyHistoryView'
import { SharedObjectCard } from '../../client/src/features/spaces/SharedObjectCard'
import { WorkspaceRail } from '../../client/src/features/workspace/components/WorkspaceRail'
import { MobileNavigation } from '../../client/src/features/workspace/components/MobileNavigation'
import { applyAppearancePreference } from '../../client/src/shared/appearance'
import type { SpaceChannel, SpaceSharedObject } from '../../client/src/features/spaces/types'
import type { ActiveCall, DisplayMessage, User } from '../../client/src/shared/types'
const params = new URLSearchParams(location.search)
const initialScene = params.get('scene') ?? 'text'
const initialTheme = (params.get('theme') ?? 'light') as 'light' | 'dark' | 'system'
window.fetch = async () => { throw new Error('Network disabled in Spaces presentation fixture') }
const user: User = { id:'me', display_name:'Sam Rivera', username:'sam', email:'preview@example.invalid' }
const noop = () => {}
const poll = { id:'poll', chat_id:'general', message_id:'m', object_type:'poll', title:'When should we review the project?', state:'open', payload:{options:[{id:'a',text:'Monday'},{id:'b',text:'Tuesday'}],multiSelect:false}, created_by:'me', created_at:'2026-10-02T10:00:00Z', updated_at:'2026-10-02T10:00:00Z', terminal_at:null, channel_name:'general', space_id:'project', space_name:'Project', message_seq:'1', my_response:{optionIds:['a']}, response_counts:{a:3,b:2} } as SpaceSharedObject
const history = [{id:'old',chat_id:'general',sender_id:'me',text:'Earlier encrypted plans stay here.',server_seq:'1',created_at:'2026-10-02T10:00:00Z',reactions:[{emoji:'👍',user_id:'me'}],attachments:[],deleted_at:null}] as DisplayMessage[]
const members = new Map([['me',{id:'me',username:'sam',display_name:'Sam Rivera'}]])
function FixtureHeader({type,onAction}: {type:SpaceChannel['type'];onAction:(action:string)=>void}) {
  const activeChannel = {id:'general',name:type === 'discussion' ? 'general' : type,type,topic:'',can_speak:false}
  const space = {id:'project',name:'Project'}
  const canCreateChannels = params.get('role') !== 'guest'
  const setError = (value:string) => onAction('error:'+value)
  const setSearchResults = (_:unknown[]) => onAction('search-results:clear')
  const setSearchSubmitted = (value:boolean) => onAction('search-submitted:'+value)
  const setSearchOpen = (value:boolean) => onAction('search-open:'+value)
  const openFilePanel = () => onAction('files callback only')
  const openChannelSettings = (value:string) => onAction('settings:'+value)
  const onJoinVoiceRoom = (call:ActiveCall) => onAction(JSON.stringify(call))
  return (
<header className="space-channel-header"><div>
              <span>{activeChannel.type === 'announcement' ? <Megaphone size={16} aria-hidden="true" /> : activeChannel.type === 'private' ? <LockKeyhole size={16} aria-hidden="true" /> : activeChannel.type === 'voice' ? <Volume2 size={16} aria-hidden="true" /> : <Hash size={16} aria-hidden="true" />}{activeChannel.name}</span>
              <small>{activeChannel.topic || (activeChannel.type === 'announcement' ? 'Only Space moderators can post here' : activeChannel.type === 'private' ? 'Private channel' : activeChannel.type === 'voice' ? 'Persistent voice room · up to 16 people' : 'Visible to invited members')}</small>
            </div>
            <div className="space-channel-actions">
              {activeChannel.type !== 'voice' && <>
                <button className="space-topic-edit" type="button" onClick={() => { setError(''); setSearchResults([]); setSearchSubmitted(false); setSearchOpen(true) }} aria-label={`Search ${space.name}`} title="Search this Space"><Search size={14} aria-hidden="true" /><span>Search</span></button>
                <button className="space-topic-edit" type="button" onClick={() => void openFilePanel()} aria-label={`Files in ${activeChannel.name}`} title="Channel files"><FileText size={14} aria-hidden="true" /><span>Files</span></button>
              </>}
              {canCreateChannels && <button className="space-topic-edit" type="button" onClick={() => openChannelSettings('overview')}><Settings2 size={13} aria-hidden="true" /> Edit channel</button>}
              {activeChannel.type === 'voice' && <button className="space-topic-edit" type="button" onClick={() => {
                onJoinVoiceRoom({
                  id: activeChannel.id,
                  chatId: activeChannel.id,
                  callType: 'audio',
                  title: `${space.name} · ${activeChannel.name}`,
                  isVoiceRoom: true,
                  voiceSpaceId: space.id,
                  voiceChannelId: activeChannel.id,
                  canPublish: activeChannel.can_speak,
                })
              }}><Mic size={13} aria-hidden="true" /> Join voice</button>}
            </div>
            </header>
  )
}
function Preview() {
  const [scene,setScene] = useState(initialScene)
  const [collapsed,setCollapsed] = useState(initialScene === 'collapsed')
  const [actions,setActions] = useState<string[]>([])
  useEffect(() => { applyAppearancePreference(initialTheme) },[])
  const type:SpaceChannel['type'] = scene === 'voice' ? 'voice' : scene === 'announcement' ? 'announcement' : scene === 'private' ? 'private' : 'discussion'
  const name = type === 'discussion' ? 'general' : type
  const record = (action:string) => setActions(current=>[...current,action])
  return <>
    <nav aria-label="Fixture controls" style={{position:'fixed',right:8,bottom:50,zIndex:100,padding:8,background:'var(--color-bg-elevated)',border:'1px solid var(--color-border)',maxWidth:'calc(100vw - 16px)'}}>Isolated Spaces fixture · no backend<output aria-label="Fixture callback">{JSON.stringify(actions)}</output></nav>
    <main className="workspace has-active-space">
      <WorkspaceRail user={user} showCalls={false} showUpdates={false} showSpaces unreadConversationCount={0} onShowChats={noop} onShowCalls={noop} onShowUpdates={noop} onShowSpaces={noop} onOpenAccount={noop}/>
      {scene === 'home' ? <section className="spaces-page"><header className="spaces-topbar"><div><p className="eyebrow">WORK TOGETHER</p><h1>Spaces</h1></div></header><div className="spaces-overview-content"><section className="spaces-intro"><span className="spaces-intro-icon"><Layers3 size={22}/></span><h2>A place for shared work</h2><p>Create a Space for your team.</p></section><section className="spaces-list"><h2>Your Spaces</h2><button className="space-list-card" type="button" onClick={()=>setScene('text')}><span className="space-card-mark"><Layers3 size={18}/></span><span><strong>Project</strong><small>4 channels · Owner</small></span></button></section></div></section> :
      <section className="spaces-page space-detail"><div className="space-work-area">
        <aside className="space-sidebar"><header className="space-server-header"><span className="space-server-icon"><Layers3 size={17}/></span><div><strong>Project</strong><small>Team work</small></div></header><button className="space-all-spaces" type="button" onClick={()=>setScene('home')}><ArrowLeft size={13}/> All Spaces</button><section className="space-category"><div className="space-section-heading"><button className="space-category-toggle" type="button" aria-expanded={!collapsed} onClick={()=>setCollapsed(value=>!value)}>{collapsed?<ChevronRight size={13}/>:<ChevronDown size={13}/>}<span>Project</span></button></div>{!collapsed && <nav className="space-channel-list" aria-label="Project channels">{(['text','announcement','private','voice'] as const).map(item=><div key={item} className={'space-channel-row'+((item==='text'?type==='discussion':item===type)?' is-active':'')}><button className="space-channel" type="button" onClick={()=>setScene(item)}>{item==='text'?<Hash size={14}/>:item==='announcement'?<Megaphone size={14}/>:item==='private'?<LockKeyhole size={14}/>:<Volume2 size={14}/>}<span>{item==='text'?'general':item}</span></button></div>)}</nav>}</section></aside>
        <section className="space-channel-view" aria-label={'Channel '+name}><FixtureHeader type={type} onAction={record}/>
          {type==='voice'?<SpaceVoiceChannelView onJoin={()=>record('welcome join callback only')}/>:<><div className={'space-message-list'+(scene==='history'?' has-legacy-history':'')} aria-live="polite">{scene==='history'?<SpaceLegacyHistoryView legacyMessages={history} legacyMembersById={members} userId="me" legacyHasMore legacyLoading={false} legacyError="" onLoadEarlier={()=>record('pagination callback only')}/>:<article className="space-message"><header className="space-message-heading"><strong>Sam Rivera</strong><small>3:00 PM</small></header><p>Shared project plans.</p>{scene==='object'&&<SharedObjectCard object={poll} userId="me" canManage onRespond={noop} onStateChange={noop}/>}</article>}</div><form className="space-message-composer" onSubmit={event=>event.preventDefault()}><textarea rows={2} aria-label={'Message #'+name} placeholder={'Message #'+name}/><small className="space-composer-note">Messages in Spaces are visible to channel members and stored by SyncUp.</small></form></>}
        </section>
      </div></section>}
      <MobileNavigation section="spaces" accountOpen={false} unreadConversationCount={0} onShowChats={noop} onShowCalls={noop} onShowUpdates={noop} onShowSpaces={noop} onOpenAccount={noop}/>
    </main>
  </>
}
const root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root')!)
if(import.meta.hot) import.meta.hot.data.root=root
root.render(<Preview/>)
