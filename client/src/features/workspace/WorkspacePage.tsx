import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../shared/api'
import { decryptMessage, lockKeyBundle } from '../auth/crypto/crypto'
import { listPendingMessages, removePendingMessage, savePendingMessage } from '../messaging/outbox'
import type { PendingMessage } from '../messaging/outbox'
import type { ActiveCall, CallRecord, Chat, IncomingRequest, User } from '../../shared/types'
import { AccountPanel } from '../account/AccountPanel'
import { NewConversation } from '../messaging/NewConversation'
import { RequestsPanel } from '../messaging/RequestsPanel'
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
  const [incomingCall, setIncomingCall] = useState<(CallRecord & { caller_name: string; caller_username: string }) | null>(null)
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)
  const [newConversation, setNewConversation] = useState(false)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingMessage[]>([])
  const [online, setOnline] = useState(navigator.onLine)
  const [error, setError] = useState('')
  const flushing = useRef(false)

  const refreshCallHistory = useCallback(async () => {
    const result = await api<{ calls: CallRecord[] }>('/api/calls')
    setCallHistory(result.calls)
  }, [])

  const refreshInbox = useCallback(async () => {
    const [inbox, requestList] = await Promise.all([
      api<{ chats: Chat[] }>('/api/inbox'),
      api<{ requests: IncomingRequest[] }>('/api/requests'),
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
      api<{ calls: (CallRecord & { caller_name: string; caller_username: string })[] }>('/api/calls/incoming')
        .then((result) => {
          if (active) setIncomingCall(result.calls[0] ?? null)
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
    try {
      await api(`/api/calls/${incomingCall.id}/accept`, { method: 'POST' })
      setActiveCall({
        id: incomingCall.id,
        chatId: incomingCall.chat_id,
        callType: incomingCall.call_type,
        title: incomingCall.caller_name,
      })
      setIncomingCall(null)
      setShowCalls(false)
      setActiveChatId(incomingCall.chat_id)
    } catch (callError) {
      setError(callError instanceof Error ? callError.message : 'Unable to answer this call.')
    }
  }

  async function declineIncomingCall() {
    if (!incomingCall) return
    try {
      await api(`/api/calls/${incomingCall.id}/decline`, { method: 'POST' })
      setIncomingCall(null)
      await refreshCallHistory()
    } catch (callError) {
      setError(callError instanceof Error ? callError.message : 'Unable to decline this call.')
    }
  }

  async function endActiveCall() {
    if (!activeCall) return
    try {
      await api(`/api/calls/${activeCall.id}/end`, { method: 'POST' })
      await refreshCallHistory()
    } catch (callError) {
      setError(callError instanceof Error ? callError.message : 'Unable to end this call on the server.')
    } finally {
      setActiveCall(null)
      window.dispatchEvent(new Event('syncup-refresh-chat'))
      void refreshInbox()
    }
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
        activeChatId={activeChatId}
        online={online}
        onSelectChat={setActiveChatId}
        onSelectCall={(chatId) => { setActiveChatId(chatId); setShowCalls(false) }}
        onSelectRequest={() => setShowRequests(false)}
        onSelectFilter={(value) => { setFilter(value); setShowRequests(false) }}
        onShowRequests={() => { setShowRequests(true); setFilter('all') }}
        onNewConversation={() => setNewConversation(true)}
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
      {newConversation && <NewConversation user={currentUser} onClose={() => setNewConversation(false)} onCreated={(chatId) => {
        setNewConversation(false)
        setActiveChatId(chatId)
        void refreshInbox()
      }} />}
      {showRequests && <RequestsPanel requests={requests} onAccept={(item) => void acceptRequest(item)} onIgnore={(item) => void ignoreRequest(item)} onClose={() => setShowRequests(false)} />}
      {incomingCall && !activeCall && <section className="incoming-call-banner" aria-label="Incoming call">
        <span className="avatar">{incomingCall.caller_name.slice(0, 1).toUpperCase()}</span>
        <div><strong>{incomingCall.caller_name}</strong><small>Incoming {incomingCall.call_type} call</small></div>
        <button type="button" className="answer-call-button" onClick={() => void acceptIncomingCall()}>Answer</button>
        <button type="button" className="decline-call-button" onClick={() => void declineIncomingCall()}>Decline</button>
      </section>}
      {activeCall && <CallWindow callId={activeCall.id} title={activeCall.title} video={activeCall.callType === 'video'} onEnd={() => void endActiveCall()} />}
    </main>
  )
}
