import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, Layers3, LogOut, UserPlus, X } from 'lucide-react'
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
  onConverted: (spaceId: string, channelId: string) => void
}

export function ChatDetailsScreen({ chatId, title, isGroup, members, currentUserId, onBack, onMembersChanged, onLeave, onConverted }: ChatDetailsScreenProps) {
  const [username, setUsername] = useState('')
  const [matches, setMatches] = useState<DiscoveredUser[]>([])
  const [selected, setSelected] = useState<DiscoveredUser | null>(null)
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [convertOpen, setConvertOpen] = useState(false)
  const [spaceName, setSpaceName] = useState(title)
  const [generalChannelName, setGeneralChannelName] = useState('general')
  const peer = members.find((member) => member.id !== currentUserId)
  const isOwner = members.some((member) => member.id === currentUserId && member.role === 'owner')

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

  async function convertToSpace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await api<{ spaceId: string; channelId: string }>(`/api/chats/${chatId}/upgrade-to-space`, {
        method: 'POST',
        body: JSON.stringify({ name: spaceName, generalChannelName }),
      })
      onConverted(result.spaceId, result.channelId)
    } catch (convertError) {
      setError(convertError instanceof Error ? convertError.message : 'Unable to convert this group.')
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
            {isOwner && <section className="chat-details-section group-space-upgrade">
              <h2>Make this a Space</h2>
              <p>Organize this group into channels and keep the existing conversation as its first channel.</p>
              <button className="primary-button" type="button" onClick={() => { setSpaceName(title); setError(''); setConvertOpen(true) }} disabled={busy}>
                <Layers3 size={15} aria-hidden="true" /> Turn group into a Space
              </button>
            </section>}
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
      {convertOpen && <div className="overlay space-dialog-overlay" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) setConvertOpen(false)
      }}>
        <section className="account-dialog space-dialog group-space-upgrade-dialog" role="dialog" aria-modal="true" aria-labelledby="upgrade-space-title">
          <header className="dialog-heading">
            <div><p className="eyebrow">GROUP UPGRADE</p><h2 id="upgrade-space-title">Turn “{title}” into a Space</h2></div>
            <button className="icon-button" type="button" onClick={() => setConvertOpen(false)} aria-label="Close" disabled={busy}><X size={15} aria-hidden="true" /></button>
          </header>
          <p className="space-dialog-copy">This happens in place: the same group and member list continue as a Space, and the current conversation becomes its first channel.</p>
          <div className="group-space-upgrade-notice">
            <strong>Your privacy changes going forward</strong>
            <p>Earlier messages and encrypted attachments stay end-to-end encrypted and are visible only to people in this group now. New channel messages and files are stored by SyncUp and visible to channel members.</p>
          </div>
          <form className="profile-form" onSubmit={(event) => void convertToSpace(event)}>
            <label><span>Space name</span><input value={spaceName} onChange={(event) => setSpaceName(event.target.value)} maxLength={80} required /></label>
            <label><span>First channel name</span><div className="group-space-channel-input"><span>#</span><input value={generalChannelName} onChange={(event) => setGeneralChannelName(event.target.value.toLowerCase().replace(/\s+/gu, '-').replace(/[^a-z0-9-]/gu, '').slice(0, 40))} pattern="[a-z0-9][a-z0-9-]*" maxLength={40} required /></div></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button" type="submit" disabled={busy || !spaceName.trim() || !generalChannelName.trim()}>
              <Layers3 size={15} aria-hidden="true" /> {busy ? 'Converting…' : 'Convert group to Space'}
            </button>
          </form>
        </section>
      </div>}
    </section>
  )
}
