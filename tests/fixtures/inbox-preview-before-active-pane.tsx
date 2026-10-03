// Isolated presentation fixture. Real Inbox, SearchDialog and navigation hook;
// synthetic data, no Workspace network/persistence/crypto/realtime effects.
import React, {useEffect, useState} from 'react'
import {createRoot} from 'react-dom/client'
import '../../client/src/index.css'
import '../../client/src/App.css'
import {InboxPane} from '../../client/src/features/workspace/components/InboxPane'
import {WorkspaceRail} from '../../client/src/features/workspace/components/WorkspaceRail'
import {MobileNavigation} from '../../client/src/features/workspace/components/MobileNavigation'
import {useWorkspaceNavigation} from '../../client/src/features/workspace/hooks/useWorkspaceNavigation'
import {ConversationWelcome} from '../../client/src/features/messaging/components/ConversationWelcome'
import {ConversationHeader} from '../../client/src/features/messaging/components/ConversationHeader'
import {CallsHome} from '../../client/src/features/workspace/components/CallsHome'
import {SearchDialog} from '../../client/src/features/messaging/SearchDialog'
import {applyAppearancePreference, type AppearancePreference} from '../../client/src/shared/appearance'
import type {Chat, CallRecord, User, IncomingRequest} from '../../client/src/shared/types'

window.fetch=async()=>{throw Error('Network disabled in isolated Inbox preview')}
const p=new URLSearchParams(location.search),scene=p.get('scene')??'normal'
const theme=(p.get('theme')??'light') as AppearancePreference
const user={id:'me',display_name:'Sam Rivera',username:'sam',email:'sam@example.test'} as User
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="silver"/><circle cx="32" cy="24" r="12" fill="dimgray"/><path d="M8 64a24 24 0 0 1 48 0" fill="dimgray"/></svg>')
const sample=[
 {id:'alex',kind:'direct',display_title:'Alex Chen',preview:'See you tomorrow',unread_count:1,peer_avatar_url:image},
 {id:'mariam',kind:'direct',display_title:'Mariam Ahmed',preview:'Voice message · 0:24',unread_count:0},
 {id:'long',kind:'direct',display_title:'Zoë · محمد · 東京 · 👩🏽‍💻 — A very long contact name',preview:'📎 quarterly-planning-notes-with-a-very-long-name.pdf · مرحباً · Let’s review this together tomorrow afternoon.',unread_count:9},
 {id:'draft',kind:'direct',display_title:'Daniel Kim',preview:'Original latest message stays unchanged',unread_count:99},
 {id:'photo',kind:'direct',display_title:'Noah Wilson',preview:'Photo',unread_count:100},
 {id:'team',kind:'group',display_title:'Product team',preview:'Video · sprint demo',unread_count:0},
 {id:'private',kind:'group',display_title:'Weekend plans',preview:'',unread_count:1},
].map(chat=>({...chat,last_message_created_at:'2026-10-02T10:00:00Z'})) as Chat[]
const chats=scene==='empty'?[]:scene==='scroll'?[...sample,...Array.from({length:24},(_,i)=>({...sample[i%5],id:`extra-${i}`,display_title:`Contact ${i+1}`}))]:sample
const requests=[{id:'request',display_name:'Taylor Morgan',username:'taylor',avatar_url:null}] as IncomingRequest[]
const history=[{id:'call',chat_id:'alex',caller_id:'me',callee_id:'peer',call_type:'video',status:'ended',other_name:'Alex Chen',created_at:'2026-10-02T10:00:00Z',accepted_at:'2026-10-02T10:00:00Z',ended_at:'2026-10-02T10:01:05Z'}] as CallRecord[]
function Preview(){
 const nav=useWorkspaceNavigation(),[filter,setFilter]=useState<'all'|'unread'>('all'),[search,setSearch]=useState(false),[action,setAction]=useState('none')
 useEffect(()=>{applyAppearancePreference(theme);if(scene.startsWith('calls'))nav.openCalls();else if(scene==='selected'||scene==='selected-focus'||scene==='open')nav.selectChat('alex');else nav.showChatsHome()},[])
 const selected=chats.find(chat=>chat.id===nav.activeChatId)
 return <>
  <div hidden aria-label="Fixture controls"><output aria-label="Fixture state">{JSON.stringify({calls:nav.showCalls,chat:nav.activeChatId,requests:nav.showRequests,filter,search,action})}</output></div>
  <a className="skip-link" href="#workspace-main">Skip to main content</a>
  <main id="workspace-main" tabIndex={-1} className={`workspace ui:bg-canvas${nav.activeChatId?' has-active-chat':''}${nav.showCalls?' has-active-calls':''}`}>
   <WorkspaceRail user={user} showCalls={nav.showCalls} showUpdates={false} showSpaces={false} unreadConversationCount={5} onShowChats={nav.showChatsHome} onShowCalls={nav.openCalls} onShowUpdates={nav.openUpdates} onShowSpaces={nav.openSpaces} onOpenAccount={()=>setAction('account')} />
   <InboxPane showCalls={nav.showCalls} callHistory={scene==='calls-history'?history:[]} userId={user.id} filter={filter} showRequests={nav.showRequests} requests={requests} error={scene==='error'?'Unable to load conversations.':''} chats={chats} drafts={{draft:'Please check the proposal before our meeting — مرحباً — 👩🏽‍💻 — extended draft'}} activeChatId={nav.activeChatId} online={scene!=='offline'}
    onSelectChat={nav.selectChat} onSelectCall={nav.selectChat} onCallAgain={()=>setAction('redial')} onNewCall={()=>setAction('new-call')} onSelectRequest={()=>setAction('request')}
    onSelectFilter={value=>{setFilter(value);nav.setShowRequests(false)}} onShowRequests={()=>{nav.setShowRequests(true);setFilter('all')}} onNewConversation={()=>setAction('new-conversation')} onOpenSearch={()=>setSearch(true)} />
   {nav.showCalls?<CallsHome onAudioCall={()=>setAction('audio')} onVideoCall={()=>setAction('video')} />:selected?<section className="conversation-layout"><div className="conversation-pane"><ConversationHeader title={selected.display_title} avatarUrl={selected.peer_avatar_url} subtitle="End-to-end encrypted" canOpenDetails online callStarting={false} onOpenDetails={()=>setAction('details')} onSearchMessages={()=>setAction('message-search')} onBack={nav.showChatsHome} onStartCall={type=>setAction(type)} /><div className="message-list" /></div></section>:<ConversationWelcome user={user} />}
   <MobileNavigation section={nav.showCalls?'calls':'chats'} accountOpen={false} unreadConversationCount={5} onShowChats={nav.showChatsHome} onShowCalls={nav.openCalls} onShowUpdates={nav.openUpdates} onShowSpaces={nav.openSpaces} onOpenAccount={()=>setAction('account')} />
   <footer className="workspace-footer"><button type="button" onClick={()=>setAction('sign-out')}>Sign out</button><span>Chats · End-to-end encrypted</span></footer>
   {search&&<SearchDialog chats={chats} messages={[{id:'loaded',chatId:'alex',senderName:'Alex',text:'See you tomorrow',createdAt:'2026-10-02T10:00:00Z'}]} onClose={()=>setSearch(false)} onSelectChat={id=>{nav.selectChat(id);setSearch(false)}} onSelectPerson={name=>setAction(name)} />}
  </main>
 </>
}
createRoot(document.getElementById('root')!).render(<Preview />)
document.fonts.ready.then(()=>{document.documentElement.dataset.visualReady='true'})
