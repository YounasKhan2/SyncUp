import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../shared/api'
import { decryptMessage, lockKeyBundle } from '../auth/crypto/crypto'
import { listAllDrafts, listPendingMessages, removePendingMessage, savePendingMessage } from '../messaging/outbox'
import type { PendingMessage } from '../messaging/outbox'
import type { ActiveCall, CallRecord, Chat, IncomingCall, IncomingRequest, User } from '../../shared/types'
import { unwrapMediaKey } from '../auth/crypto/crypto'
import { Avatar } from '../../shared/components/Avatar'
import { AccountPanel } from '../account/AccountPanel'
import { NewConversation } from '../messaging/NewConversation'
import { RequestsPanel } from '../messaging/RequestsPanel'
import { SearchDialog } from '../messaging/SearchDialog'
import { Conversation } from '../messaging/Conversation'
import { CallWindow } from '../calls/CallWindow'
import { InboxPane } from './InboxPane'
import { WorkspaceRail } from './WorkspaceRail'
export function WorkspacePage({ user, onSignedOut }: { user: User; onSignedOut: () => void }) {
  const [accountOpen, setAccountOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState(user)
  const [chats, setChats] = useState<Chat[]>([])
  const [requests, setRequests] = useState<IncomingRequest[]>([])
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [showRequests, setShowRequests] = useState(false)
  const [showCalls, setShowCalls] = useState(false)
  const [callHistory, setCallHistory] = useState<CallRecord[]>([])
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null)
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)
  const [newConversation, setNewConversation] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [initialUsername, setInitialUsername] = useState('')
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingMessage[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [online, setOnline] = useState(navigator.onLine)
  const [error, setError] = useState('')
  const flushing = useRef(false)

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
      if (activeCall.isGroup) {
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
    setShowCalls(true)
    setShowRequests(false)
    refreshCallHistory().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load call history.')
    })
  }

  return (
    <main className={`workspace${activeChatId ? ' has-active-chat' : ''}`}>
      <WorkspaceRail
        user={currentUser}
        showCalls={showCalls}
        onShowChats={() => setShowCalls(false)}
        onShowCalls={openCallHistory}
        onOpenAccount={() => setAccountOpen(true)}
      />
      <InboxPane
        showCalls={showCalls}
        callHistory={callHistory}
        filter={filter}
        showRequests={showRequests}
        requests={requests}
        error={error}
        chats={chats}
        drafts={drafts}
        activeChatId={activeChatId}
        online={online}
        onSelectChat={setActiveChatId}
        onSelectCall={(chatId) => { setActiveChatId(chatId); setShowCalls(false) }}
        onSelectRequest={() => setShowRequests(false)}
        onSelectFilter={(value) => { setFilter(value); setShowRequests(false) }}
        onShowRequests={() => { setShowRequests(true); setFilter('all') }}
        onNewConversation={() => setNewConversation(true)}
        onOpenSearch={() => setSearchOpen(true)}
      />
      <Conversation
        key={activeChatId ?? 'welcome'}
        user={currentUser}
        chatId={activeChatId}
        refreshInbox={requestInboxRefresh}
        online={online}
        pending={pending}
        onQueued={(message) => setPending((current) => [...current, message])}
        onCallStarted={setActiveCall}
      />
      <footer className="workspace-footer"><button type="button" onClick={signOut}>Sign out</button><span>Chats · End-to-end encrypted</span></footer>
      {accountOpen && <AccountPanel user={currentUser} onClose={() => setAccountOpen(false)} onSaved={setCurrentUser} />}
      {newConversation && <NewConversation user={currentUser} initialUsername={initialUsername} onClose={() => { setNewConversation(false); setInitialUsername('') }} onCreated={(chatId) => {
        setNewConversation(false)
        setInitialUsername('')
        setActiveChatId(chatId)
        void refreshInbox()
      }} />}
      {searchOpen && <SearchDialog
        onClose={() => setSearchOpen(false)}
        onSelectChat={(chatId) => {
          setSearchOpen(false)
          setShowCalls(false)
          setShowRequests(false)
          setActiveChatId(chatId)
        }}
        onSelectPerson={(username) => {
          setSearchOpen(false)
          setInitialUsername(username)
          setNewConversation(true)
        }}
      />}
      {showRequests && <RequestsPanel requests={requests} onAccept={(item) => void acceptRequest(item)} onIgnore={(item) => void ignoreRequest(item)} onClose={() => setShowRequests(false)} />}
      {incomingCall && !activeCall && <section className="incoming-call-banner" aria-label="Incoming call">
        <Avatar name={incomingCall.group_title ?? incomingCall.caller_name} src={incomingCall.is_group ? undefined : incomingCall.caller_avatar_url} />
        <div><strong>{incomingCall.group_title ?? incomingCall.caller_name}</strong><small>{incomingCall.is_group ? `${incomingCall.caller_name} is calling` : `Incoming ${incomingCall.call_type} call`}</small></div>
        <button type="button" className="answer-call-button" onClick={() => void acceptIncomingCall()}>Answer</button>
        <button type="button" className="decline-call-button" onClick={() => void declineIncomingCall()}>Decline</button>
      </section>}
      {activeCall && <CallWindow
        callId={activeCall.id}
        title={activeCall.title}
        video={activeCall.callType === 'video'}
        isGroup={activeCall.isGroup}
        isHost={activeCall.isHost}
        e2eeKey={activeCall.e2eeKey}
        onEnd={() => void endActiveCall()}
        onClose={closeFinishedCall}
      />}
    </main>
  )
}
