import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight } from 'lucide-react'
import { api } from '../../shared/api'
import { createKeyBundle, unlockKeyBundle } from '../auth/crypto/crypto'
import type { KeyBundle } from '../../shared/types'
import { BrandMark } from '../../shared/components/BrandMark'
export function UnlockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await api<{ keyBundle: KeyBundle | null }>('/api/auth/key-bundle')
      if (result.keyBundle) {
        if (!(await unlockKeyBundle(result.keyBundle, password))) {
          setError('That password could not unlock this account’s encryption key.')
          return
        }
      } else {
        const generated = await createKeyBundle(password)
        await api<void>('/api/auth/encryption/initialize', {
          method: 'POST',
          body: JSON.stringify({ password, keyBundle: generated.keyBundle }),
        })
      }
      onUnlocked()
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : 'Unable to unlock encrypted chats.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="SyncUp encryption">
        <div className="story-topline"><BrandMark /><span>SyncUp</span></div>
        <div className="story-copy">
          <p className="eyebrow">YOUR KEYS, YOUR CONVERSATIONS</p>
          <h1>Private by<br />design.<br /><em>Ready when<br />you are.</em></h1>
          <p className="story-subtitle">Your personal chat key is encrypted with your password and never sent to the server in readable form.</p>
        </div>
        <div className="story-note"><span className="status-dot" /> End-to-end encrypted personal chats</div>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-inner">
          <div className="mobile-brand"><BrandMark small /><span>SyncUp</span></div>
          <p className="eyebrow">UNLOCK THIS DEVICE</p>
          <h2>Welcome back</h2>
          <p className="form-intro">Enter your password to unlock your encrypted conversations on this device.</p>
          <form className="auth-form" onSubmit={unlock}>
            <label><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? 'Unlocking…' : 'Unlock SyncUp'}{!loading && <ArrowRight size={14} aria-hidden="true" />}
            </button>
          </form>
        </div>
      </section>
    </main>
  )
}
