import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Search, X } from 'lucide-react'
import { api, apiUpload } from '../../shared/api'
import { decryptMessage, encryptAttachment, encryptMessage } from '../auth/crypto/crypto'
import { loadDraft, saveDraft, savePendingMessage } from './outbox'
import type { PendingMessage } from './outbox'
import type { ActiveCall, CallRecord, ChatKind, ChatMember, DisplayMessage, EncryptedChatMessage, StagedAttachment, User } from '../../shared/types'
import { BrandMark } from '../../shared/components/BrandMark'
import { ConversationHeader } from './ConversationHeader'
import { MessageComposer } from './MessageComposer'
import { MessageList } from './MessageList'
import { ReportDialog } from './ReportDialog'
import { GroupMembersDialog } from './GroupMembersDialog'
import { prepareVideoV2 } from '../media/v2/prepareVideo'
import { mediaV2UploadManager } from '../media/v2/runtime'
import type { MediaV2UploadSnapshot } from '../media/v2/uploadManager'
import type { PendingVideoChoice } from './MessageComposer'
export function Conversation({ user, chatId, refreshInbox, online, pending, onQueued, onCallStarted }: {
  user: User
  chatId: string | null
  refreshInbox: () => void
  online: boolean
  pending: PendingMessage[]
  onQueued: (message: PendingMessage) => void
  onCallStarted: (call: ActiveCall) => void
}) {
  const [chat, setChat] = useState<{ id: string; kind: ChatKind; title: string | null; last_seq: string; last_read_seq: string; members: ChatMember[] } | null>(null)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [callHistory, setCallHistory] = useState<CallRecord[]>([])
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<DisplayMessage | null>(null)
  const [editingMessage, setEditingMessage] = useState<DisplayMessage | null>(null)
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null)
  const [managingMembers, setManagingMembers] = useState(false)
  const [messageSearchOpen, setMessageSearchOpen] = useState(false)
  const [messageSearch, setMessageSearch] = useState('')
  const [hasOlderMessages, setHasOlderMessages] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(() => new Set())
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({})
  const [stagedAttachments, setStagedAttachments] = useState<StagedAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [videoChoice, setVideoChoice] = useState<PendingVideoChoice | null>(null)
  const [videoSends, setVideoSends] = useState<MediaV2UploadSnapshot[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [callStarting, setCallStarting] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(chatId))
  const lastSeq = useRef(0)
  const messageListRef = useRef<HTMLDivElement>(null)
  const initialScrollPending = useRef(Boolean(chatId))
  const scrollAnchor = useRef<{ height: number; top: number } | null>(null)
  const loadingOlderRef = useRef(false)
  const shouldStickToBottom = useRef(true)
  const lastTypingSent = useRef(0)
  const typingActive = useRef(false)
  const typingTimers = useRef(new Map<string, number>())
  const submittingRef = useRef(false)
  const uploadingFileKeys = useRef(new Set<string>())
  const stagedFileKeys = useRef(new Map<string, string>())

  const loadConversation = useCallback(async (id: string, initial: boolean) => {
    try {
      const [chatResult, messageResult, callResult] = await Promise.all([
        api<{ chat: { id: string; kind: ChatKind; title: string | null; last_seq: string; last_read_seq: string; members: ChatMember[] } }>(`/api/chats/${id}`),
        api<{ messages: EncryptedChatMessage[]; hasMore: boolean }>(`/api/chats/${id}/messages?${initial ? 'limit=50' : `after_seq=${lastSeq.current}&limit=100`}`),
        api<{ calls: CallRecord[] }>(`/api/chats/${id}/calls`),
      ])
      const displayed = await Promise.all(messageResult.messages.map(async (message) => ({
        ...message,
        text: message.deleted_at ? '' : await decryptMessage({
          bodyCiphertext: message.body_ciphertext,
          bodyNonce: message.body_nonce,
          keyEnvelope: message.key_envelope,
        }).catch(() => 'Unable to decrypt this message on this device.'),
      })))
      setChat(chatResult.chat)
      setCallHistory(callResult.calls)
      setMessages((current) => {
        if (initial) return displayed
        const existing = new Set(current.map((message) => message.id))
        return [...current, ...displayed.filter((message) => !existing.has(message.id))]
      })
      if (initial) {
        setHasOlderMessages(messageResult.hasMore)
        initialScrollPending.current = true
      }
      lastSeq.current = Math.max(lastSeq.current, ...displayed.map((message) => Number(message.server_seq)), 0)
      setError('')
      if (lastSeq.current > Number(chatResult.chat.last_read_seq)) {
        await api(`/api/chats/${id}/read`, {
          method: 'POST',
          body: JSON.stringify({ lastSeq: lastSeq.current }),
        })
        refreshInbox()
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load this conversation.')
    } finally {
      if (initial) setLoading(false)
    }
  }, [refreshInbox])

  const loadOlderMessages = useCallback(async () => {
    const firstMessage = messages[0]
    if (!chatId || !firstMessage || !hasOlderMessages || loadingOlderRef.current) return
    loadingOlderRef.current = true
    setLoadingOlder(true)
    try {
      const result = await api<{ messages: EncryptedChatMessage[]; hasMore: boolean }>(
        `/api/chats/${chatId}/messages?before_seq=${encodeURIComponent(firstMessage.server_seq)}&limit=50`,
      )
      const earlier = await Promise.all(result.messages.map(async (message) => ({
        ...message,
        text: message.deleted_at ? '' : await decryptMessage({
          bodyCiphertext: message.body_ciphertext,
          bodyNonce: message.body_nonce,
          keyEnvelope: message.key_envelope,
        }).catch(() => 'Unable to decrypt this message on this device.'),
      })))
      const container = messageListRef.current
      if (container && earlier.length > 0) {
        scrollAnchor.current = { height: container.scrollHeight, top: container.scrollTop }
      }
      setMessages((current) => {
        const existing = new Set(current.map((message) => message.id))
        return [...earlier.filter((message) => !existing.has(message.id)), ...current]
      })
      setHasOlderMessages(result.hasMore)
      if (result.messages.length === 0) scrollAnchor.current = null
    } catch (historyError) {
      scrollAnchor.current = null
      setError(historyError instanceof Error ? historyError.message : 'Unable to load earlier messages.')
    } finally {
      loadingOlderRef.current = false
      setLoadingOlder(false)
    }
  }, [chatId, hasOlderMessages, messages])

  useLayoutEffect(() => {
    const container = messageListRef.current
    if (!container) return
    if (scrollAnchor.current) {
      const anchor = scrollAnchor.current
      container.scrollTop = container.scrollHeight - anchor.height + anchor.top
      scrollAnchor.current = null
    } else if (initialScrollPending.current && !loading) {
      container.scrollTop = container.scrollHeight
      initialScrollPending.current = false
      shouldStickToBottom.current = true
    } else if (shouldStickToBottom.current) {
      container.scrollTop = container.scrollHeight
    }
  }, [messages, loading, loadingOlder, messageSearch])

  const handleMessageListScroll = useCallback(() => {
    const container = messageListRef.current
    if (!container) return
    shouldStickToBottom.current = container.scrollHeight - container.scrollTop - container.clientHeight < 80
    if (container.scrollTop < 120) void loadOlderMessages()
  }, [loadOlderMessages])

  useEffect(() => {
    lastSeq.current = 0
    if (chatId) void loadConversation(chatId, true)
  }, [chatId, loadConversation])

  useEffect(() => {
    if (!chatId) return
    const timers = typingTimers.current
    const source = new EventSource(`/api/events?chat_id=${encodeURIComponent(chatId)}`)
    source.addEventListener('message.created', () => {
      void loadConversation(chatId, false)
      refreshInbox()
    })
    source.addEventListener('presence', (event) => {
      const update = JSON.parse((event as MessageEvent<string>).data) as { userId: string; online: boolean }
      setOnlineUsers((current) => {
        const next = new Set(current)
        if (update.online) next.add(update.userId)
        else next.delete(update.userId)
        return next
      })
    })
    source.addEventListener('typing', (event) => {
      const update = JSON.parse((event as MessageEvent<string>).data) as { userId: string; displayName: string; active: boolean }
      if (update.active) {
        setTypingUsers((current) => ({ ...current, [update.userId]: update.displayName }))
        const previous = timers.get(update.userId)
        if (previous) window.clearTimeout(previous)
        timers.set(update.userId, window.setTimeout(() => {
          setTypingUsers((current) => {
            const next = { ...current }
            delete next[update.userId]
            return next
          })
          timers.delete(update.userId)
        }, 3500))
      } else {
        const previous = timers.get(update.userId)
        if (previous) window.clearTimeout(previous)
        timers.delete(update.userId)
        setTypingUsers((current) => {
          const next = { ...current }
          delete next[update.userId]
          return next
        })
      }
    })
    source.addEventListener('membership.changed', () => {
      void loadConversation(chatId, true)
      refreshInbox()
    })
    const wake = () => { void loadConversation(chatId, false) }
    window.addEventListener('syncup-refresh-chat', wake)
    const fallback = window.setInterval(() => {
      if (navigator.onLine) void loadConversation(chatId, false)
    }, 30_000)
    return () => {
      source.close()
      for (const timer of timers.values()) window.clearTimeout(timer)
      timers.clear()
      window.clearInterval(fallback)
      window.removeEventListener('syncup-refresh-chat', wake)
    }
  }, [chatId, loadConversation, refreshInbox])

  useEffect(() => {
    typingActive.current = false
    lastTypingSent.current = 0
  }, [chatId])

  useEffect(() => {
    if (!chatId) return
    let cancelled = false
    loadDraft(chatId).then((value) => { if (!cancelled) setDraft(value) })
      .catch((draftError: unknown) => {
        if (!cancelled) setError(draftError instanceof Error ? draftError.message : 'Unable to restore your draft.')
      })
    return () => { cancelled = true }
  }, [chatId])

  useEffect(() => {
    if (!chatId) return
    const timeout = window.setTimeout(() => {
      void saveDraft(chatId, draft).catch((draftError: unknown) => {
        setError(draftError instanceof Error ? draftError.message : 'Unable to save your draft.')
      })
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [chatId, draft])

  useEffect(() => mediaV2UploadManager.subscribe((snapshots) => {
    setVideoSends(snapshots.filter((item) => item.chatId === chatId && item.status !== 'sent'))
    for (const item of snapshots) {
      if (item.chatId !== chatId || item.status !== 'sent') continue
      void import('../media/v2/jobStore').then(async ({ getMediaV2Job }) => {
        const job = await getMediaV2Job(item.jobId)
        if (!job?.keyEnvelope) return
        setStagedAttachments((current) => current.some((attachment) => attachment.id === job.attachmentId) ? current : [...current, {
          id: job.attachmentId,
          filename: job.filename,
          content_type: job.contentType,
          size_bytes: job.plaintextSize,
          nonce: null,
          key_envelope: job.keyEnvelope!,
          transport_version: 2,
        }])
      })
    }
  }), [chatId])

  const activePending = useMemo(
    () => pending.filter((message) => message.chatId === chatId),
    [chatId, pending],
  )

  async function uploadFile(file: File) {
    if (!chat || !chatId || !file) return
    const fileKey = JSON.stringify([file.name, file.size, file.type, file.lastModified])
    if (uploadingFileKeys.current.has(fileKey) || [...stagedFileKeys.current.values()].includes(fileKey)) {
      setError(`${file.name} is already selected.`)
      return
    }
    const image = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)
    const video = ['video/mp4', 'video/webm'].includes(file.type)
    if (video) {
      setVideoChoice({ file, mode: 'hd' })
      return
    }
    const fileType = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip',
      'text/plain',
    ].includes(file.type)
    if ((!image && !fileType) || file.size === 0 || file.size > (image ? 10 : 25) * 1024 * 1024) {
      setError('Images must be up to 10 MB. Supported documents are up to 25 MB.')
      return
    }
    uploadingFileKeys.current.add(fileKey)
    setUploading(true)
    setError('')
    try {
      const encrypted = await encryptAttachment(file, chat.members)
      const intent = await api<{ attachmentId: string }>('/api/uploads/intent', {
        method: 'POST',
        body: JSON.stringify({
          chatId,
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
          nonce: encrypted.nonce,
          keyEnvelopes: encrypted.keyEnvelopes,
        }),
      })
      await apiUpload(`/api/uploads/${intent.attachmentId}/content`, encrypted.ciphertext)
      await api<void>(`/api/uploads/${intent.attachmentId}/complete`, { method: 'POST' })
      stagedFileKeys.current.set(intent.attachmentId, fileKey)
      setStagedAttachments((current) => [...current, {
        id: intent.attachmentId,
        filename: file.name,
        content_type: file.type,
        size_bytes: file.size,
        nonce: encrypted.nonce,
        key_envelope: encrypted.keyEnvelopes[user.id],
      }])
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload this encrypted file.')
    } finally {
      uploadingFileKeys.current.delete(fileKey)
      setUploading(uploadingFileKeys.current.size > 0)
    }
  }

  async function chooseVideoMode(mode: 'standard' | 'hd' | 'original') {
    if (!videoChoice || !chat || !chatId) return
    const file = videoChoice.file
    setVideoChoice(null)
    setUploading(true)
    setError('')
    try {
      await prepareVideoV2(file, chatId, chat.members, user.id, mode)
    } catch (videoError) {
      setError(videoError instanceof Error && /limited to|Choose an MP4|non-empty video/.test(videoError.message) ? videoError.message : 'Couldn’t prepare this video. Try again.')
    } finally {
      setUploading(false)
    }
  }

  async function startCall(callType: 'audio' | 'video') {
    if (!chatId || !chat || chat.kind !== 'direct') return
    setCallStarting(true)
    setError('')
    try {
      const result = await api<{ call: { id: string } }>('/api/calls', {
        method: 'POST',
        body: JSON.stringify({ chatId, callType }),
      })
      onCallStarted({ id: result.call.id, chatId, callType, title })
    } catch (callError) {
      setError(callError instanceof Error ? callError.message : 'Unable to start this call.')
    } finally {
      setCallStarting(false)
    }
  }

  async function sendTyping(active: boolean) {
    if (!chatId || !online) return
    if (!active) {
      if (!typingActive.current) return
      typingActive.current = false
    } else {
      const now = Date.now()
      if (now - lastTypingSent.current < 2500) return
      lastTypingSent.current = now
      typingActive.current = true
    }
    try {
      await api(`/api/chats/${chatId}/typing`, {
        method: 'POST',
        body: JSON.stringify({ active }),
      })
    } catch (typingError) {
      if (active) setError(typingError instanceof Error ? typingError.message : 'Unable to send typing status.')
    }
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!chatId || !chat || uploading || submittingRef.current
      || (!text && stagedAttachments.length === 0) || Array.from(text).length > 8000) return
    submittingRef.current = true
    setSubmitting(true)
    void sendTyping(false)
    setError('')
    try {
      if (editingMessage) {
        if (!text) {
          setError('Edited messages cannot be empty.')
          return
        }

        const encrypted = await encryptMessage(text, chat.members)
        await api(`/api/messages/${editingMessage.id}`, {
          method: 'PATCH',
          body: JSON.stringify(encrypted),
        })
        setEditingMessage(null)
        setDraft('')
        await saveDraft(chatId, '')
        await loadConversation(chatId, true)
        refreshInbox()
        return
      }
      const encrypted = await encryptMessage(text, chat.members)
      const selectedFiles = new Set<string>()
      const attachmentsToSend = stagedAttachments.filter((attachment) => {
        const fileKey = stagedFileKeys.current.get(attachment.id) ?? attachment.id
        if (selectedFiles.has(fileKey)) return false
        selectedFiles.add(fileKey)
        return true
      })
      const pendingMessage: PendingMessage = {
        chatId,
        localId: crypto.randomUUID(),
        idempotencyKey: crypto.randomUUID(),
        ...encrypted,
        ...(attachmentsToSend.length ? {
          attachmentIds: attachmentsToSend.map((attachment) => attachment.id),
          attachments: attachmentsToSend,
        } : {}),
        ...(replyTo ? { replyToId: replyTo.id } : {}),
        createdAt: new Date().toISOString(),
        attempts: 0,
        nextAttemptAt: 0,
      }
      await savePendingMessage(pendingMessage)
      onQueued(pendingMessage)
      setDraft('')
      setStagedAttachments([])
      stagedFileKeys.current.clear()
      setReplyTo(null)
      await saveDraft(chatId, '')
      await loadConversation(chatId, false)
      refreshInbox()
      window.dispatchEvent(new Event('syncup-outbox-wake'))
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to queue this message.')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  async function reactTo(message: DisplayMessage, emoji: string) {
    try {
      await api(`/api/messages/${message.id}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      })
      if (chatId) await loadConversation(chatId, false)
    } catch (reactionError) {
      setError(reactionError instanceof Error ? reactionError.message : 'Unable to update reaction.')
    }
  }

  function beginEdit(message: DisplayMessage) {
    setEditingMessage(message)
    setReplyTo(null)
    setDraft(message.text)
  }

  async function deleteMessage(message: DisplayMessage, scope: 'me' | 'everyone') {
    if (scope === 'everyone' && !window.confirm('Delete this message for everyone? This cannot be undone.')) return
    try {
      await api(`/api/messages/${message.id}/delete`, {
        method: 'POST',
        body: JSON.stringify({ scope }),
      })
      if (chatId) await loadConversation(chatId, true)
      refreshInbox()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete this message.')
    }
  }

  async function togglePin(message: DisplayMessage) {
    try {
      const result = await api<{ pinned: boolean }>(`/api/messages/${message.id}/pin`, { method: 'POST' })
      setMessages((current) => current.map((item) => item.id === message.id
        ? { ...item, pinned_by_me: result.pinned }
        : item))
    } catch (pinError) {
      setError(pinError instanceof Error ? pinError.message : 'Unable to pin this message.')
    }
  }

  async function copyMessage(message: DisplayMessage) {
    try {
      await navigator.clipboard.writeText(message.text)
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : 'Unable to copy this message.')
    }
  }

  if (!chatId) {
    return (
      <section className="conversation-pane welcome-pane">
        <div className="welcome-content">
          <div className="welcome-mark"><BrandMark /></div>
          <p className="eyebrow">PRIVATE BY DESIGN</p>
          <h2>Good conversations<br /><em>start with hello.</em></h2>
          <p className="welcome-description">Your personal messages are encrypted on your device. Start a direct chat or create a group with people you trust.</p>
          <div className="welcome-profile"><span className="avatar avatar-card">{user.display_name.slice(0, 1).toUpperCase()}</span><div><span className="small strong">{user.display_name}</span><span className="micro muted">@{user.username}</span></div></div>
        </div>
      </section>
    )
  }

  const title = chat?.kind === 'group'
    ? chat.title ?? 'Group'
    : chat?.members.find((member) => member.id !== user.id)?.displayName ?? 'Direct chat'
  const membersById = new Map(chat?.members.map((member) => [member.id, member]) ?? [])
  const peer = chat?.members.find((member) => member.id !== user.id)
  const otherTypingUsers = Object.entries(typingUsers).filter(([id]) => id !== user.id)
  const typingSubtitle = otherTypingUsers.length === 1
    ? `${otherTypingUsers[0][1]} is typing…`
    : otherTypingUsers.length > 1 ? 'Several people are typing…' : null
  const visibleMessages = [...messages, ...activePending.map((message) => ({
    id: message.localId,
    chat_id: message.chatId,
    server_seq: '',
    sender_id: user.id,
    body_ciphertext: message.bodyCiphertext,
    body_nonce: message.bodyNonce,
    key_envelope: message.keyEnvelopes[user.id],
    reply_to_id: message.replyToId ?? null,
    deleted_at: null,
    created_at: message.createdAt,
    reactions: [],
    attachments: message.attachments ?? [],
    text: '',
    pending: true,
    failed: !online && message.attempts > 0,
  }))].sort((left, right) => {
    if (left.pending && right.pending) return left.created_at.localeCompare(right.created_at)
    if (left.pending) return 1
    if (right.pending) return -1
    return Number(left.server_seq) - Number(right.server_seq)
  })
  return (
    <section className="conversation-pane active-conversation" aria-label={title}>
      <ConversationHeader
        title={title}
        subtitle={typingSubtitle ?? (chat?.kind === 'group'
          ? `${chat.members.length} people · ${onlineUsers.size} online · encrypted`
          : `@${peer?.username ?? ''} · ${peer && onlineUsers.has(peer.id) ? 'online' : 'offline'} · encrypted`)}
        isDirect={chat?.kind === 'direct'}
        callStarting={callStarting}
        online={online}
        onManageGroup={() => setManagingMembers(true)}
        onSearchMessages={() => setMessageSearchOpen((open) => !open)}
        onBack={() => window.dispatchEvent(new Event('syncup-close-chat'))}
        onStartCall={(type) => void startCall(type)}
      />
      {messageSearchOpen && (
        <div className="conversation-search-bar">
          <Search size={14} aria-hidden="true" />
          <input
            autoFocus
            value={messageSearch}
            onChange={(event) => setMessageSearch(event.target.value)}
            placeholder="Search loaded messages on this device"
            aria-label="Search messages in this conversation"
          />
          <span>{messageSearch.trim() ? `${visibleMessages.filter((message) => !message.pending && !message.deleted_at && message.text.toLocaleLowerCase().includes(messageSearch.trim().toLocaleLowerCase())).length} matches` : 'On-device only'}</span>
          <button type="button" onClick={() => { setMessageSearchOpen(false); setMessageSearch('') }} aria-label="Close message search"><X size={14} aria-hidden="true" /></button>
        </div>
      )}
      <MessageList
        messages={messageSearch.trim()
          ? visibleMessages.filter((message) => !message.pending && !message.deleted_at && message.text.toLocaleLowerCase().includes(messageSearch.trim().toLocaleLowerCase()))
          : visibleMessages}
        emptyMessage={messageSearch.trim() ? 'No matching loaded messages. Search is performed only on this device.' : undefined}
        scrollContainerRef={messageListRef}
        onScroll={handleMessageListScroll}
        loadingOlder={loadingOlder}
        calls={callHistory}
        members={chat?.members ?? []}
        currentUserId={user.id}
        loading={loading}
        error={error}
        onReply={setReplyTo}
        onReact={(message, emoji) => void reactTo(message, emoji)}
        onEdit={beginEdit}
        onDelete={(message, scope) => void deleteMessage(message, scope)}
        onPin={(message) => void togglePin(message)}
        onCopy={(message) => void copyMessage(message)}
        onReport={(message) => setReportingMessageId(message.id)}
      />
      <MessageComposer
        draft={draft}
        replyTo={editingMessage ?? replyTo}
        editing={Boolean(editingMessage)}
        replyAuthor={membersById.get(replyTo?.sender_id ?? '')?.displayName ?? 'message'}
        attachments={stagedAttachments}
        uploading={uploading}
        submitting={submitting}
        chatTitle={title}
        onSubmit={submitMessage}
        onDraftChange={setDraft}
        onTypingChange={(value) => void sendTyping(Boolean(value.trim()))}
        onClearReply={() => {
          if (editingMessage) {
            setEditingMessage(null)
            setDraft('')
            if (chatId) void saveDraft(chatId, '')
          } else {
            setReplyTo(null)
          }
        }}
        onRemoveAttachment={(id) => {
          stagedFileKeys.current.delete(id)
          setStagedAttachments((current) => current.filter((item) => item.id !== id))
        }}
        videoChoice={videoChoice}
        videoSends={videoSends}
        onUpload={(file) => void uploadFile(file)}
        onChooseVideoMode={(mode) => void chooseVideoMode(mode)}
        onCancelVideoChoice={() => setVideoChoice(null)}
        onRetryVideo={(jobId) => void mediaV2UploadManager.resume(jobId)}
        onCancelVideo={(jobId) => void mediaV2UploadManager.cancel(jobId)}
      />
      {reportingMessageId && <ReportDialog messageId={reportingMessageId} onClose={() => setReportingMessageId(null)} />}
      {managingMembers && chat?.kind === 'group' && <GroupMembersDialog
        chatId={chat.id}
        members={chat.members}
        currentUserId={user.id}
        onClose={() => setManagingMembers(false)}
        onLeave={() => {
          setManagingMembers(false)
          window.dispatchEvent(new Event('syncup-close-chat'))
          refreshInbox()
        }}
      />}
    </section>
  )
}
