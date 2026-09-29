import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Check, Search, X } from 'lucide-react'
import { api } from '../../shared/api'
import type { ChatMember, DiscoveredUser, KeyBundle, User } from '../../shared/types'
import { encryptMessage } from '../auth/crypto/crypto'
export function NewConversation({ user, onClose, onCreated }: {
  user: User
  onClose: () => void
  onCreated: (chatId: string) => void
}) {
  const [mode, setMode] = useState<'direct' | 'group'>('direct')
  const [username, setUsername] = useState('')
  const [usernameMatches, setUsernameMatches] = useState<DiscoveredUser[]>([])
  const [selectedUser, setSelectedUser] = useState<DiscoveredUser | null>(null)
  const [searchingUsers, setSearchingUsers] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [groupName, setGroupName] = useState('')
  const [groupMembers, setGroupMembers] = useState('')
  const [firstMessage, setFirstMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function updateUsername(value: string) {
    const query = value.trim().replace(/^@/u, '').toLowerCase()
    const isSearchable = mode === 'direct' && query.length >= 3 && /^[a-z0-9_]+$/u.test(query)
    setUsername(value)
    setSelectedUser(null)
    setUsernameMatches([])
    setSearchError('')
    setSearchingUsers(isSearchable)
    setError('')
  }

  useEffect(() => {
    const query = username.trim().replace(/^@/u, '').toLowerCase()
    if (selectedUser?.username === query) {
      return
    }
    if (mode !== 'direct' || query.length < 3 || !/^[a-z0-9_]+$/u.test(query)) {
      return
    }
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      void api<{ users: DiscoveredUser[] }>(`/api/users?username=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then(({ users }) => setUsernameMatches(users))
        .catch((searchError: unknown) => {
          if (!controller.signal.aborted) {
            setUsernameMatches([])
            setSearchError(searchError instanceof Error ? searchError.message : 'Unable to search usernames.')
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearchingUsers(false)
        })
    }, 300)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [mode, selectedUser, username])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'direct') {
        const target = selectedUser
        if (!target) throw new Error('Search for and select a username before continuing.')
        const keyResponse = await api<{ keyBundle: KeyBundle }>('/api/auth/key-bundle')
        const contacts = await api<{ contacts: DiscoveredUser[] }>('/api/contacts')
        const contact = contacts.contacts.some((entry) => entry.id === target.id)
        if (!contact) {
          const encrypted = await encryptMessage(firstMessage.trim(), [
            { id: user.id, publicKey: keyResponse.keyBundle.publicKey },
            { id: target.id, publicKey: target.publicKey },
          ])
          const result = await api<{ chatId: string }>('/api/requests', {
            method: 'POST',
            body: JSON.stringify({
              username: target.username,
              message: { ...encrypted, idempotencyKey: crypto.randomUUID() },
            }),
          })
          onCreated(result.chatId)
        } else {
          const result = await api<{ chatId: string }>('/api/chats/direct', {
            method: 'POST',
            body: JSON.stringify({ username: target.username }),
          })
          const chatResult = await api<{ chat: { members: ChatMember[] } }>(`/api/chats/${result.chatId}`)
          const encrypted = await encryptMessage(firstMessage.trim(), chatResult.chat.members)
          await api('/api/chats/' + result.chatId + '/messages', {
            method: 'POST',
            body: JSON.stringify({ ...encrypted, idempotencyKey: crypto.randomUUID() }),
          })
          onCreated(result.chatId)
        }
      } else {
        const usernames = groupMembers.split(',').map((value) => value.trim().replace(/^@/u, '').toLowerCase()).filter(Boolean)
        const result = await api<{ chatId: string }>('/api/chats/groups', {
          method: 'POST',
          body: JSON.stringify({ title: groupName, usernames }),
        })
        onCreated(result.chatId)
      }
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create this conversation.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="account-dialog new-chat-dialog" role="dialog" aria-modal="true" aria-labelledby="new-chat-title">
        <div className="dialog-heading">
          <div><p className="eyebrow">START A CONVERSATION</p><h2 id="new-chat-title">New chat</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close new chat"><X size={15} aria-hidden="true" /></button>
        </div>
        <div className="new-chat-tabs">
          <button type="button" className={mode === 'direct' ? 'selected' : ''} onClick={() => { setMode('direct'); setSearchingUsers(false); setSearchError(''); setError('') }}>Direct message</button>
          <button type="button" className={mode === 'group' ? 'selected' : ''} onClick={() => { setMode('group'); setSelectedUser(null); setSearchingUsers(false); setSearchError(''); setUsernameMatches([]); setError('') }}>Group</button>
        </div>
        <form className="profile-form" onSubmit={submit}>
          {mode === 'direct' ? (
            <>
              <label><span>Username</span><div className="username-input"><span>@</span><input value={username} onChange={(event) => updateUsername(event.target.value)} placeholder="Search usernames" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" autoComplete="off" required /></div></label>
              {username.trim().replace(/^@/u, '').length >= 3 && (
                <div className="username-search-results" aria-label="Username search results">
                  {searchingUsers && <p role="status"><Search size={13} aria-hidden="true" /> Searching usernames…</p>}
                  {!searchingUsers && searchError && <p className="username-search-error" role="alert">{searchError}</p>}
                  {!searchingUsers && !searchError && usernameMatches.length === 0 && <p role="status">No discoverable usernames match yet.</p>}
                  {!searchingUsers && !searchError && usernameMatches.length > 0 && (
                    <div role="listbox" aria-label="Matching usernames">
                      {usernameMatches.map((match) => (
                        <button
                          className={`username-match${selectedUser?.id === match.id ? ' is-selected' : ''}`}
                          key={match.id}
                          type="button"
                          role="option"
                          aria-selected={selectedUser?.id === match.id}
                          onClick={() => { setSelectedUser(match); setUsername(match.username); setSearchingUsers(false) }}
                        >
                          <span><strong>{match.display_name}</strong><small>@{match.username}</small></span>
                          {selectedUser?.id === match.id && <Check size={15} aria-hidden="true" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {selectedUser && <p className="selected-username">Selected <strong>@{selectedUser.username}</strong></p>}
              <label><span>First message</span><textarea value={firstMessage} onChange={(event) => setFirstMessage(event.target.value)} maxLength={8000} rows={3} placeholder="Say hello…" required /></label>
              <p className="sessions-caption">If you haven’t connected before, this arrives as a private message request.</p>
            </>
          ) : (
            <>
              <label><span>Group name</span><input value={groupName} onChange={(event) => setGroupName(event.target.value)} maxLength={80} placeholder="Project team" required /></label>
              <label><span>Contact usernames</span><textarea value={groupMembers} onChange={(event) => setGroupMembers(event.target.value)} rows={3} placeholder="jordan, morgan" required /></label>
              <p className="sessions-caption">Invite 1–31 existing mutual contacts. Encrypted group size is capped at 32 people.</p>
            </>
          )}
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button" type="submit" disabled={loading}>{loading ? 'Creating…' : mode === 'direct' ? 'Continue' : 'Create group'}{!loading && <ArrowRight size={14} aria-hidden="true" />}</button>
        </form>
      </section>
    </div>
  )
}
