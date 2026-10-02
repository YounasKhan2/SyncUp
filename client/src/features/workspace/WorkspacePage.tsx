import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../shared/api'
import { decryptMessage, lockKeyBundle } from '../auth/crypto/crypto'
import { listAllDrafts, listPendingMessages, removePendingMessage, savePendingMessage } from '../messaging/outbox'
import type { PendingMessage } from '../messaging/outbox'
import type { ActiveCall, CallRecord, Chat, IncomingCall, IncomingRequest, User } from '../../shared/types'
import { unwrapMediaKey } from '../auth/crypto/crypto'
import { AccountPanel } from '../account/AccountPanel'
import { NewConversation } from '../messaging/NewConversation'
import { RequestsPanel } from '../messaging/RequestsPanel'
import { SearchDialog, type SearchableMessage } from '../messaging/SearchDialog'
import { Conversation } from '../messaging/Conversation'
import { CallWindow } from '../calls/CallWindow'
import { InboxPane } from './InboxPane'
import { MobileNavigation } from './MobileNavigation'
import { WorkspaceRail } from './WorkspaceRail'
import { useWorkspaceNavigation } from './useWorkspaceNavigation'
import { CallsHome } from './CallsHome'
import { IncomingCallBanner } from './IncomingCallBanner'
import { SpacesPage } from '../spaces/SpacesPage'
import { UpdatesPage } from '../spaces/UpdatesPage'
import { countUnreadConversations } from '../../shared/presentation'
import { applyAppearancePreference, readAppearancePreference, saveAppearancePreference } from '../../shared/appearance'
import type { AppearancePreference } from '../../shared/appearance'

type CallIntent = { id: string; chatId: string; callType: 'audio' | 'video' }

export function WorkspacePage({ user, onSignedOut }: { user: User; onSignedOut: () => void }) {
  const [accountOpen, setAccountOpen] = useState(false)
  const [appearance, setAppearance] = useState<AppearancePreference>(readAppearancePreference)
  const [currentUser, setCurrentUser] = useState(user)
  const [chats, setChats] = useState<Chat[]>([])
  const [searchableMessages, setSearchableMessages] = useState<Record<string, SearchableMessage[]>>({})
  const [requests, setRequests] = useState<IncomingRequest[]>([])
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const {
    showRequests, setShowRequests, showCalls, setShowCalls, showUpdates, showSpaces,
    updatesTarget, activeChatId, setActiveChatId,
    showChatsHome, selectChat, openCalls, openUpdates, openSpaces,
    openUpdateTarget, openConvertedSpace, selectSearchChat,
  } = useWorkspaceNavigation()
  const [callHistory, setCallHistory] = useState<CallRecord[]>([])
  const [callIntent, setCallIntent] = useState<CallIntent | null>(null)
  const [newCallRequested, setNewCallRequested] = useState(false)
  const [newCallRequestedType, setNewCallRequestedType] = useState<'audio' | 'video'>('audio')
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null)
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)
  const [newConversation, setNewConversation] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [initialUsername, setInitialUsername] = useState('')
  const [pending, setPending] = useState<PendingMessage[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [online, setOnline] = useState(navigator.onLine)
  const [error, setError] = useState('')
  const flushing = useRef(false)
  const unreadConversationCount = countUnreadConversations(chats)

  function updateAppearance(preference: AppearancePreference) {
    saveAppearancePreference(preference)
    setAppearance(preference)
    applyAppearancePreference(preference)
  }

  const refreshCallHistory = useCallback(async () => {
    const [direct, groups] = await Promise.all([
      api<{ calls: CallRecord[] }>('/api/calls'),
      api<{ calls: CallRecord[] }>('/api/group-calls'),
    ])
    setCallHistory([...direct.calls, ...groups.calls].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)))
  }, [])

  const refreshInbox = useCallback(async () => {
    const [inbox, requestList, draftMap] = await Promise.all([
      api<{ chats: Chat[] }>('/api/inbox'),
      api<{ requests: IncomingRequest[] }>('/api/requests'),
      listAllDrafts().catch(() => ({} as Record<string, string>)),
    ])
    const readableChats = await Promise.all(inbox.chats.map(async (chat) => {
      if (!chat.last_body_ciphertext || !chat.last_body_nonce) return { ...chat, preview: '' }
      try {
        const preview = await decryptMessage({
          bodyCiphertext: chat.last_body_ciphertext,
          bodyNonce: chat.last_body_nonce,
          keyEnvelope: chat.last_key_envelope,
        })
        return { ...chat, preview }
      } catch {
        return { ...chat, preview: 'Encrypted message' }
      }
    }))
    setChats(readableChats as Chat[])
    setRequests(requestList.requests)
    setDrafts(draftMap)
    setError('')
  }, [])

  const flushOutbox = useCallback(async () => {
    if (!navigator.onLine || flushing.current) return
    flushing.current = true
    try {
      const queued = await listPendingMessages()
      for (const message of queued) {
        if (message.nextAttemptAt > Date.now()) continue
        try {
          await api(`/api/chats/${message.chatId}/messages`, {
            method: 'POST',
            body: JSON.stringify({
              bodyCiphertext: message.bodyCiphertext,
              bodyNonce: message.bodyNonce,
              keyEnvelopes: message.keyEnvelopes,
              idempotencyKey: message.idempotencyKey,
              ...(message.attachmentIds?.length ? { attachmentIds: message.attachmentIds } : {}),
              ...(message.replyToId ? { replyToId: message.replyToId } : {}),
            }),
          })
          await removePendingMessage(message.idempotencyKey)
          setPending((current) => current.filter((item) => item.idempotencyKey !== message.idempotencyKey))
          await refreshInbox()
          if (message.chatId === activeChatId) window.dispatchEvent(new Event('syncup-refresh-chat'))
        } catch {
          const attempts = message.attempts + 1
          const delay = Math.min(30_000, 500 * 2 ** Math.min(attempts, 6))
          await savePendingMessage({ ...message, attempts, nextAttemptAt: Date.now() + delay })
          setPending((current) => current.map((item) => item.idempotencyKey === message.idempotencyKey
            ? { ...item, attempts, nextAttemptAt: Date.now() + delay }
            : item))
          if (!navigator.onLine) break
        }
      }
    } catch (queueError) {
      setError(queueError instanceof Error ? queueError.message : 'Unable to process your local outbox.')
    } finally {
      flushing.current = false
    }
  }, [activeChatId, refreshInbox])

  const requestInboxRefresh = useCallback(() => {
    void refreshInbox().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : 'Unable to refresh the inbox.')
    })
  }, [refreshInbox])

  const updateSearchableMessages = useCallback((chatId: string, messages: SearchableMessage[]) => {
    setSearchableMessages((current) => ({ ...current, [chatId]: messages }))
  }, [])

  useEffect(() => {
    if (activeCall) return
    let active = true
    const pollIncomingCalls = () => {
      Promise.all([
        api<{ calls: IncomingCall[] }>('/api/calls/incoming'),
        api<{ calls: IncomingCall[] }>('/api/group-calls/incoming'),
      ])
        .then(([direct, groups]) => {
          if (active) setIncomingCall([...direct.calls, ...groups.calls][0] ?? null)
        })
        .catch((loadError: unknown) => {
          if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to check incoming calls.')
        })
    }
    pollIncomingCalls()
    const interval = window.setInterval(pollIncomingCalls, 3000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [activeCall])

  useEffect(() => {
    let active = true
    const initialLoad = window.setTimeout(() => {
      refreshInbox().catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load the inbox.')
      })
      listPendingMessages().then((items) => { if (active) setPending(items) })
        .catch((queueError: unknown) => { if (active) setError(queueError instanceof Error ? queueError.message : 'Unable to load pending messages.') })
    }, 0)
    const interval = window.setInterval(() => {
      refreshInbox().catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to refresh the inbox.')
      })
      void flushOutbox()
    }, 15_000)
    const wake = () => { void flushOutbox() }
    const updateOnline = () => { setOnline(navigator.onLine); if (navigator.onLine) void flushOutbox() }
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    window.addEventListener('syncup-outbox-wake', wake)
    return () => {
      active = false
      window.clearTimeout(initialLoad)
      window.clearInterval(interval)
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
      window.removeEventListener('syncup-outbox-wake', wake)
    }
  }, [flushOutbox, refreshInbox])

  useEffect(() => {
    const closeChat = () => setActiveChatId(null)
    const refreshChat = () => { void refreshInbox() }
    window.addEventListener('syncup-close-chat', closeChat)
    window.addEventListener('syncup-refresh-chat', refreshChat)
    return () => {
      window.removeEventListener('syncup-close-chat', closeChat)
      window.removeEventListener('syncup-refresh-chat', refreshChat)
    }
  }, [refreshInbox])

  useEffect(() => {
    const adjustMobileCallsView = () => {
      if (showCalls && window.matchMedia('(max-width: 700px)').matches) setActiveChatId(null)
    }
    window.addEventListener('resize', adjustMobileCallsView)
    return () => window.removeEventListener('resize', adjustMobileCallsView)
  }, [showCalls])

  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', openSearch)
    return () => window.removeEventListener('keydown', openSearch)
  }, [])

  async function acceptRequest(item: IncomingRequest) {
    try {
      await api(`/api/requests/${item.id}/accept`, { method: 'POST' })
      await refreshInbox()
      setShowRequests(false)
      setActiveChatId(item.chat_id)
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : 'Unable to accept this request.')
    }
  }

  async function ignoreRequest(item: IncomingRequest) {
    try {
      await api(`/api/requests/${item.id}/ignore`, { method: 'POST' })
      await refreshInbox()
    } catch (ignoreError) {
      setError(ignoreError instanceof Error ? ignoreError.message : 'Unable to ignore this request.')
    }
  }

  async function signOut() {
    try {
      await api<void>('/api/auth/sign-out', { method: 'POST' })
      lockKeyBundle()
      onSignedOut()
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Unable to sign out.')
    }
  }

  async function acceptIncomingCall() {
    if (!incomingCall) return
    let joinedGroup = false
    try {
      if (incomingCall.is_group) {
        const { isE2EESupported } = await import('livekit-client')
        if (!isE2EESupported()) {
          throw new Error('This browser cannot securely decrypt group-call media.')
        }
        const result = await api<{ call: { id: string; chat_id: string; call_type: 'audio' | 'video'; key_envelope: string } }>(
          `/api/group-calls/${incomingCall.id}/answer`,
          { method: 'POST' },
        )
        joinedGroup = true
        const e2eeKey = await unwrapMediaKey(result.call.key_envelope)
        setActiveCall({
          id: result.call.id,
          chatId: result.call.chat_id,
          callType: result.call.call_type,
          title: incomingCall.group_title ?? 'Group call',
          isGroup: true,
          isHost: false,
          e2eeKey,
        })
      } else {
        await api(`/api/calls/${incomingCall.id}/accept`, { method: 'POST' })
        setActiveCall({
          id: incomingCall.id,
          chatId: incomingCall.chat_id,
          callType: incomingCall.call_type,
          title: incomingCall.caller_name,
        })
      }
      setIncomingCall(null)
      setShowCalls(false)
      setActiveChatId(incomingCall.chat_id)
    } catch (callError) {
      if (joinedGroup) {
        try {
          await api(`/api/group-calls/${incomingCall.id}/leave`, { method: 'POST' })
        } catch (leaveError) {
          setError(`${callError instanceof Error ? callError.message : 'Unable to answer this call.'} Unable to leave the failed call: ${leaveError instanceof Error ? leaveError.message : 'unknown error'}`)
          return
        }
      }
      setError(callError instanceof Error ? callError.message : 'Unable to answer this call.')
    }
  }

  async function declineIncomingCall() {
    if (!incomingCall) return
    try {
      await api(`/api/${incomingCall.is_group ? 'group-calls' : 'calls'}/${incomingCall.id}/decline`, { method: 'POST' })
      setIncomingCall(null)
      await refreshCallHistory()
    } catch (callError) {
      setError(callError instanceof Error ? callError.message : 'Unable to decline this call.')
    }
  }

  async function endActiveCall() {
    if (!activeCall) return
    try {
      if (activeCall.isVoiceRoom) {
        setActiveCall(null)
        return
      } else if (activeCall.isGroup) {
        await api(`/api/group-calls/${activeCall.id}/${activeCall.isHost ? 'end' : 'leave'}`, { method: 'POST' })
      } else {
        await api(`/api/calls/${activeCall.id}/end`, { method: 'POST' })
      }
      await refreshCallHistory()
    } catch (callError) {
      setError(callError instanceof Error ? callError.message : 'Unable to end this call on the server.')
    } finally {
      activeCall.e2eeKey?.fill(0)
      setActiveCall(null)
      window.dispatchEvent(new Event('syncup-refresh-chat'))
      void refreshInbox()
    }
  }

  function closeFinishedCall() {
    activeCall?.e2eeKey?.fill(0)
    setActiveCall(null)
    void refreshCallHistory().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : 'Unable to refresh call history.')
    })
    void refreshInbox()
  }

  function openCallHistory() {
    openCalls()
    refreshCallHistory().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load call history.')
    })
  }

  function startNewCall(callType: 'audio' | 'video' = 'audio') {
    if (activeCall || incomingCall) {
      setError('Finish your current call before starting another one.')
      return
    }
    setNewCallRequested(true)
    setNewCallRequestedType(callType)
    setNewConversation(true)
  }

  function redialCall(call: CallRecord, callType: 'audio' | 'video') {
    if (activeCall || incomingCall) {
      setError('Finish your current call before starting another one.')
      return
    }
    setCallIntent({ id: crypto.randomUUID(), chatId: call.chat_id, callType })
    selectChat(call.chat_id)
  }

  const consumeCallIntent = useCallback((id: string) => {
    setCallIntent((current) => current?.id === id ? null : current)
  }, [])

  return (
    <>
    <a className="skip-link" href="#workspace-main">Skip to main content</a>
    <main id="workspace-main" tabIndex={-1} className={`workspace${activeChatId ? ' has-active-chat' : ''}${showCalls ? ' has-active-calls' : ''}${showSpaces ? ' has-active-space' : ''}${showUpdates ? ' has-active-updates' : ''}`}>
      <WorkspaceRail
        user={currentUser}
        showCalls={showCalls}
        showUpdates={showUpdates}
        showSpaces={showSpaces}
        unreadConversationCount={unreadConversationCount}
        onShowChats={showChatsHome}
        onShowCalls={openCallHistory}
        onShowUpdates={openUpdates}
        onShowSpaces={openSpaces}
        onOpenAccount={() => setAccountOpen(true)}
      />
      <InboxPane
        showCalls={showCalls}
        callHistory={callHistory}
        userId={currentUser.id}
        filter={filter}
        showRequests={showRequests}
        requests={requests}
        error={error}
        chats={chats}
        drafts={drafts}
        activeChatId={activeChatId}
        online={online}
        onSelectChat={selectChat}
        onSelectCall={selectChat}
        onCallAgain={redialCall}
        onNewCall={() => startNewCall('audio')}
        onSelectRequest={() => setShowRequests(false)}
        onSelectFilter={(value) => { setFilter(value); setShowRequests(false) }}
        onShowRequests={() => { setShowRequests(true); setFilter('all') }}
        onNewConversation={() => setNewConversation(true)}
        onOpenSearch={() => setSearchOpen(true)}
      />
      {!showCalls && <Conversation
        key={activeChatId ?? 'welcome'}
        user={currentUser}
        chatId={activeChatId}
        refreshInbox={requestInboxRefresh}
        online={online}
        pending={pending}
        onQueued={(message) => setPending((current) => [...current, message])}
        onCallStarted={setActiveCall}
        callIntent={callIntent}
        onCallIntentConsumed={consumeCallIntent}
        onSearchableMessages={updateSearchableMessages}
        onGroupConverted={(spaceId, channelId) => {
          openConvertedSpace(spaceId, channelId)
          requestInboxRefresh()
        }}
      />}
      {showCalls && <CallsHome onAudioCall={() => startNewCall('audio')} onVideoCall={() => startNewCall('video')} />}
      <MobileNavigation
        section={showSpaces ? 'spaces' : showUpdates ? 'updates' : showCalls ? 'calls' : 'chats'}
        accountOpen={accountOpen}
        unreadConversationCount={unreadConversationCount}
        onShowChats={showChatsHome}
        onShowCalls={openCallHistory}
        onShowUpdates={openUpdates}
        onShowSpaces={openSpaces}
        onOpenAccount={() => setAccountOpen(true)}
      />
      {showUpdates && <UpdatesPage userId={currentUser.id} onOpenTarget={openUpdateTarget} onOpenCall={(call) => {
        if (call.space_id) openUpdateTarget(call.space_id, call.chat_id, '')
        else selectChat(call.chat_id)
      }} />}
      {showSpaces && <SpacesPage userId={currentUser.id} openTarget={updatesTarget} onBack={showChatsHome} onJoinVoiceRoom={(call) => {
        if (activeCall) {
          setError('Leave your active call before joining a Space voice room.')
          return
        }
        setActiveCall(call)
      }} />}
      <footer className="workspace-footer"><button type="button" onClick={signOut}>Sign out</button><span>Chats · End-to-end encrypted</span></footer>
      {accountOpen && <AccountPanel user={currentUser} appearance={appearance} onAppearanceChange={updateAppearance} onClose={() => setAccountOpen(false)} onSaved={setCurrentUser} />}
      {newConversation && <NewConversation user={currentUser} initialUsername={initialUsername} onClose={() => { setNewConversation(false); setInitialUsername(''); setNewCallRequested(false); setNewCallRequestedType('audio') }} onCreated={(chatId) => {
        setNewConversation(false)
        setInitialUsername('')
        setActiveChatId(chatId)
        if (newCallRequested) {
          setCallIntent({ id: crypto.randomUUID(), chatId, callType: newCallRequestedType })
          setNewCallRequested(false)
          setNewCallRequestedType('audio')
        }
        void refreshInbox()
      }} />}
      {searchOpen && <SearchDialog
        chats={chats}
        messages={Object.values(searchableMessages).flat()}
        onClose={() => setSearchOpen(false)}
        onSelectChat={(chatId) => {
          setSearchOpen(false)
          selectSearchChat(chatId)
        }}
        onSelectPerson={(username) => {
          setSearchOpen(false)
          setInitialUsername(username)
          setNewConversation(true)
        }}
      />}
      {showRequests && <RequestsPanel requests={requests} onAccept={(item) => void acceptRequest(item)} onIgnore={(item) => void ignoreRequest(item)} onClose={() => setShowRequests(false)} />}
      {incomingCall && !activeCall && <IncomingCallBanner incomingCall={incomingCall} onAnswer={() => void acceptIncomingCall()} onDecline={() => void declineIncomingCall()} />}
      {activeCall && <CallWindow
        callId={activeCall.id}
        title={activeCall.title}
        video={activeCall.callType === 'video'}
        isGroup={activeCall.isGroup}
        isHost={activeCall.isHost}
        e2eeKey={activeCall.e2eeKey}
        isVoiceRoom={activeCall.isVoiceRoom}
        voiceSpaceId={activeCall.voiceSpaceId}
        voiceChannelId={activeCall.voiceChannelId}
        canPublish={activeCall.canPublish}
        localUser={{ id: currentUser.id, name: currentUser.display_name, avatarUrl: currentUser.avatar_url }}
        onEnd={() => void endActiveCall()}
        onClose={closeFinishedCall}
      />}
    </main>
    </>
  )
}
