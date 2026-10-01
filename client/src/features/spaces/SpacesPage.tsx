import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { ArrowLeft, AtSign, BriefcaseBusiness, ChevronDown, ChevronRight, Hash, Heart, Layers3, LockKeyhole, Megaphone, Mic, Plus, Rocket, Send, Settings2, Sparkles, Users, Volume2, X } from 'lucide-react'
import { api } from '../../shared/api'
import type { ActiveCall, SpaceCategory, SpaceChannel, SpaceChannelRolePermission, SpaceIcon, SpaceMember, SpaceMessage, SpaceSummary } from '../../shared/types'

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

function renderMentionText(message: SpaceMessage) {
  const usernames = new Set(message.mentions.map((mention) => mention.username.toLowerCase()))
  const tokens = /@([A-Za-z0-9_]{3,24}|everyone)\b/gu
  const output: ReactNode[] = []
  let cursor = 0
  for (const match of message.body.matchAll(tokens)) {
    const token = match[0]
    const start = match.index ?? 0
    const mention = match[1]?.toLowerCase()
    const isMention = mention === 'everyone' ? message.everyone_mentioned : Boolean(mention && usernames.has(mention))
    if (!isMention) continue
    if (start > cursor) output.push(message.body.slice(cursor, start))
    output.push(<strong className="space-message-mention" key={`${start}-${token}`}>{token}</strong>)
    cursor = start + token.length
  }
  if (cursor < message.body.length) output.push(message.body.slice(cursor))
  return output
}

export function SpacesPage({ onBack, onJoinVoiceRoom }: {
  onBack: () => void
  onJoinVoiceRoom: (call: ActiveCall) => void
}) {
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
  const [spaceSettingsTab, setSpaceSettingsTab] = useState<'overview' | 'people' | null>(null)
  const [channelSettingsTab, setChannelSettingsTab] = useState<'overview' | 'permissions' | null>(null)
  const [topicDraft, setTopicDraft] = useState('')
  const [permissionDraft, setPermissionDraft] = useState<SpaceChannelRolePermission[]>([])
  const [mentionMenuOpen, setMentionMenuOpen] = useState(false)
  const [mentionNotice, setMentionNotice] = useState('')
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

  function openChannelSettings(tab: 'overview' | 'permissions') {
    if (!activeChannel) return
    setError('')
    setChannelSettingsTab(tab)
    if (tab === 'overview') setTopicDraft(activeChannel.topic)
    if (tab === 'permissions') {
      if (!activeChannel.permissions) {
        setError('Unable to load this channel’s role permissions.')
        return
      }
      setPermissionDraft(activeChannel.permissions.map((permission) => ({ ...permission })))
    }
  }

  function updatePermission(role: SpaceChannelRolePermission['role'], key: 'can_view' | 'can_send' | 'can_speak', value: boolean) {
    setPermissionDraft((current) => current.map((permission) => permission.role === role
      ? {
        ...permission,
        [key]: value,
        ...(key === 'can_view' && !value ? { can_send: false } : {}),
        ...(key === 'can_view' && !value ? { can_speak: false } : {}),
      }
      : permission))
  }

  async function saveChannelPermissions(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!space || !activeChannel) return
    setBusy(true)
    setError('')
    try {
      await api(`/api/spaces/${space.id}/channels/${activeChannel.id}/permissions`, {
        method: 'PATCH',
        body: JSON.stringify({ permissions: permissionDraft }),
      })
      await loadSpace(space.id)
      setChannelSettingsTab(null)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save channel permissions.')
    } finally {
      setBusy(false)
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
    if (!space || !channelId || space.channels.find((channel) => channel.id === channelId)?.type === 'voice') {
      setMessages([])
      return
    }
    setMentionNotice('')
    let active = true
    const path = `/api/spaces/${space.id}/channels/${channelId}/messages`
    const refresh = () => api<{ messages: SpaceMessage[] }>(path)
      .then(({ messages: nextMessages }) => { if (active) setMessages(nextMessages) })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load channel messages.') })
    void refresh()
    const stream = new EventSource(`/api/events?chat_id=${encodeURIComponent(channelId)}`)
    const refreshOnEvent = () => { void refresh() }
    const onMention = () => {
      if (active) setMentionNotice(`You were mentioned in #${space.channels.find((channel) => channel.id === channelId)?.name ?? 'channel'}.`)
      refreshOnEvent()
    }
    stream.addEventListener('channel.message', refreshOnEvent)
    stream.addEventListener('channel.mention', onMention)
    const timer = window.setInterval(() => { void refresh() }, 5000)
    return () => { active = false; window.clearInterval(timer); stream.close() }
  }, [space?.id, channelId, activeChannel?.name])

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
      setSpaceSettingsTab(null)
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
      setChannelSettingsTab(null)
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
            {canCreateChannels && <button className="space-settings-button" type="button" onClick={() => { setError(''); setSpaceSettingsTab('overview') }} aria-label="Space settings" title="Space settings"><Settings2 size={15} aria-hidden="true" /></button>}
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
                {categoryChannels.map((channel) => <div key={channel.id} className={`space-channel-row${channel.id === channelId ? ' is-active' : ''}`}>
                  <button type="button" className="space-channel" onClick={() => setChannelId(channel.id)}>
                    {channel.type === 'announcement'
                      ? <Megaphone size={14} aria-hidden="true" />
                      : channel.type === 'private'
                        ? <LockKeyhole size={14} aria-hidden="true" />
                        : channel.type === 'voice'
                          ? <Volume2 size={14} aria-hidden="true" />
                        : <Hash size={14} aria-hidden="true" />}
                    <span>{channel.name}</span>
                  </button>
                  {canCreateChannels && <button className="space-channel-settings" type="button" onClick={() => {
                    setChannelId(channel.id)
                    setError('')
                    setChannelSettingsTab('overview')
                    setTopicDraft(channel.topic)
                  }} aria-label={`Edit ${channel.name} settings`} title="Edit channel"><Settings2 size={13} aria-hidden="true" /></button>}
                </div>)}
              </nav>}
            </section>
          })}
          {canCreateChannels && <button className="space-add-category" type="button" onClick={() => { setCategoryName(''); setError(''); setCategoryDialogOpen(true) }}><Plus size={13} aria-hidden="true" /> Create category</button>}
          {canInvite && <button className="space-manage-members" type="button" onClick={() => { setError(''); setSpaceSettingsTab('people') }}><Users size={14} aria-hidden="true" /><span>People & invites</span><small>{space.members.length}</small></button>}
        </aside>
        <section className="space-channel-view" aria-label={activeChannel ? `Channel ${activeChannel.name}` : 'No channel selected'}>
          {activeChannel ? <>
            <header className="space-channel-header"><div>
              <span>{activeChannel.type === 'announcement' ? <Megaphone size={16} aria-hidden="true" /> : activeChannel.type === 'private' ? <LockKeyhole size={16} aria-hidden="true" /> : activeChannel.type === 'voice' ? <Volume2 size={16} aria-hidden="true" /> : <Hash size={16} aria-hidden="true" />}{activeChannel.name}</span>
              <small>{activeChannel.topic || (activeChannel.type === 'announcement' ? 'Only Space moderators can post here' : activeChannel.type === 'private' ? 'Private channel' : activeChannel.type === 'voice' ? 'Persistent voice room · up to 16 people' : 'Visible to invited members')}</small>
            </div>
            <div className="space-channel-actions">
              {canCreateChannels && <button className="space-topic-edit" type="button" onClick={() => openChannelSettings('overview')}><Settings2 size={13} aria-hidden="true" /> Edit channel</button>}
              {activeChannel.type === 'voice' && <button className="space-topic-edit" type="button" onClick={() => {
                onJoinVoiceRoom({
                  id: activeChannel.id,
                  chatId: activeChannel.id,
                  callType: 'audio',
                  title: `${space.name} · ${activeChannel.name}`,
                  isVoiceRoom: true,
                  voiceSpaceId: space.id,
                  voiceChannelId: activeChannel.id,
                  canPublish: activeChannel.can_speak,
                })
              }}><Mic size={13} aria-hidden="true" /> Join voice</button>}
            </div>
            </header>
            {activeChannel.type === 'voice' ? <div className="space-voice-welcome">
              <span><Volume2 size={25} aria-hidden="true" /></span>
              <strong>Voice room is always here</strong>
              <p>Join to talk with people who have access to this channel. Up to 16 people can join.</p>
              <button className="primary-button" type="button" onClick={() => {
                onJoinVoiceRoom({
                  id: activeChannel.id,
                  chatId: activeChannel.id,
                  callType: 'audio',
                  title: `${space.name} · ${activeChannel.name}`,
                  isVoiceRoom: true,
                  voiceSpaceId: space.id,
                  voiceChannelId: activeChannel.id,
                  canPublish: activeChannel.can_speak,
                })
              }}><Mic size={14} aria-hidden="true" /> Join voice</button>
            </div> : <>
            {mentionNotice && <div className="space-mention-notice" role="status">{mentionNotice}<button type="button" onClick={() => setMentionNotice('')}>Dismiss</button></div>}
            <div className="space-message-list" aria-live="polite">
              {messages.length === 0 && <div className="space-messages-empty"><Hash size={22} aria-hidden="true" /><strong>This is the start of #{activeChannel.name}</strong><p>Share a project update or question with this channel.</p></div>}
              {messages.map((message) => <article className={`space-message${message.is_mentioned ? ' is-mentioned' : ''}${message.everyone_mentioned ? ' has-everyone-mention' : ''}`} key={message.id}>
                <div className="space-message-heading"><strong>{message.display_name}</strong><small>@{message.username} · {new Date(message.created_at).toLocaleString()}</small></div>
                <p>{renderMentionText(message)}</p>
              </article>)}
              <div ref={messageEnd} />
            </div>
            <form className="space-message-composer" onSubmit={(event) => void sendMessage(event)}>
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={8000} rows={2} placeholder={activeChannel.can_send ? `Message #${activeChannel.name}` : 'You can view this channel but cannot send messages'} aria-label={`Message #${activeChannel.name}`} disabled={!activeChannel.can_send} />
              <button className="space-mention-toggle" type="button" onClick={() => setMentionMenuOpen((open) => !open)} disabled={!activeChannel.can_send} aria-expanded={mentionMenuOpen} aria-label="Insert a mention"><AtSign size={15} aria-hidden="true" /></button>
              <button className="primary-button" type="submit" disabled={busy || !activeChannel.can_send || !draft.trim()} aria-label="Send channel message"><Send size={15} aria-hidden="true" /><span>Send</span></button>
              {mentionMenuOpen && <div className="space-mention-menu" role="listbox" aria-label="Mention someone in this channel">
                {activeChannel.members.map((member) => <button key={member.id} type="button" role="option" onClick={() => {
                  setDraft((current) => `${current}${current && !/\s$/u.test(current) ? ' ' : ''}@${member.username} `)
                  setMentionMenuOpen(false)
                }}><strong>{member.display_name}</strong><small>@{member.username}</small></button>)}
                {['owner', 'admin', 'moderator'].includes(space.role) && <button type="button" role="option" onClick={() => {
                  setDraft((current) => `${current}${current && !/\s$/u.test(current) ? ' ' : ''}@everyone `)
                  setMentionMenuOpen(false)
                }}><strong>@everyone</strong><small>Notify everyone who can see this channel</small></button>}
                {activeChannel.members.length === 0 && !['owner', 'admin', 'moderator'].includes(space.role) && <small>No other channel members to mention yet.</small>}
              </div>}
              <small>{activeChannel.can_send ? 'Messages in Spaces are visible to channel members and stored by SyncUp.' : 'You can view messages here, but your Space role cannot send in this channel.'}</small>
            </form>
            </>}
          </> : <div className="space-no-channel">Choose a channel to get started.</div>}
        </section>
      </div>
      {error && !channelDialogOpen && !spaceSettingsTab && !channelSettingsTab && <p className="spaces-error space-detail-error" role="alert">{error}</p>}
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
              <option value="discussion">Text channel</option><option value="announcement">Announcement channel</option><option value="private">Private channel</option><option value="voice">Voice room</option>
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
      {spaceSettingsTab && <div className="overlay space-dialog-overlay" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          setSpaceSettingsTab(null)
          void loadSpace(space.id)
        }
      }}>
        <section className="account-dialog space-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="space-settings-title">
          <header className="space-settings-header">
            <div><p className="eyebrow">SPACE SETTINGS</p><h2 id="space-settings-title">{space.name}</h2></div>
            <button className="icon-button" type="button" onClick={() => { setSpaceSettingsTab(null); void loadSpace(space.id) }} aria-label="Close Space settings"><X size={15} aria-hidden="true" /></button>
          </header>
          <div className="space-settings-layout">
            <nav className="space-settings-nav" aria-label="Space settings sections">
              <button type="button" className={spaceSettingsTab === 'overview' ? 'is-active' : ''} aria-pressed={spaceSettingsTab === 'overview'} onClick={() => { setError(''); setSpaceSettingsTab('overview') }}><Settings2 size={15} aria-hidden="true" /> Overview</button>
              {canInvite && <button type="button" className={spaceSettingsTab === 'people' ? 'is-active' : ''} aria-pressed={spaceSettingsTab === 'people'} onClick={() => { setError(''); setSpaceSettingsTab('people') }}><Users size={15} aria-hidden="true" /> People & invites <small>{space.members.length}</small></button>}
            </nav>
            <div className="space-settings-content">
              {spaceSettingsTab === 'overview' ? <>
                <div className="space-settings-section-heading"><h3>Space overview</h3><p>Set the name and description members see across this Space.</p></div>
                <form className="profile-form" onSubmit={(event) => void saveSpaceSettings(event)}>
                  <label><span>Space name</span><input name="spaceName" autoComplete="off" value={space.name} onChange={(event) => setSpace((current) => current ? { ...current, name: event.target.value } : current)} maxLength={80} required /></label>
                  <label><span>Description</span><textarea name="spaceDescription" autoComplete="off" value={space.description} onChange={(event) => setSpace((current) => current ? { ...current, description: event.target.value } : current)} maxLength={280} rows={3} placeholder="What is this Space for?" /></label>
                  <span className="space-icon-choice-label">Space icon</span>
                  <div className="space-icon-choice-list" role="group" aria-label="Space icon">
                    {spaceIconOptions.map(({ id, label }) => <button key={id} type="button" className={space.icon === id ? 'selected' : ''} aria-pressed={space.icon === id} aria-label={label} title={label} onClick={() => setSpace((current) => current ? { ...current, icon: id } : current)}><SpaceIconView icon={id} /></button>)}
                  </div>
                  {error && <div className="form-error" role="alert">{error}</div>}
                  <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
                </form>
              </> : <section aria-labelledby="space-people-title">
                <div className="space-settings-section-heading"><h3 id="space-people-title">People & invites</h3><p>See who belongs to this Space and invite people with the access they need.</p></div>
                <div className="space-dialog-members">{space.members.map((member) => <div key={member.id}>
                  <span><strong>{member.display_name}</strong><small>@{member.username}</small></span><small>{member.role}</small>
                </div>)}</div>
                <form className="profile-form space-invite-dialog-form" onSubmit={(event) => void inviteMember(event)}>
                  <label><span>Invite by username</span><input name="inviteUsername" autoComplete="off" spellCheck={false} value={inviteUsername} onChange={(event) => setInviteUsername(event.target.value.trimStart().replace(/^@/u, ''))} placeholder="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" required /></label>
                  <label><span>Role</span><select value={inviteRole} onChange={(event) => { setInviteRole(event.target.value as 'member' | 'guest'); setInviteChannels([]) }}>
                    <option value="guest">Guest</option>{space.role !== 'moderator' && <option value="member">Member</option>}
                  </select></label>
                  {inviteRole === 'guest' && <fieldset className="space-channel-grants"><legend>Guest channel access</legend>{space.channels.map((channel) => <label key={channel.id}>
                    <input type="checkbox" checked={inviteChannels.includes(channel.id)} onChange={(event) => setInviteChannels((current) => event.target.checked ? [...current, channel.id] : current.filter((id) => id !== channel.id))} />
                    #{channel.name}
                  </label>)}</fieldset>}
                  {error && <div className="form-error" role="alert">{error}</div>}
                  <button className="primary-button" disabled={busy}>{busy ? 'Inviting…' : `Invite ${inviteRole}`}</button>
                </form>
              </section>}
            </div>
          </div>
        </section>
      </div>}
      {channelSettingsTab && canCreateChannels && activeChannel && <div className="overlay space-dialog-overlay" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) setChannelSettingsTab(null)
      }}>
        <section className="account-dialog space-dialog space-channel-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="channel-settings-title">
          <div className="dialog-heading"><div><p className="eyebrow">#{activeChannel.name}</p><h2 id="channel-settings-title">Channel settings</h2></div>
            <button className="icon-button" type="button" onClick={() => setChannelSettingsTab(null)} aria-label="Close channel settings"><X size={15} aria-hidden="true" /></button>
          </div>
          <nav className="space-channel-settings-tabs" aria-label="Channel settings sections">
            <button type="button" className={channelSettingsTab === 'overview' ? 'is-active' : ''} aria-pressed={channelSettingsTab === 'overview'} onClick={() => openChannelSettings('overview')}>Overview</button>
            <button type="button" className={channelSettingsTab === 'permissions' ? 'is-active' : ''} aria-pressed={channelSettingsTab === 'permissions'} onClick={() => openChannelSettings('permissions')}>Permissions</button>
          </nav>
          {channelSettingsTab === 'overview' ? <>
            <div className="space-settings-section-heading"><h3>Channel overview</h3><p>Keep this channel easy to recognize and give members context before they post.</p></div>
            <div className="space-channel-type-card"><span>Channel type</span><strong>{activeChannel.type === 'discussion' ? 'Text channel' : activeChannel.type === 'announcement' ? 'Announcement channel' : activeChannel.type === 'private' ? 'Private channel' : 'Voice room'}</strong></div>
            <form className="profile-form" onSubmit={(event) => void saveChannelTopic(event)}>
              <label><span>Topic</span><textarea name="channelTopic" autoComplete="off" value={topicDraft} onChange={(event) => setTopicDraft(event.target.value)} maxLength={160} rows={3} placeholder="What should people discuss here?" /></label>
              <small className="space-channel-name-hint">{topicDraft.length}/160 characters · Shown beneath the channel name.</small>
              {error && <div className="form-error" role="alert">{error}</div>}
              <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save channel details'}</button>
            </form>
          </> : <>
            <div className="space-settings-section-heading"><h3>Role permissions</h3><p>Choose what each Space role can do in <strong>#{activeChannel.name}</strong>.</p></div>
            <div className="space-permission-fixed"><strong>Owner & admin</strong><span>Always have full channel access</span></div>
            <form className="profile-form" onSubmit={(event) => void saveChannelPermissions(event)}>
              <div className="space-permission-table-wrap">
                <table className="space-permission-table">
                  <caption>Access for Space roles in this channel</caption>
                  <thead><tr><th scope="col">Role</th><th scope="col">View</th><th scope="col">{activeChannel.type === 'voice' ? 'Speak' : 'Send'}</th></tr></thead>
                  <tbody>{permissionDraft.map((permission) => <tr key={permission.role}>
                    <th scope="row">{permission.role[0].toUpperCase() + permission.role.slice(1)}</th>
                    <td><label><input type="checkbox" checked={permission.can_view} aria-label={`${permission.role} can view`} onChange={(event) => updatePermission(permission.role, 'can_view', event.target.checked)} /></label></td>
                    <td><label><input type="checkbox" checked={activeChannel.type === 'voice' ? permission.can_speak : permission.can_send} disabled={!permission.can_view} aria-label={`${permission.role} can ${activeChannel.type === 'voice' ? 'speak' : 'send messages'}`} onChange={(event) => updatePermission(permission.role, activeChannel.type === 'voice' ? 'can_speak' : 'can_send', event.target.checked)} /></label></td>
                  </tr>)}</tbody>
                </table>
              </div>
              <p className="space-permission-note">Turning off View also turns off sending or speaking. These role rules never grant access to guests who haven’t been added to this channel.</p>
              {error && <div className="form-error" role="alert">{error}</div>}
              <button className="primary-button" disabled={busy || permissionDraft.length !== 3}>{busy ? 'Saving…' : 'Save permissions'}</button>
            </form>
          </>}
        </section>
      </div>}
    </section>
  )
}
