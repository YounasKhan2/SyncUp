import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../../shared/api'
import { decryptMessage, encryptAttachment, encryptMessage } from '../auth/crypto/crypto'
import { loadDraft, saveDraft, savePendingMessage } from './outbox'
import type { PendingMessage } from './outbox'
import type { ActiveCall, CallRecord, ChatKind, ChatMember, DisplayMessage, EncryptedChatMessage, StagedAttachment, User } from '../../shared/types'
import { BrandMark } from '../../shared/components/BrandMark'
import { ConversationHeader } from './ConversationHeader'
import { MessageComposer } from './MessageComposer'
import { MessageList } from './MessageList'
import { ReportDialog } from './ReportDialog'
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
  const [stagedAttachments, setStagedAttachments] = useState<StagedAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [callStarting, setCallStarting] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(Boolean(chatId))
  const lastSeq = useRef(0)

  const loadConversation = useCallback(async (id: string, initial: boolean) => {
    try {
      const [chatResult, messageResult, callResult] = await Promise.all([
        api<{ chat: { id: string; kind: ChatKind; title: string | null; last_seq: string; last_read_seq: string; members: ChatMember[] } }>(`/api/chats/${id}`),
        api<{ messages: EncryptedChatMessage[] }>(`/api/chats/${id}/messages?${initial ? 'limit=50' : `after_seq=${lastSeq.current}&limit=100`}`),
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

  useEffect(() => {
    if (chatId) void loadConversation(chatId, true)
  }, [chatId, loadConversation])

  useEffect(() => {
    if (!chatId) return
    const source = new EventSource(`/api/events?chat_id=${encodeURIComponent(chatId)}`)
    source.addEventListener('message.created', () => {
      void loadConversation(chatId, false)
      refreshInbox()
    })
    const wake = () => { void loadConversation(chatId, false) }
    window.addEventListener('syncup-refresh-chat', wake)
    const fallback = window.setInterval(() => {
      if (navigator.onLine) void loadConversation(chatId, false)
    }, 30_000)
    return () => {
      source.close()
      window.clearInterval(fallback)
      window.removeEventListener('syncup-refresh-chat', wake)
    }
  }, [chatId, loadConversation, refreshInbox])

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

  const activePending = useMemo(
    () => pending.filter((message) => message.chatId === chatId),
    [chatId, pending],
  )

  async function uploadFile(file: File) {
    if (!chat || !chatId || !file) return
    const image = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)
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
    setUploading(true)
    setError('')
    try {
      const encrypted = await encryptAttachment(file, chat.members)
      const intent = await api<{ attachmentId: string; uploadUrl: string; uploadContentType: string }>('/api/uploads/intent', {
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
      const uploaded = await fetch(intent.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': intent.uploadContentType },
        body: encrypted.ciphertext,
      })
      if (!uploaded.ok) throw new Error('Encrypted upload failed. Try again.')
      await api<void>(`/api/uploads/${intent.attachmentId}/complete`, { method: 'POST' })
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

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!chatId || !chat || (!text && stagedAttachments.length === 0) || Array.from(text).length > 8000) return
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
      const pendingMessage: PendingMessage = {
        chatId,
        localId: crypto.randomUUID(),
        idempotencyKey: crypto.randomUUID(),
        ...encrypted,
        ...(stagedAttachments.length ? {
          attachmentIds: stagedAttachments.map((attachment) => attachment.id),
          attachments: stagedAttachments,
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
      setReplyTo(null)
      await saveDraft(chatId, '')
      await loadConversation(chatId, false)
      refreshInbox()
      window.dispatchEvent(new Event('syncup-outbox-wake'))
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to queue this message.')
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
  const visibleMessages = [...messages, ...activePending.map((message) => ({
    id: message.localId,
    chat_id: message.chatId,
    server_seq: '',
    sender_id: user.id,
    body_ciphertext: message.bodyCiphertext,
    body_nonce: message.bodyNonce,
    key_envelope: message.keyEnvelopes[user.id],
    reply_to_id: message.replyToId ?? null,
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
        subtitle={chat?.kind === 'group' ? `${chat.members.length} people · encrypted` : `@${chat?.members.find((member) => member.id !== user.id)?.username ?? ''} · encrypted`}
        isDirect={chat?.kind === 'direct'}
        callStarting={callStarting}
        online={online}
        onBack={() => window.dispatchEvent(new Event('syncup-close-chat'))}
        onStartCall={(type) => void startCall(type)}
      />
      <MessageList
        messages={visibleMessages}
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
        chatTitle={title}
        onSubmit={submitMessage}
        onDraftChange={setDraft}
        onClearReply={() => {
          if (editingMessage) {
            setEditingMessage(null)
            setDraft('')
            if (chatId) void saveDraft(chatId, '')
          } else {
            setReplyTo(null)
          }
        }}
        onRemoveAttachment={(id) => setStagedAttachments((current) => current.filter((item) => item.id !== id))}
        onUpload={(file) => void uploadFile(file)}
      />
      {reportingMessageId && <ReportDialog messageId={reportingMessageId} onClose={() => setReportingMessageId(null)} />}
    </section>
  )
}
