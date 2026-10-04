// Isolated presentation fixture: real hook/children/styles, seeded plaintext.
// No Conversation runtime effects, network, storage, encryption, uploads or Calls.
import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ConversationSearchBar } from '../../client/src/features/messaging/components/ConversationSearchBar'
import '../../client/src/index.css'
import '../../client/src/App.css'
import { ConversationWelcome } from '../../client/src/features/messaging/components/ConversationWelcome'
import { useConversationUiState } from '../../client/src/features/messaging/hooks/useConversationUiState'
import { ConversationHeader } from '../../client/src/features/messaging/components/ConversationHeader'
import { MessageList } from '../../client/src/features/messaging/MessageList'
import { MessageComposer } from '../../client/src/features/messaging/MessageComposer'
import { ChatDetailsScreen } from '../../client/src/features/messaging/ChatDetailsScreen'
import { ReportDialog } from '../../client/src/features/messaging/components/ReportDialog'
import { WorkspaceRail } from '../../client/src/features/workspace/components/WorkspaceRail'
import { InboxPane } from '../../client/src/features/workspace/components/InboxPane'
import { MobileNavigation } from '../../client/src/features/workspace/components/MobileNavigation'
import { applyAppearancePreference } from '../../client/src/shared/appearance'
import type { AppearancePreference } from '../../client/src/shared/appearance'
import type { Chat, ChatMember, DisplayMessage, User } from '../../client/src/shared/types'

window.fetch = async () => { throw new Error('Network disabled in isolated Conversation preview') }
const user: User = { id: 'me', email: 'preview@example.invalid', username: 'sam', display_name: 'Sam Rivera' }
const members = [{ id: 'me', displayName: 'Sam Rivera', username: 'sam' }, { id: 'peer', displayName: 'Alex Chen', username: 'alex', about: 'Enjoying good conversations.' }] as ChatMember[]
const chat = { id: 'chat', kind: 'direct', display_title: 'Alex Chen', unread_count: 1, preview: 'See you tomorrow', last_message_created_at: '2026-10-02T10:00:00Z' } as Chat
const messages = [
  { id: 'one', sender_id: 'peer', text: 'Hello! See you tomorrow.', server_seq: '1', created_at: '2026-10-02T10:00:00Z' },
  { id: 'two', sender_id: 'me', text: 'Looking forward to it. I’ll bring the notes.', server_seq: '2', created_at: '2026-10-02T10:01:00Z' },
  { id: 'three', sender_id: 'peer', text: 'Let’s meet at the library at 10. The quiet table near the window should work. مرحباً · 東京 · 👩🏽‍💻', server_seq: '3', created_at: '2026-10-02T10:02:00Z' },
  { id: 'four', sender_id: 'me', text: 'That works. I’ve updated the outline and marked the two questions we should discuss.', server_seq: '4', reply_to_id: 'three', created_at: '2026-10-02T10:03:00Z' },
  { id: 'five', sender_id: 'peer', text: 'One longer note for later: '+ 'We can keep the discussion focused on the next step and review the details together. '.repeat(7), server_seq: '5', created_at: '2026-10-02T10:04:00Z' },
  { id: 'six', sender_id: 'me', text: 'Thanks — see you there!', server_seq: '6', created_at: '2026-10-02T10:05:00Z' },
].map(message => ({ ...message, chat_id: 'chat', deleted_at: null, reactions: message.id === 'three' ? [{emoji:'👍',user_id:'me'},{emoji:'👍',user_id:'peer'},{emoji:'❤️',user_id:'peer'}] : [], attachments: [], read_by: message.sender_id === 'me' ? ['peer'] : [] })) as DisplayMessage[]
const noop = () => {}
const params = new URLSearchParams(location.search)
const initialScene = params.get('scene') ?? 'conversation'
const initialTheme = (params.get('theme') ?? 'light') as AppearancePreference

function Preview() {
  const ui = useConversationUiState()
  const [items, setItems] = useState(messages)
  const [trace, setTrace] = useState<string[]>([])
  const [active, setActive] = useState(initialScene !== 'welcome')
  const [theme, setTheme] = useState<AppearancePreference>(initialTheme)
  const [draft, setDraft] = useState(initialScene === 'edit' ? messages[1].text : '')
  const [reply, setReply] = useState<DisplayMessage | null>(initialScene === 'reply' ? messages[0] : null)
  const [edit, setEdit] = useState<DisplayMessage | null>(null)
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    applyAppearancePreference(initialTheme)
    if (initialScene === 'search') { ui.toggleMessageSearch(); ui.setMessageSearch('Hello') }
    if (initialScene === 'report') ui.openReport('one')
    if (initialScene === 'details') ui.openDetails()
  }, [])
  const select = () => setActive(true)
  const back = () => setActive(false)
  const visible = ui.messageSearch.trim() ? items.filter(message => message.text.toLocaleLowerCase().includes(ui.messageSearch.trim().toLocaleLowerCase())) : items
  return <>
    <nav hidden aria-label="Fixture controls" style={{ position: 'fixed', right: 8, bottom: 45, zIndex: 100, padding: 8, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}>
      <small>Isolated Conversation fixture · no backend</small><br />
      <label>Scene <select aria-label="Fixture scene" value={active ? 'conversation' : 'welcome'} onChange={event => setActive(event.target.value === 'conversation')}><option>welcome</option><option>conversation</option></select></label>{' '}
      <label>Theme <select aria-label="Fixture theme" value={theme} onChange={event => { const value = event.target.value as AppearancePreference; setTheme(value); applyAppearancePreference(value) }}><option>light</option><option>dark</option><option>system</option></select></label>
    </nav>
    <output hidden aria-label="Fixture trace">{JSON.stringify(trace)}</output>
    <main className={`workspace ui:bg-canvas${active ? ' has-active-chat' : ''}`}>
      <WorkspaceRail user={user} showCalls={false} showUpdates={false} showSpaces={false} unreadConversationCount={1} onShowChats={back} onShowCalls={noop} onShowUpdates={noop} onShowSpaces={noop} onOpenAccount={noop} />
      <InboxPane showCalls={false} callHistory={[]} userId="me" filter="all" showRequests={false} requests={[]} error="" chats={[chat]} drafts={{}} activeChatId={active ? 'chat' : null} online onSelectChat={select} onSelectCall={select} onCallAgain={noop} onNewCall={noop} onSelectRequest={noop} onSelectFilter={noop} onShowRequests={noop} onNewConversation={noop} onOpenSearch={noop} />
      {!active ? <ConversationWelcome user={user} /> : <div className="conversation-layout">
        <section className={`conversation-pane active-conversation${ui.detailsOpen ? ' conversation-hidden' : ''}`} aria-label="Alex Chen" aria-hidden={ui.detailsOpen}>
          <ConversationHeader title="Alex Chen" subtitle={params.get('typing') ? 'Alex is typing…' : '@alex · online · encrypted'} canOpenDetails callStarting={false} online onOpenDetails={ui.openDetails} onSearchMessages={ui.toggleMessageSearch} onBack={back} onStartCall={noop} />
          {ui.messageSearchOpen && <ConversationSearchBar query={ui.messageSearch} label={ui.messageSearch.trim() ? `${visible.length} matches` : 'On-device only'} onQueryChange={ui.setMessageSearch} onClose={ui.closeMessageSearch} />}
          <MessageList messages={visible} calls={[{id:'call',chat_id:'chat',caller_id:'me',callee_id:'peer',call_type:'audio',status:'ended',created_at:'2026-10-02T10:01:30Z',accepted_at:'2026-10-02T10:01:30Z',ended_at:'2026-10-02T10:02:30Z'} as any]} members={members} currentUserId="me" loading={false} error="" emptyMessage={ui.messageSearch.trim() ? 'No matching loaded messages. Search is performed only on this device.' : undefined} scrollContainerRef={list} onScroll={() => setTrace(t => [...t.slice(-9), 'scroll'])} loadingOlder={false} mediaSends={[]} onRetryMedia={noop} onCancelMedia={noop} onReply={setReply} onJumpToMessage={id => {document.getElementById('message-'+id)?.scrollIntoView({block:'center'});setTrace(t=>[...t,'reply:'+id])}} onReact={(message,emoji)=>{setItems(items=>items.map(m=>m.id!==message.id?m:{...m,reactions:m.reactions.some(r=>r.user_id==='me'&&r.emoji===emoji)?m.reactions.filter(r=>!(r.user_id==='me'&&r.emoji===emoji)):[...m.reactions,{user_id:'me',emoji}]}));setTrace(t=>[...t,'react:'+message.id+':'+emoji])}} onEdit={message => { setEdit(message); setReply(null); setDraft(message.text) }} onDelete={noop} onPin={noop} onCopy={noop} onReport={message => ui.openReport(message.id)} />
          <MessageComposer draft={draft} replyTo={edit ?? reply} editing={Boolean(edit)} replyAuthor="Alex Chen" attachments={[]} uploading={false} submitting={false} chatTitle="Alex Chen" voiceDraft={null} onSubmit={event => {event.preventDefault();if(draft.trim()){setItems(items=>[...items,{...messages[1],id:'local-'+items.length,text:draft,created_at:'2026-10-02T10:06:00Z',server_seq:String(items.length+1),reply_to_id:reply?.id}]);setDraft('');setReply(null);setTrace(t=>[...t,'send'])}}} onDraftChange={setDraft} onTypingChange={noop} onClearReply={() => { if (edit) { setEdit(null); setDraft('') } else setReply(null) }} onRemoveAttachment={noop} onUpload={noop} onVoiceReady={noop} onDeleteVoice={noop} onSendVoice={noop} />
          {ui.reportingMessageId && <ReportDialog messageId={ui.reportingMessageId} onClose={ui.closeReport} />}
        </section>
        {ui.detailsOpen && <ChatDetailsScreen chatId="chat" title="Alex Chen" isGroup={false} members={members} currentUserId="me" onBack={ui.closeDetails} onMembersChanged={noop} onLeave={back} onConverted={noop} />}
      </div>}
      <MobileNavigation section="chats" accountOpen={false} unreadConversationCount={1} onShowChats={back} onShowCalls={noop} onShowUpdates={noop} onShowSpaces={noop} onOpenAccount={noop} />
      <footer className="workspace-footer"><button type="button" onClick={noop}>Sign out</button><span>Chats · End-to-end encrypted</span></footer>
    </main>
  </>
}
const root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root')!)
if (import.meta.hot) import.meta.hot.data.root = root
root.render(<Preview />)
