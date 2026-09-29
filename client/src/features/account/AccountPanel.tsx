import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Monitor, X } from 'lucide-react'
import { api } from '../../shared/api'
import type { Session, User } from '../../shared/types'
import { SafetySettings } from './SafetySettings'
export function AccountPanel({ user, onClose, onSaved }: {
  user: User
  onClose: () => void
  onSaved: (user: User) => void
}) {
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSessionId, setCurrentSessionId] = useState('')
  const [sessionsError, setSessionsError] = useState('')

  async function loadSessions() {
    setSessionsError('')
    const result = await api<{ sessions: Session[]; currentSessionId: string }>('/api/auth/sessions')
    setSessions(result.sessions)
    setCurrentSessionId(result.currentSessionId)
  }

  useEffect(() => {
    let mounted = true
    api<{ sessions: Session[]; currentSessionId: string }>('/api/auth/sessions')
      .then((result) => {
        if (mounted) {
          setSessions(result.sessions)
          setCurrentSessionId(result.currentSessionId)
        }
      })
      .catch((sessionsLoadError: unknown) => {
        if (mounted) {
          setSessionsError(sessionsLoadError instanceof Error ? sessionsLoadError.message : 'Unable to load sessions.')
        }
      })
    return () => { mounted = false }
  }, [])

  async function revokeSession(sessionId: string) {
    setSessionsError('')
    try {
      await api<void>(`/api/auth/sessions/${encodeURIComponent(sessionId)}/revoke`, { method: 'POST' })
      await loadSessions()
    } catch (revokeError) {
      setSessionsError(revokeError instanceof Error ? revokeError.message : 'Unable to revoke session.')
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSaved('')
    setLoading(true)
    const form = new FormData(event.currentTarget)
    try {
      const result = await api<{ user: User }>('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({
          displayName: String(form.get('displayName') ?? ''),
          username: String(form.get('username') ?? ''),
          about: String(form.get('about') ?? ''),
        }),
      })
      onSaved(result.user)
      setSaved('Profile saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save changes.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <div className="dialog-heading">
          <div><p className="eyebrow">YOUR ACCOUNT</p><h2 id="account-title">Profile & settings</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close profile"><X size={15} aria-hidden="true" /></button>
        </div>
        <form className="profile-form" onSubmit={saveProfile}>
          <label><span>Display name</span><input name="displayName" defaultValue={user.display_name} maxLength={60} required /></label>
          <label><span>Username</span><div className="username-input"><span>@</span><input name="username" defaultValue={user.username} minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" required /></div></label>
          <label><span>About</span><textarea name="about" defaultValue={user.about ?? ''} rows={3} maxLength={160} placeholder="A little about you" /></label>
          <label><span>Email</span><input value={user.email} readOnly /></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          {saved && <p className="form-success" role="status">{saved}</p>}
          <button className="primary-button" type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save profile'}{!loading && <ArrowRight size={14} aria-hidden="true" />}</button>
        </form>
        <div className="sessions-section">
          <div className="sessions-heading"><h3>Active sessions</h3><button type="button" onClick={() => void loadSessions()}>Refresh</button></div>
          <p className="sessions-caption">Sign out devices you no longer use.</p>
          {sessionsError && <div className="form-error" role="alert">{sessionsError}</div>}
          <div className="session-list">
            {sessions.map((session) => (
              <div className="session-row" key={session.id}>
                <span className="session-device" aria-hidden="true"><Monitor size={14} /></span>
                <div><span className="small strong">{session.device_name}{session.id === currentSessionId ? ' · This device' : ''}</span><span className="micro muted">Active {new Date(session.last_active_at).toLocaleString()}</span></div>
                {session.id !== currentSessionId && <button type="button" onClick={() => void revokeSession(session.id)}>Revoke</button>}
              </div>
            ))}
            {sessions.length === 0 && !sessionsError && <p className="sessions-caption">No active sessions found.</p>}
          </div>
        </div>
        <SafetySettings />
      </section>
    </div>
  )
}
