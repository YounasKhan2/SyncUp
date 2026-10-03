import type { FormEventHandler } from 'react'
import { Plus, X } from 'lucide-react'

type CreateCategoryDialogProps = {
  spaceName: string
  name: string
  error: string
  busy: boolean
  onNameChange: (value: string) => void
  onClose: () => void
  onSubmit: FormEventHandler<HTMLFormElement>
}

// Controlled presentation only; creation and selection remain in SpacesPage.
export function CreateCategoryDialog({ spaceName, name, error, busy, onNameChange, onClose, onSubmit }: CreateCategoryDialogProps) {
  return (
    <div className="overlay space-dialog-overlay" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}>
        <section className="account-dialog space-dialog" role="dialog" aria-modal="true" aria-labelledby="create-category-title">
          <div className="dialog-heading"><div><p className="eyebrow">{spaceName}</p><h2 id="create-category-title">Create a category</h2></div>
            <button className="icon-button" type="button" onClick={() => onClose()} aria-label="Close"><X size={15} aria-hidden="true" /></button>
          </div>
          <p className="space-dialog-copy">Categories organize related channels. They can be collapsed in the channel list.</p>
          <form className="profile-form" onSubmit={onSubmit}>
            <label><span>Category name</span><input value={name} onChange={(event) => onNameChange(event.target.value)} placeholder="e.g. Project" maxLength={40} autoFocus required /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button" disabled={busy}>{busy ? 'Creating…' : 'Create category'}<Plus size={14} aria-hidden="true" /></button>
          </form>
        </section>
      </div>
  )
}
