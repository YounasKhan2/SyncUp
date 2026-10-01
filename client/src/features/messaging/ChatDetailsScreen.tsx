import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, LogOut, UserPlus } from 'lucide-react'
import { api } from '../../shared/api'
import type { ChatMember, DiscoveredUser } from '../../shared/types'
import { Avatar } from '../../shared/components/Avatar'

type ChatDetailsScreenProps = {
  chatId: string
  title: string
  isGroup: boolean
  members: ChatMember[]
  currentUserId: string
  onBack: () => void
  onMembersChanged: () => void
  onLeave: () => void
}

export function ChatDetailsScreen({ chatId, title, isGroup, members, currentUserId, onBack, onMembersChanged, onLeave }: ChatDetailsScreenProps) {
  const [username, setUsername] = useState('')
  const [matches, setMatches] = useState<DiscoveredUser[]>([])
  const [selected, setSelected] = useState<DiscoveredUser | null>(null)
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const peer = members.find((member) => member.id !== currentUserId)

  useEffect(() => {
    const query = username.trim().replace(/^@/u, '').toLowerCase()
    if (!isGroup || !query || selected?.username === query || query.length < 3 || !/^[a-z0-9_]+$/u.test(query)) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      setSearching(true)
      void Promise.all([
        api<{ users: DiscoveredUser[] }>(`/api/users?username=${encodeURIComponent(query)}`, { signal: controller.signal }),
        api<{ contacts: DiscoveredUser[] }>('/api/contacts', { signal: controller.signal }),
      ])
        .then(([{ users }, { contacts }]) => setMatches(users.filter((user) =>
          contacts.some((contact) => contact.id === user.id)
          && !members.some((member) => member.id === user.id),
        )))
        .catch((searchError: unknown) => {
          if (!controller.signal.aborted) setError(searchError instanceof Error ? searchError.message : 'Unable to search usernames.')
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false)
        })
    }, 300)
    return () => {
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [isGroup, members, selected, username])

  async function invite() {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      await api(`/api/chats/${chatId}/members`, {
        method: 'POST',
        body: JSON.stringify({ username: selected.username }),
      })
      setUsername('')
      setSelected(null)
      setMatches([])
      onMembersChanged()
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Unable to add this member.')
    } finally {
      setBusy(false)
    }
  }

  async function leave() {
    if (!window.confirm('Leave this group? You will no longer be able to read new messages.')) return
    setBusy(true)
    setError('')
    try {
      await api(`/api/chats/${chatId}/leave`, { method: 'POST' })
      onLeave()
    } catch (leaveError) {
      setError(leaveError instanceof Error ? leaveError.message : 'Unable to leave this group.')
      setBusy(false)
    }
  }

  function handleInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void invite()
  }

  return (
    <section className="chat-details-screen" aria-labelledby="chat-details-title">
      <header className="chat-details-header">
        <button className="chat-details-back" type="button" onClick={onBack} aria-label="Back to conversation"><ArrowLeft size={19} aria-hidden="true" /></button>
        <h1 id="chat-details-title">{isGroup ? 'Group info' : 'Contact info'}</h1>
      </header>
      <div className="chat-details-content">
        <section className="chat-details-identity">
          <Avatar name={isGroup ? title : peer?.displayName ?? title} src={isGroup ? undefined : peer?.avatar_url} className="chat-details-avatar" />
          <h2>{isGroup ? title : peer?.displayName ?? title}</h2>
          <p>{isGroup ? `${members.length} members` : peer ? `@${peer.username}` : 'Encrypted conversation'}</p>
          {isGroup && <small>End-to-end encrypted group</small>}
        </section>

        {isGroup ? (
          <>
            <section className="chat-details-section" aria-labelledby="chat-details-members-title">
              <div className="chat-details-section-heading">
                <h2 id="chat-details-members-title">Members</h2>
                <span>{members.length}/32</span>
              </div>
              <ul className="chat-details-members">
                {members.map((member) => (
                  <li key={member.id}>
                    <Avatar name={member.displayName} src={member.avatar_url} />
                    <span><strong>{member.displayName}{member.id === currentUserId ? ' · You' : ''}</strong><small>@{member.username}</small></span>
                    {member.role === 'owner' && <small className="group-owner-label">Owner</small>}
                  </li>
                ))}
              </ul>
            </section>
            <form className="chat-details-section group-invite" onSubmit={handleInviteSubmit}>
              <h2>Group management</h2>
              <label htmlFor="chat-details-invite">Add a mutual contact</label>
              <div className="username-input"><span>@</span><input
                id="chat-details-invite"
                value={username}
                onChange={(event) => { setUsername(event.target.value); setSelected(null); setMatches([]); setSearching(false); setError('') }}
                placeholder="Search usernames…"
                maxLength={24}
                autoComplete="off"
                disabled={members.length >= 32 || busy}
              /></div>
              <div className="username-search-results" aria-label="Username search results">
                {searching && <p role="status">Searching usernames…</p>}
                {!searching && matches.map((match) => (
                  <button className={`username-match${selected?.id === match.id ? ' is-selected' : ''}`} key={match.id} type="button" onClick={() => { setSelected(match); setUsername(match.username) }}>
                    <Avatar name={match.display_name} src={match.avatar_url} />
                    <span><strong>{match.display_name}</strong><small>@{match.username}</small></span>
                  </button>
                ))}
                {!searching && username.length >= 3 && !selected && matches.length === 0 && !error && <p role="status">No available mutual contact found.</p>}
              </div>
              <p className="group-encryption-note">New members can read messages sent after they join; earlier encrypted messages and files stay private.</p>
              <button className="primary-button" type="submit" disabled={!selected || busy || members.length >= 32}>
                <UserPlus size={14} aria-hidden="true" /> {busy ? 'Adding member…' : 'Add member'}
              </button>
            </form>
            <div className="chat-details-section">
              {error && <div className="form-error" role="alert">{error}</div>}
              <button className="leave-group-button" type="button" onClick={() => void leave()} disabled={busy}><LogOut size={14} aria-hidden="true" /> Leave group</button>
            </div>
          </>
        ) : (
          <section className="chat-details-section chat-details-security">
            <h2>Privacy & security</h2>
            <p>Messages and calls in this conversation are end-to-end encrypted. Only members of this chat can access them.</p>
          </section>
        )}
      </div>
    </section>
  )
}
