import type { SpaceSharedObject } from '../types'
import { SharedObjectCard } from '../SharedObjectCard'

export function UpdateItem({ object, userId, onRespond, onStateChange, onOpen }: {
  object: SpaceSharedObject
  userId: string
  onRespond: (object: SpaceSharedObject, data: Record<string, unknown>) => void
  onStateChange: (object: SpaceSharedObject, state: 'closed' | 'cancelled' | 'unpinned') => void
  onOpen: () => void
}) {
  return <article className="updates-item">
            <div className="updates-item-context"><strong>{object.space_name}</strong><span>#{object.channel_name}</span></div>
            <SharedObjectCard object={object} userId={userId} canManage={false} onRespond={onRespond} onStateChange={onStateChange} />
            <button className="updates-open-source" type="button" onClick={onOpen}>Open in channel</button>
          </article>
}
