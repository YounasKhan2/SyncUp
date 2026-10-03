import { useState } from 'react'
import type { FormEvent } from 'react'
import { Flag, X } from 'lucide-react'
import { submitReport } from '../api'
import { Button } from '../../../shared/components/Button'
import { IconButton } from '../../../shared/components/IconButton'
import { Dialog } from '../../../shared/components/Dialog'

const reasons = [
  ['spam', 'Spam'],
  ['harassment', 'Harassment'],
  ['threats', 'Threats or violence'],
  ['inappropriate_content', 'Inappropriate content'],
  ['impersonation', 'Impersonation'],
  ['other', 'Other'],
] as const

export function ReportDialog({ messageId, onClose }: { messageId: string; onClose: () => void }) {
  const [reason, setReason] = useState<(typeof reasons)[number][0]>('harassment')
  const [details, setDetails] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await submitReport({ messageId, reason, details })
      onClose()
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : 'Unable to submit this report.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog className="report-dialog" aria-labelledby="report-title" onBackdropMouseDown={(event) => {
      if (event.target === event.currentTarget && !submitting) onClose()
    }}>
        <div className="dialog-heading">
          <div><p className="eyebrow">SAFETY & PRIVACY</p><h2 id="report-title">Report this message</h2></div>
          <IconButton type="button" onClick={onClose} aria-label="Close report"><X size={15} aria-hidden="true" /></IconButton>
        </div>
        <p className="sessions-caption">Reports are stored for review by SyncUp administrators.</p>
        <form className="safety-form" onSubmit={(event) => void submit(event)}>
          <label><span>Reason</span><select value={reason} onChange={(event) => setReason(event.target.value as (typeof reasons)[number][0])}>{reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>Additional details (optional)</span><textarea value={details} onChange={(event) => setDetails(event.target.value)} rows={3} maxLength={1000} /></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <Button type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit report'}<Flag size={13} aria-hidden="true" /></Button>
        </form>
    </Dialog>
  )
}
