import { useEffect, useState } from 'react'
import { CalendarDays, Check, CheckSquare, CircleCheck, Pin, BarChart3, X } from 'lucide-react'
import type { SpaceSharedObject } from './types'

export function SharedObjectCard({ object, userId, canManage, onRespond, onStateChange }: {
  object: SpaceSharedObject
  userId: string
  canManage: boolean
  onRespond: (object: SpaceSharedObject, response: Record<string, unknown>) => void
  onStateChange: (object: SpaceSharedObject, state: 'closed' | 'cancelled' | 'unpinned') => void
}) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>(object.my_response?.optionIds ?? [])
  useEffect(() => setSelectedOptions(object.my_response?.optionIds ?? []), [object.my_response])
  const isClosed = ['closed', 'completed', 'cancelled', 'ended', 'unpinned'].includes(object.state)
  const responseCount = Object.values(object.response_counts ?? {}).reduce((sum, count) => sum + count, 0)
  return <section className={`shared-object-card shared-object-${object.object_type}`} aria-label={`${object.object_type}: ${object.title}`}>
    <header className="shared-object-heading">
      <span className="shared-object-icon">{object.object_type === 'poll' ? <BarChart3 size={16} aria-hidden="true" /> : object.object_type === 'event' ? <CalendarDays size={16} aria-hidden="true" /> : object.object_type === 'checklist' ? <CheckSquare size={16} aria-hidden="true" /> : <Pin size={16} aria-hidden="true" />}</span>
      <span><strong>{object.object_type === 'decision' ? 'Decision' : object.object_type[0].toUpperCase() + object.object_type.slice(1)}</strong><small>{object.state === 'active' && object.object_type === 'event' ? 'Happening now' : object.state[0]?.toUpperCase() + object.state.slice(1)}</small></span>
      {canManage && object.object_type === 'poll' && !isClosed && <button type="button" className="shared-object-action" onClick={() => onStateChange(object, 'closed')} aria-label="Close poll"><X size={15} aria-hidden="true" /></button>}
      {canManage && object.object_type === 'event' && !isClosed && <button type="button" className="shared-object-action" onClick={() => onStateChange(object, 'cancelled')} aria-label="Cancel event"><X size={15} aria-hidden="true" /></button>}
      {canManage && object.object_type === 'decision' && object.state === 'active' && <button type="button" className="shared-object-action" onClick={() => onStateChange(object, 'unpinned')} aria-label="Unpin decision"><X size={15} aria-hidden="true" /></button>}
    </header>
    <h3>{object.title}</h3>
    {object.object_type === 'poll' && <>
      <div className="shared-poll-options">
        {(object.payload.options ?? []).map((option) => {
          const count = object.response_counts?.[option.id] ?? 0
          const checked = selectedOptions.includes(option.id)
          return <label key={option.id} className={checked ? 'is-selected' : ''}>
            <input type={object.payload.multiSelect ? 'checkbox' : 'radio'} name={`poll-${object.id}`} checked={checked}
              disabled={isClosed}
              onChange={() => setSelectedOptions((current) => object.payload.multiSelect
                ? checked ? current.filter((id) => id !== option.id) : [...current, option.id]
                : [option.id])} />
            <span>{option.text}</span>
            <small>{count}</small>
          </label>
        })}
      </div>
      <footer className="shared-object-footer">
        <small>{responseCount} {responseCount === 1 ? 'vote' : 'votes'}{object.payload.anonymous ? ' · Anonymous poll' : ''}</small>
        {!isClosed && <button type="button" className="secondary-button" disabled={!selectedOptions.length} onClick={() => onRespond(object, { type: 'poll', optionIds: selectedOptions })}>{object.my_response ? 'Update vote' : 'Vote'}</button>}
      </footer>
    </>}
    {object.object_type === 'event' && <>
      <p className="shared-object-detail"><CalendarDays size={14} aria-hidden="true" />
        {object.payload.startsAt && new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone: object.payload.timezone }).format(new Date(object.payload.startsAt))}
        {object.payload.endsAt && ` – ${new Intl.DateTimeFormat(undefined, { timeStyle: 'short', timeZone: object.payload.timezone }).format(new Date(object.payload.endsAt))}`}
        {object.payload.timezone ? ` · ${object.payload.timezone}` : ''}
      </p>
      {object.payload.locationText && <p className="shared-object-detail">{object.payload.locationText}</p>}
      <div className="shared-rsvp-actions">
        {(['yes', 'maybe', 'no'] as const).map((rsvp) => <button key={rsvp} type="button" aria-pressed={object.my_response?.rsvp === rsvp} className={object.my_response?.rsvp === rsvp ? 'is-selected' : ''}
          disabled={['cancelled', 'ended'].includes(object.state)}
          onClick={() => onRespond(object, { type: 'event', rsvp })}>{rsvp === 'yes' ? 'Going' : rsvp === 'maybe' ? 'Maybe' : 'Can’t go'} <small>{object.response_counts?.[rsvp] ?? 0}</small></button>)}
      </div>
    </>}
    {object.object_type === 'checklist' && <div className="shared-checklist-items">
      {(object.payload.items ?? []).map((item) => <label key={item.id} className={item.done ? 'is-done' : ''}>
        <input type="checkbox" checked={item.done} disabled={Boolean(item.assigneeId && item.assigneeId !== userId && !canManage)}
          onChange={(event) => onRespond(object, { type: 'checklist', itemId: item.id, done: event.target.checked })} />
        <span>{item.text}{item.assigneeId === userId && <small>Assigned to you</small>}</span>
        {item.done && <Check size={14} aria-hidden="true" />}
      </label>)}
    </div>}
    {object.object_type === 'decision' && <blockquote>{object.payload.quote || 'Pinned as a project decision.'}</blockquote>}
    {object.object_type === 'checklist' && object.state === 'completed' && <p className="shared-object-completed"><CircleCheck size={14} aria-hidden="true" /> Checklist completed</p>}
  </section>
}
