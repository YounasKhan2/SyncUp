import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, BriefcaseBusiness, ChevronDown, ChevronRight, Hash, Heart, Layers3, LockKeyhole, Megaphone, Plus, Rocket, Send, Settings2, Sparkles, Users, X } from 'lucide-react'
import { api } from '../../shared/api'
import type { SpaceCategory, SpaceChannel, SpaceIcon, SpaceMember, SpaceMessage, SpaceSummary } from '../../shared/types'

type SpaceDetails = {
  id: string
  name: string
  description: string
  icon: SpaceIcon
  role: SpaceSummary['role']
  categories: SpaceCategory[]
  channels: SpaceChannel[]
  members: SpaceMember[]
}

function normalizeChannelName(value: string) {
  return value.toLowerCase()
    .replace(/\s+/gu, '-')
    .replace(/[^a-z0-9-]/gu, '')
    .replace(/-+/gu, '-')
    .replace(/^-+/u, '')
    .slice(0, 40)
}

const spaceIconOptions: { id: SpaceIcon; label: string; icon: typeof Layers3 }[] = [
  { id: 'layers', label: 'Layers', icon: Layers3 },
  { id: 'briefcase', label: 'Briefcase', icon: BriefcaseBusiness },
  { id: 'rocket', label: 'Rocket', icon: Rocket },
  { id: 'heart', label: 'Heart', icon: Heart },
  { id: 'sparkles', label: 'Sparkles', icon: Sparkles },
]

function SpaceIconView({ icon, size = 18 }: { icon: SpaceIcon; size?: number }) {
  const Icon = spaceIconOptions.find((option) => option.id === icon)?.icon ?? Layers3
  return <Icon size={size} aria-hidden="true" />
}

export function SpacesPage({ onBack }: { onBack: () => void }) {
  const [spaces, setSpaces] = useState<SpaceSummary[]>([])
  const [space, setSpace] = useState<SpaceDetails | null>(null)
  const [channelId, setChannelId] = useState<string | null>(null)
  const [messages, setMessages] = useState<SpaceMessage[]>([])
  const [spaceName, setSpaceName] = useState('')
  const [spaceDescription, setSpaceDescription] = useState('')
  const [spaceIcon, setSpaceIcon] = useState<SpaceIcon>('layers')
  const [inviteUsername, setInviteUsername] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'guest'>('guest')
  const [inviteChannels, setInviteChannels] = useState<string[]>([])
  const [channelName, setChannelName] = useState('')
  const [channelType, setChannelType] = useState<SpaceChannel['type']>('discussion')
  const [channelTopic, setChannelTopic] = useState('')
  const [channelCategoryId, setChannelCategoryId] = useState('')
  const [channelDialogOpen, setChannelDialogOpen] = useState(false)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [spaceSettingsOpen, setSpaceSettingsOpen] = useState(false)
  const [topicDialogOpen, setTopicDialogOpen] = useState(false)
  const [topicDraft, setTopicDraft] = useState('')
  const [membersDialogOpen, setMembersDialogOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})
  const messageEnd = useRef<HTMLDivElement>(null)
  const activeChannel = space?.channels.find((channel) => channel.id === channelId) ?? null
  const canCreateChannels = space ? ['owner', 'admin'].includes(space.role) : false
  const canInvite = space ? ['owner', 'admin', 'moderator'].includes(space.role) : false

  async function loadSpaces() {
    const result = await api<{ spaces: SpaceSummary[] }>('/api/spaces')
    setSpaces(result.spaces)
  }

  async function loadSpace(id: string) {
    const result = await api<{ space: SpaceDetails }>(`/api/spaces/${id}`)
    setSpace(result.space)
    setChannelId((current) => result.space.channels.some((channel) => channel.id === current)
      ? current
      : result.space.channels[0]?.id ?? null)
  }

  async function openSpace(id: string) {
    setError('')
    try {
      await loadSpace(id)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to open this Space.')
    }
  }

  useEffect(() => {
    let active = true
    api<{ spaces: SpaceSummary[] }>('/api/spaces')
      .then(({ spaces: nextSpaces }) => { if (active) setSpaces(nextSpaces) })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load Spaces.') })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!space?.id) return
    let active = true
    const refresh = () => api<{ space: SpaceDetails }>(`/api/spaces/${space.id}`)
      .then(({ space: nextSpace }) => { if (active) setSpace(nextSpace) })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to refresh this Space.') })
    const timer = window.setInterval(() => { void refresh() }, 15_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [space?.id])

  useEffect(() => {
    if (!space || !channelId) {
      setMessages([])
      return
    }
    let active = true
    const path = `/api/spaces/${space.id}/channels/${channelId}/messages`
    const refresh = () => api<{ messages: SpaceMessage[] }>(path)
      .then(({ messages: nextMessages }) => { if (active) setMessages(nextMessages) })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load channel messages.') })
    void refresh()
    const timer = window.setInterval(() => { void refresh() }, 5000)
    return () => { active = false; window.clearInterval(timer) }
  }, [space?.id, channelId])

  useEffect(() => {
    messageEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  async function createSpace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const result = await api<{ spaceId: string }>('/api/spaces', {
        method: 'POST',
        body: JSON.stringify({ name: spaceName, description: spaceDescription, icon: spaceIcon, template: 'client-room' }),
      })
      await loadSpaces()
      setSpaceName('')
      setSpaceDescription('')
      setSpaceIcon('layers')
      await loadSpace(result.spaceId)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create this Space.')
    } finally {
      setBusy(false)
    }
  }

  async function createChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!space) return
    setBusy(true)
    setError('')
    try {
      const result = await api<{ channelId: string }>(`/api/spaces/${space.id}/channels`, {
        method: 'POST',
        body: JSON.stringify({ name: channelName, type: channelType, categoryId: channelCategoryId, topic: channelTopic }),
      })
      setChannelName('')
      setChannelTopic('')
      setChannelDialogOpen(false)
      await loadSpace(space.id)
      setChannelId(result.channelId)
      await loadSpaces()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create this channel.')
    } finally {
      setBusy(false)
    }
  }

  async function saveSpaceSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!space) return
    setBusy(true)
    setError('')
    try {
      await api(`/api/spaces/${space.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: space.name, description: space.description, icon: space.icon }),
      })
      await loadSpace(space.id)
      await loadSpaces()
      setSpaceSettingsOpen(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save Space details.')
    } finally {
      setBusy(false)
    }
  }

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!space) return
    setBusy(true)
    setError('')
    try {
      const result = await api<{ category: SpaceCategory }>(`/api/spaces/${space.id}/categories`, {
        method: 'POST',
        body: JSON.stringify({ name: categoryName }),
      })
      setCategoryName('')
      setCategoryDialogOpen(false)
      await loadSpace(space.id)
      setChannelCategoryId(result.category.id)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create this category.')
    } finally {
      setBusy(false)
    }
  }

  async function saveChannelTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!space || !activeChannel) return
    setBusy(true)
    setError('')
    try {
      await api(`/api/spaces/${space.id}/channels/${activeChannel.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ topic: topicDraft }),
      })
      await loadSpace(space.id)
      setTopicDialogOpen(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save this channel topic.')
    } finally {
      setBusy(false)
    }
  }

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!space) return
    if (inviteRole === 'guest' && inviteChannels.length === 0) {
      setError('Choose at least one channel for this guest.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const channels = inviteRole === 'guest' ? inviteChannels : undefined
      await api(`/api/spaces/${space.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ username: inviteUsername, role: inviteRole, ...(channels ? { channels } : {}) }),
      })
      setInviteUsername('')
      setInviteChannels([])
      setMembersDialogOpen(false)
      await loadSpace(space.id)
      await loadSpaces()
    } catch (inviteError) {
      setError(inviteError instanceof Error ? inviteError.message : 'Unable to invite this person.')
    } finally {
      setBusy(false)
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!space || !channelId || !draft.trim()) return
    setBusy(true)
    setError('')
    try {
      await api(`/api/spaces/${space.id}/channels/${channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body: draft }),
      })
      setDraft('')
      const result = await api<{ messages: SpaceMessage[] }>(`/api/spaces/${space.id}/channels/${channelId}/messages`)
      setMessages(result.messages)
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Unable to send this channel message.')
    } finally {
      setBusy(false)
    }
  }

  if (!space) {
    return (
      <section className="spaces-page spaces-overview">
        <header className="spaces-topbar">
          <button className="spaces-back" type="button" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Chats</button>
          <div><p className="eyebrow">TEAM WORKSPACES</p><h1>Spaces</h1></div>
        </header>
        {error && <p className="spaces-error" role="alert">{error}</p>}
        <div className="spaces-overview-content">
          <section className="spaces-intro">
            <span className="spaces-intro-icon"><Users size={21} aria-hidden="true" /></span>
            <h2>Bring a project together</h2>
            <p>Give your project a home, invite your team, and organize conversations into channels.</p>
            <form className="spaces-create-form" onSubmit={(event) => void createSpace(event)}>
              <label htmlFor="space-name">Space name</label>
              <input id="space-name" value={spaceName} onChange={(event) => setSpaceName(event.target.value)} placeholder="e.g. Website redesign" maxLength={80} required />
              <label htmlFor="space-description">Description <small>(optional)</small></label>
              <textarea id="space-description" value={spaceDescription} onChange={(event) => setSpaceDescription(event.target.value)} placeholder="What is this Space for?" maxLength={280} rows={2} />
              <span className="space-icon-choice-label">Space icon</span>
              <div className="space-icon-choice-list" role="group" aria-label="Space icon">
                {spaceIconOptions.map(({ id, label }) => <button key={id} type="button" className={spaceIcon === id ? 'selected' : ''} aria-pressed={spaceIcon === id} aria-label={label} title={label} onClick={() => setSpaceIcon(id)}><SpaceIconView icon={id} /></button>)}
              </div>
              <p className="spaces-create-hint">This is your Space’s name. We’ll add a separate <strong>#general</strong> channel automatically.</p>
              <button className="primary-button" disabled={busy}>{busy ? 'Creating…' : 'Create Space'}<Plus size={14} aria-hidden="true" /></button>
            </form>
          </section>
          <section className="spaces-list" aria-label="Your Spaces">
            <h2>Your Spaces</h2>
            {spaces.length === 0
              ? <p className="spaces-empty">Your project rooms will appear here.</p>
              : spaces.map((item) => <button className="space-list-card" key={item.id} type="button" onClick={() => void openSpace(item.id)}>
                <span className="space-card-mark"><SpaceIconView icon={item.icon} /></span>
                <span><strong>{item.name}</strong><small>{item.channel_count} {item.channel_count === 1 ? 'channel' : 'channels'} · {item.role}</small></span>
              </button>)}
          </section>
        </div>
      </section>
    )
  }

  return (
    <section className="spaces-page space-detail">
      <div className="space-work-area">
        <aside className="space-sidebar">
          <header className="space-server-header">
            <span className="space-server-icon"><SpaceIconView icon={space.icon} size={17} /></span>
            <div><strong>{space.name}</strong><small>{space.description || `${space.role.toUpperCase()} · SPACE`}</small></div>
            {canCreateChannels && <button className="space-settings-button" type="button" onClick={() => { setError(''); setSpaceSettingsOpen(true) }} aria-label="Space settings" title="Space settings"><Settings2 size={15} aria-hidden="true" /></button>}
          </header>
          <button className="space-all-spaces" type="button" onClick={() => {
            setSpace(null)
            setChannelId(null)
            setError('')
            void loadSpaces().catch((loadError: unknown) => {
              setError(loadError instanceof Error ? loadError.message : 'Unable to refresh Spaces.')
            })
          }}><ArrowLeft size={13} aria-hidden="true" /> All Spaces</button>
          {space.categories.map((category) => {
            const categoryChannels = space.channels.filter((channel) => channel.category_id === category.id)
            const collapsed = collapsedCategories[category.id] ?? false
            return <section className="space-category" key={category.id}>
              <div className="space-section-heading">
                <button className="space-category-toggle" type="button" aria-expanded={!collapsed} onClick={() => setCollapsedCategories((current) => ({ ...current, [category.id]: !collapsed }))}>
                  {collapsed ? <ChevronRight size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
                  <span>{category.name}</span>
                </button>
                {canCreateChannels && <button type="button" onClick={() => { setChannelName(''); setChannelTopic(''); setChannelCategoryId(category.id); setError(''); setChannelDialogOpen(true) }} aria-label={`Create channel in ${category.name}`} title="Create channel"><Plus size={15} aria-hidden="true" /></button>}
              </div>
              {!collapsed && <nav className="space-channel-list" aria-label={`${category.name} channels`}>
                {categoryChannels.map((channel) => <button key={channel.id} type="button" className={`space-channel${channel.id === channelId ? ' is-active' : ''}`} onClick={() => setChannelId(channel.id)}>
                  {channel.type === 'announcement'
                    ? <Megaphone size={14} aria-hidden="true" />
                    : channel.type === 'private'
                      ? <LockKeyhole size={14} aria-hidden="true" />
                      : <Hash size={14} aria-hidden="true" />}
                  <span>{channel.name}</span>
                </button>)}
              </nav>}
            </section>
          })}
          {canCreateChannels && <button className="space-add-category" type="button" onClick={() => { setCategoryName(''); setError(''); setCategoryDialogOpen(true) }}><Plus size={13} aria-hidden="true" /> Create category</button>}
          {canInvite && <button className="space-manage-members" type="button" onClick={() => { setError(''); setMembersDialogOpen(true) }}><Users size={14} aria-hidden="true" /><span>People</span><small>{space.members.length}</small></button>}
        </aside>
        <section className="space-channel-view" aria-label={activeChannel ? `Channel ${activeChannel.name}` : 'No channel selected'}>
          {activeChannel ? <>
            <header className="space-channel-header"><div>
              <span>{activeChannel.type === 'announcement' ? <Megaphone size={16} aria-hidden="true" /> : activeChannel.type === 'private' ? <LockKeyhole size={16} aria-hidden="true" /> : <Hash size={16} aria-hidden="true" />}{activeChannel.name}</span>
              <small>{activeChannel.topic || (activeChannel.type === 'announcement' ? 'Only Space moderators can post here' : activeChannel.type === 'private' ? 'Private channel' : 'Visible to invited members')}</small>
            </div>
            {canCreateChannels && <button className="space-topic-edit" type="button" onClick={() => { setTopicDraft(activeChannel.topic); setError(''); setTopicDialogOpen(true) }}>Edit topic</button>}
            </header>
            <div className="space-message-list" aria-live="polite">
              {messages.length === 0 && <div className="space-messages-empty"><Hash size={22} aria-hidden="true" /><strong>This is the start of #{activeChannel.name}</strong><p>Share a project update or question with this channel.</p></div>}
              {messages.map((message) => <article className="space-message" key={message.id}>
                <div className="space-message-heading"><strong>{message.display_name}</strong><small>@{message.username} · {new Date(message.created_at).toLocaleString()}</small></div>
                <p>{message.body}</p>
              </article>)}
              <div ref={messageEnd} />
            </div>
            <form className="space-message-composer" onSubmit={(event) => void sendMessage(event)}>
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={8000} rows={2} placeholder={`Message #${activeChannel.name}`} aria-label={`Message #${activeChannel.name}`} />
              <button className="primary-button" type="submit" disabled={busy || !draft.trim()} aria-label="Send channel message"><Send size={15} aria-hidden="true" /><span>Send</span></button>
              <small>Messages in Spaces are visible to channel members and stored by SyncUp.</small>
            </form>
          </> : <div className="space-no-channel">Choose a channel to get started.</div>}
        </section>
      </div>
      {error && !channelDialogOpen && !membersDialogOpen && <p className="spaces-error space-detail-error" role="alert">{error}</p>}
      {channelDialogOpen && canCreateChannels && <div className="overlay space-dialog-overlay" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setChannelDialogOpen(false)
      }}>
        <section className="account-dialog space-dialog" role="dialog" aria-modal="true" aria-labelledby="create-channel-title">
          <div className="dialog-heading"><div><p className="eyebrow">SPACE CHANNELS</p><h2 id="create-channel-title">Create a channel</h2></div>
            <button className="icon-button" type="button" onClick={() => setChannelDialogOpen(false)} aria-label="Close"><X size={15} aria-hidden="true" /></button>
          </div>
          <p className="space-dialog-copy">Channels keep different conversations easy to find. The <strong>#general</strong> channel is already here.</p>
          <form className="profile-form" onSubmit={(event) => void createChannel(event)}>
            <label><span>Category</span><select value={channelCategoryId} onChange={(event) => setChannelCategoryId(event.target.value)} required>
              {space.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select></label>
            <label><span>Channel name</span><input value={channelName} onChange={(event) => setChannelName(normalizeChannelName(event.target.value))} placeholder="e.g. design-feedback" maxLength={40} pattern="[a-z0-9][a-z0-9-]*" autoComplete="off" autoFocus required aria-describedby="channel-name-hint" /></label>
            <small id="channel-name-hint" className="space-channel-name-hint">Lowercase letters, numbers, and hyphens. Spaces become hyphens.</small>
            <label><span>Topic <small>(optional)</small></span><input value={channelTopic} onChange={(event) => setChannelTopic(event.target.value)} placeholder="What should people discuss here?" maxLength={160} /></label>
            <label><span>Channel type</span><select value={channelType} onChange={(event) => setChannelType(event.target.value as SpaceChannel['type'])}>
              <option value="discussion">Text channel</option><option value="announcement">Announcement channel</option><option value="private">Private channel</option>
            </select></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button" disabled={busy}>{busy ? 'Creating…' : 'Create channel'}<Plus size={14} aria-hidden="true" /></button>
          </form>
        </section>
      </div>}
      {categoryDialogOpen && canCreateChannels && <div className="overlay space-dialog-overlay" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setCategoryDialogOpen(false)
      }}>
        <section className="account-dialog space-dialog" role="dialog" aria-modal="true" aria-labelledby="create-category-title">
          <div className="dialog-heading"><div><p className="eyebrow">{space.name}</p><h2 id="create-category-title">Create a category</h2></div>
            <button className="icon-button" type="button" onClick={() => setCategoryDialogOpen(false)} aria-label="Close"><X size={15} aria-hidden="true" /></button>
          </div>
          <p className="space-dialog-copy">Categories organize related channels. They can be collapsed in the channel list.</p>
          <form className="profile-form" onSubmit={(event) => void createCategory(event)}>
            <label><span>Category name</span><input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="e.g. Project" maxLength={40} autoFocus required /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button" disabled={busy}>{busy ? 'Creating…' : 'Create category'}<Plus size={14} aria-hidden="true" /></button>
          </form>
        </section>
      </div>}
      {spaceSettingsOpen && canCreateChannels && <div className="overlay space-dialog-overlay" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setSpaceSettingsOpen(false)
      }}>
        <section className="account-dialog space-dialog" role="dialog" aria-modal="true" aria-labelledby="space-settings-title">
          <div className="dialog-heading"><div><p className="eyebrow">SPACE SETTINGS</p><h2 id="space-settings-title">Customize your Space</h2></div>
            <button className="icon-button" type="button" onClick={() => { setSpaceSettingsOpen(false); void loadSpace(space.id) }} aria-label="Close"><X size={15} aria-hidden="true" /></button>
          </div>
          <form className="profile-form" onSubmit={(event) => void saveSpaceSettings(event)}>
            <label><span>Space name</span><input value={space.name} onChange={(event) => setSpace((current) => current ? { ...current, name: event.target.value } : current)} maxLength={80} required /></label>
            <label><span>Description</span><textarea value={space.description} onChange={(event) => setSpace((current) => current ? { ...current, description: event.target.value } : current)} maxLength={280} rows={3} placeholder="What is this Space for?" /></label>
            <span className="space-icon-choice-label">Space icon</span>
            <div className="space-icon-choice-list" role="group" aria-label="Space icon">
              {spaceIconOptions.map(({ id, label }) => <button key={id} type="button" className={space.icon === id ? 'selected' : ''} aria-pressed={space.icon === id} aria-label={label} title={label} onClick={() => setSpace((current) => current ? { ...current, icon: id } : current)}><SpaceIconView icon={id} /></button>)}
            </div>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
          </form>
        </section>
      </div>}
      {topicDialogOpen && canCreateChannels && activeChannel && <div className="overlay space-dialog-overlay" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setTopicDialogOpen(false)
      }}>
        <section className="account-dialog space-dialog" role="dialog" aria-modal="true" aria-labelledby="channel-topic-title">
          <div className="dialog-heading"><div><p className="eyebrow">#{activeChannel.name}</p><h2 id="channel-topic-title">Edit channel topic</h2></div>
            <button className="icon-button" type="button" onClick={() => setTopicDialogOpen(false)} aria-label="Close"><X size={15} aria-hidden="true" /></button>
          </div>
          <p className="space-dialog-copy">Add a short description to help people know what belongs in this channel.</p>
          <form className="profile-form" onSubmit={(event) => void saveChannelTopic(event)}>
            <label><span>Topic</span><textarea value={topicDraft} onChange={(event) => setTopicDraft(event.target.value)} maxLength={160} rows={3} placeholder="What should people discuss here?" autoFocus /></label>
            <small className="space-channel-name-hint">{topicDraft.length}/160 characters</small>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save topic'}</button>
          </form>
        </section>
      </div>}
      {membersDialogOpen && canInvite && <div className="overlay space-dialog-overlay" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setMembersDialogOpen(false)
      }}>
        <section className="account-dialog space-dialog" role="dialog" aria-modal="true" aria-labelledby="space-members-title">
          <div className="dialog-heading"><div><p className="eyebrow">{space.name}</p><h2 id="space-members-title">People</h2></div>
            <button className="icon-button" type="button" onClick={() => setMembersDialogOpen(false)} aria-label="Close"><X size={15} aria-hidden="true" /></button>
          </div>
          <div className="space-dialog-members">{space.members.map((member) => <div key={member.id}>
            <span><strong>{member.display_name}</strong><small>@{member.username}</small></span><small>{member.role}</small>
          </div>)}</div>
          {canInvite && <form className="profile-form space-invite-dialog-form" onSubmit={(event) => void inviteMember(event)}>
            <label><span>Invite by username</span><input value={inviteUsername} onChange={(event) => setInviteUsername(event.target.value.trimStart().replace(/^@/u, ''))} placeholder="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" required /></label>
            <label><span>Role</span><select value={inviteRole} onChange={(event) => { setInviteRole(event.target.value as 'member' | 'guest'); setInviteChannels([]) }}>
              <option value="guest">Guest</option>{space.role !== 'moderator' && <option value="member">Member</option>}
            </select></label>
            {inviteRole === 'guest' && <fieldset className="space-channel-grants"><legend>Guest can access</legend>{space.channels.map((channel) => <label key={channel.id}>
              <input type="checkbox" checked={inviteChannels.includes(channel.id)} onChange={(event) => setInviteChannels((current) => event.target.checked ? [...current, channel.id] : current.filter((id) => id !== channel.id))} />
              #{channel.name}
            </label>)}</fieldset>}
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button" disabled={busy}>{busy ? 'Inviting…' : `Invite ${inviteRole}`}</button>
          </form>}
        </section>
      </div>}
    </section>
  )
}
