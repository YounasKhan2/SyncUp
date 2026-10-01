import { useEffect, useState } from 'react'
import { CalendarDays, CheckSquare, Search, Sparkles } from 'lucide-react'
import { api } from '../../shared/api'
import type { SpaceSharedObject } from '../../shared/types'
import { SharedObjectCard } from './SharedObjectCard'

type Stacks = { needsYou: SpaceSharedObject[]; happening: SpaceSharedObject[]; decided: SpaceSharedObject[] }
type ActiveCall = { id: string; chat_id: string; call_type: 'audio' | 'video'; status: string; created_at: string; title: string; space_id: string | null; channel_name: string | null }

export function UpdatesPage({ userId, onOpenTarget, onOpenCall }: {
  userId: string
  onOpenTarget: (spaceId: string, channelId: string, messageId: string) => void
  onOpenCall: (call: ActiveCall) => void
}) {
  const [stacks, setStacks] = useState<Stacks>({ needsYou: [], happening: [], decided: [] })
  const [activeCalls, setActiveCalls] = useState<ActiveCall[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'spaces'>('all')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadUpdates(search = query) {
    const result = await api<{ stacks: Stacks; activeCalls: ActiveCall[] }>(`/api/spaces/updates${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`)
    setStacks(result.stacks)
    setActiveCalls(result.activeCalls)
  }

  useEffect(() => {
    let active = true
    api<{ stacks: Stacks; activeCalls: ActiveCall[] }>('/api/spaces/updates')
      .then(({ stacks: result, activeCalls: calls }) => { if (active) { setStacks(result); setActiveCalls(calls) } })
      .catch((loadError: unknown) => { if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load Updates.') })
    return () => { active = false }
  }, [])

  async function respond(object: SpaceSharedObject, data: Record<string, unknown>) {
    setBusy(true)
    setError('')
    try {
      await api(`/api/spaces/${object.space_id}/channels/${object.chat_id}/objects/${object.id}/respond`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      await loadUpdates()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save your response.')
    } finally {
      setBusy(false)
    }
  }

  async function changeState(object: SpaceSharedObject, state: 'closed' | 'cancelled' | 'unpinned') {
    setBusy(true)
    setError('')
    try {
      await api(`/api/spaces/${object.space_id}/channels/${object.chat_id}/objects/${object.id}/state`, {
        method: 'PATCH',
        body: JSON.stringify({ state }),
      })
      await loadUpdates()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update this shared item.')
    } finally {
      setBusy(false)
    }
  }

  const sections: { id: keyof Stacks; title: string; description: string; icon: typeof Sparkles; empty: string }[] = [
    { id: 'needsYou', title: 'Needs You', description: 'Things waiting on your vote, RSVP, or checklist update.', icon: Sparkles, empty: 'You’re all caught up.' },
    { id: 'happening', title: 'Happening', description: 'Events taking place right now.', icon: CalendarDays, empty: 'Nothing is happening right now.' },
    { id: 'decided', title: 'Decided', description: 'Closed polls, completed checklists, and pinned decisions.', icon: CheckSquare, empty: 'Decisions and completed items will show up here.' },
  ]
  const visibleCalls = filter === 'spaces' ? activeCalls.filter((call) => call.space_id) : activeCalls

  return <section className="updates-page">
    <header className="updates-header">
      <div><p className="eyebrow">YOUR WORKSPACE</p><h1>Updates</h1><p>Keep track of the things your conversations need from you.</p></div>
      <label className="updates-search"><Search size={16} aria-hidden="true" /><input type="search" name="updatesSearch" autoComplete="off" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
        if (event.key === 'Enter') void loadUpdates()
      }} placeholder="Search updates…" aria-label="Search updates" /><button type="button" onClick={() => void loadUpdates()}>Search</button></label>
    </header>
    <div className="updates-filters" aria-label="Filter Updates">
      <button type="button" aria-pressed={filter === 'all'} className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>All</button>
      <button type="button" aria-pressed={filter === 'spaces'} className={filter === 'spaces' ? 'is-active' : ''} onClick={() => setFilter('spaces')}>Spaces</button>
    </div>
    {error && <p className="spaces-error" role="alert">{error}</p>}
    <div className="updates-sections">
      {sections.map(({ id, title, description, icon: Icon, empty }) => <section className="updates-section" key={id} aria-labelledby={`updates-${id}`}>
          <header><span><Icon size={17} aria-hidden="true" /></span><div><h2 id={`updates-${id}`}>{title}</h2><p>{description}</p></div><b>{stacks[id].length + (id === 'happening' ? visibleCalls.length : 0)}</b></header>
          {id === 'happening' && visibleCalls.map((call) => <article className="updates-live-call" key={call.id}>
            <span className="updates-live-indicator" aria-hidden="true" />
            <div><strong>{call.title}</strong><small>{call.call_type === 'video' ? 'Video' : 'Audio'} call · {call.status === 'ringing' ? 'Ringing' : 'In progress'}</small></div>
            <button type="button" onClick={() => onOpenCall(call)}>{call.space_id ? 'Open channel' : 'Open chat'}</button>
          </article>)}
          {stacks[id].length === 0 && !(id === 'happening' && visibleCalls.length)
            ? <p className="updates-empty">{empty}</p>
          : <div className="updates-grid">{stacks[id].map((object) => <article className="updates-item" key={object.id}>
            <div className="updates-item-context"><strong>{object.space_name}</strong><span>#{object.channel_name}</span></div>
            <SharedObjectCard object={object} userId={userId} canManage={false} onRespond={(item, data) => void respond(item, data)} onStateChange={(item, state) => void changeState(item, state)} />
            <button className="updates-open-source" type="button" onClick={() => onOpenTarget(object.space_id, object.chat_id, object.message_id)}>Open in channel</button>
          </article>)}</div>}
      </section>)}
    </div>
    {busy && <p className="updates-saving" role="status">Saving your update…</p>}
  </section>
}
