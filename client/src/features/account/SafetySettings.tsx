import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Flag, ShieldBan, UserRoundX } from 'lucide-react'
import { api } from '../../shared/api'

type BlockedUser = { id: string; username: string; display_name: string; blocked_at: string }

const reasons = [
  ['spam', 'Spam'],
  ['harassment', 'Harassment'],
  ['threats', 'Threats or violence'],
  ['inappropriate_content', 'Inappropriate content'],
  ['impersonation', 'Impersonation'],
  ['other', 'Other'],
] as const

export function SafetySettings() {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([])
  const [username, setUsername] = useState('')
  const [reportUsername, setReportUsername] = useState('')
  const [reportReason, setReportReason] = useState<(typeof reasons)[number][0]>('harassment')
  const [reportDetails, setReportDetails] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  const refreshBlocks = useCallback(async () => {
    const result = await api<{ blockedUsers: BlockedUser[] }>('/api/blocks')
    setBlockedUsers(result.blockedUsers)
  }, [])

  useEffect(() => {
    let active = true
    api<{ blockedUsers: BlockedUser[] }>('/api/blocks')
      .then((result) => { if (active) setBlockedUsers(result.blockedUsers) })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load blocked users.')
      })
    return () => { active = false }
  }, [])

  async function blockUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    setLoading(true)
    try {
      await api<void>('/api/blocks', {
        method: 'POST',
        body: JSON.stringify({ username }),
      })
      setUsername('')
      setNotice('User blocked. Direct messages and pending requests are closed.')
      await refreshBlocks()
    } catch (blockError) {
      setError(blockError instanceof Error ? blockError.message : 'Unable to block this user.')
    } finally {
      setLoading(false)
    }
  }

  async function unblockUser(user: BlockedUser) {
    setError('')
    setNotice('')
    try {
      await api<void>(`/api/blocks/${encodeURIComponent(user.id)}`, { method: 'DELETE' })
      setNotice(`@${user.username} unblocked.`)
      await refreshBlocks()
    } catch (unblockError) {
      setError(unblockError instanceof Error ? unblockError.message : 'Unable to unblock this user.')
    }
  }

  async function reportUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    setLoading(true)
    try {
      await api('/api/reports', {
        method: 'POST',
        body: JSON.stringify({ username: reportUsername, reason: reportReason, details: reportDetails }),
      })
      setReportUsername('')
      setReportDetails('')
      setNotice('Report submitted for review.')
    } catch (reportError) {
      setError(reportError instanceof Error ? reportError.message : 'Unable to submit this report.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="safety-settings" aria-labelledby="safety-title">
      <div className="sessions-heading"><h3 id="safety-title"><ShieldBan size={14} aria-hidden="true" /> Safety & privacy</h3></div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {notice && <p className="form-success" role="status">{notice}</p>}
      <form className="safety-form" onSubmit={blockUser}>
        <label><span>Block someone</span><div className="safety-inline-form"><input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Their username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" required /><button type="submit" disabled={loading}><UserRoundX size={13} aria-hidden="true" /> Block</button></div></label>
      </form>
      {blockedUsers.length > 0
        ? <div className="blocked-user-list">{blockedUsers.map((user) => (
          <div className="blocked-user-row" key={user.id}>
            <span><strong>{user.display_name}</strong><small>@{user.username}</small></span>
            <button type="button" onClick={() => void unblockUser(user)}>Unblock</button>
          </div>
        ))}</div>
        : <p className="sessions-caption">You haven’t blocked anyone.</p>}
      <form className="safety-form" onSubmit={reportUser}>
        <label><span>Report a user</span><input value={reportUsername} onChange={(event) => setReportUsername(event.target.value)} placeholder="Their username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" required /></label>
        <label><span>Reason</span><select value={reportReason} onChange={(event) => setReportReason(event.target.value as (typeof reasons)[number][0])}>{reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Additional details (optional)</span><textarea value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} rows={2} maxLength={1000} /></label>
        <button className="secondary-button" type="submit" disabled={loading}><Flag size={13} aria-hidden="true" /> Submit report</button>
      </form>
    </section>
  )
}
