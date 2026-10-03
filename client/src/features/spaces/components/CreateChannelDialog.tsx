import type { FormEventHandler } from 'react'
import { Plus, X } from 'lucide-react'
import type { SpaceCategory, SpaceChannel } from '../types'

type CreateChannelDialogProps = {
  categories: SpaceCategory[]
  categoryId: string
  name: string
  topic: string
  type: SpaceChannel['type']
  error: string
  busy: boolean
  onCategoryChange: (value: string) => void
  onNameChange: (value: string) => void
  onTopicChange: (value: string) => void
  onTypeChange: (value: SpaceChannel['type']) => void
  onClose: () => void
  onSubmit: FormEventHandler<HTMLFormElement>
}

// Controlled presentation only; normalization, mutation and refresh stay parent-owned.
export function CreateChannelDialog({ categories, categoryId, name, topic, type, error, busy, onCategoryChange, onNameChange, onTopicChange, onTypeChange, onClose, onSubmit }: CreateChannelDialogProps) {
  return (
    <div className="overlay space-dialog-overlay" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}>
        <section className="account-dialog space-dialog" role="dialog" aria-modal="true" aria-labelledby="create-channel-title">
          <div className="dialog-heading"><div><p className="eyebrow">SPACE CHANNELS</p><h2 id="create-channel-title">Create a channel</h2></div>
            <button className="icon-button" type="button" onClick={() => onClose()} aria-label="Close"><X size={15} aria-hidden="true" /></button>
          </div>
          <p className="space-dialog-copy">Channels keep different conversations easy to find. The <strong>#general</strong> channel is already here.</p>
          <form className="profile-form" onSubmit={onSubmit}>
            <label><span>Category</span><select value={categoryId} onChange={(event) => onCategoryChange(event.target.value)} required>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select></label>
            <label><span>Channel name</span><input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="e.g. design-feedback" maxLength={40} pattern="[a-z0-9][a-z0-9-]*" autoComplete="off" autoFocus required aria-describedby="channel-name-hint" /></label>
            <small id="channel-name-hint" className="space-channel-name-hint">Lowercase letters, numbers, and hyphens. Spaces become hyphens.</small>
            <label><span>Topic <small>(optional)</small></span><input value={topic} onChange={(event) => onTopicChange(event.target.value)} placeholder="What should people discuss here?" maxLength={160} /></label>
            <label><span>Channel type</span><select value={type} onChange={(event) => onTypeChange(event.target.value as SpaceChannel['type'])}>
              <option value="discussion">Text channel</option><option value="announcement">Announcement channel</option><option value="private">Private channel</option><option value="voice">Voice room</option>
            </select></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button" disabled={busy}>{busy ? 'Creating…' : 'Create channel'}<Plus size={14} aria-hidden="true" /></button>
          </form>
        </section>
      </div>
  )
}
