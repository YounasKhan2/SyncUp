import { useEffect, useState } from 'react'
import { LogOut, UserPlus, X } from 'lucide-react'
import { api } from '../../shared/api'
import type { ChatMember, DiscoveredUser } from '../../shared/types'

export function GroupMembersDialog({ chatId, members, currentUserId, onClose, onLeave }: {
  chatId: string
  members: ChatMember[]
  currentUserId: string
  onClose: () => void
  onLeave: () => void
}) {
  const [username, setUsername] = useState('')
  const [matches, setMatches] = useState<DiscoveredUser[]>([])
  const [selected, setSelected] = useState<DiscoveredUser | null>(null)
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const query = username.trim().replace(/^@/u, '').toLowerCase()
    if (!query || selected?.username === query || query.length < 3 || !/^[a-z0-9_]+$/u.test(query)) return
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
  }, [members, selected, username])

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

  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="account-dialog group-members-dialog" role="dialog" aria-modal="true" aria-labelledby="group-members-title">
        <div className="dialog-heading">
          <div><p className="eyebrow">GROUP SETTINGS</p><h2 id="group-members-title">Members · {members.length}/32</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close group members"><X size={15} aria-hidden="true" /></button>
        </div>
        <div className="group-member-list">
          {members.map((member) => (
            <div className="group-member-row" key={member.id}>
              <span className="avatar">{member.displayName.slice(0, 1).toUpperCase()}</span>
              <span><strong>{member.displayName}{member.id === currentUserId ? ' (you)' : ''}</strong><small>@{member.username}</small></span>
              {member.role === 'owner' && <small className="group-owner-label">Owner</small>}
            </div>
          ))}
        </div>
        <div className="group-invite">
          <label htmlFor="group-invite-username">Invite a mutual contact</label>
          <div className="username-input"><span>@</span><input
            id="group-invite-username"
            value={username}
            onChange={(event) => { setUsername(event.target.value); setSelected(null); setMatches([]); setSearching(false); setError('') }}
            placeholder="Search usernames"
            maxLength={24}
            autoComplete="off"
            disabled={members.length >= 32 || busy}
          /></div>
          <div className="username-search-results" aria-label="Username search results">
            {searching && <p role="status">Searching usernames…</p>}
            {!searching && matches.map((match) => (
              <button className={`username-match${selected?.id === match.id ? ' is-selected' : ''}`} key={match.id} type="button" onClick={() => { setSelected(match); setUsername(match.username) }}>
                <span><strong>{match.display_name}</strong><small>@{match.username}</small></span>
              </button>
            ))}
            {!searching && username.length >= 3 && !selected && matches.length === 0 && !error && <p role="status">No available mutual contact found.</p>}
          </div>
          <p className="group-encryption-note">New members can read messages sent after they join; earlier encrypted messages and files stay private.</p>
          <button className="primary-button" type="button" onClick={() => void invite()} disabled={!selected || busy || members.length >= 32}>
            <UserPlus size={14} aria-hidden="true" /> {busy ? 'Working…' : 'Add member'}
          </button>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="leave-group-button" type="button" onClick={() => void leave()} disabled={busy}><LogOut size={14} aria-hidden="true" /> Leave group</button>
      </section>
    </div>
  )
}
