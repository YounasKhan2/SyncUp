import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, LockKeyhole } from 'lucide-react'
import { api } from '../../shared/api'
import type { AuthMode, KeyBundle, User } from '../../shared/types'
import { createKeyBundle, isKeyBundleUnlocked, unlockKeyBundle } from '../auth/crypto/crypto'
import { BrandMark } from '../../shared/components/BrandMark'
export function AuthScreen({ onSignedIn }: { onSignedIn: (user: User) => void }) {
  const [mode, setMode] = useState<AuthMode>('sign-up')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setLoading(true)
    const form = new FormData(event.currentTarget)
    const payload: Record<string, string> = {
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
    }
    if (mode === 'sign-up') {
      payload.username = String(form.get('username') ?? '')
      payload.displayName = String(form.get('displayName') ?? '')
    }
    try {
      const password = payload.password
      let generated = mode === 'sign-up' ? await createKeyBundle(password) : null
      const result = await api<{ user: User; keyBundle?: KeyBundle | null }>('/api/auth/' + mode, {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          ...(generated ? { keyBundle: generated.keyBundle } : {}),
        }),
      })
      if (mode === 'sign-in' && !result.keyBundle) {
        generated = await createKeyBundle(password)
        await api<void>('/api/auth/encryption/initialize', {
          method: 'POST',
          body: JSON.stringify({ password, keyBundle: generated.keyBundle }),
        })
      } else if (mode === 'sign-in' && result.keyBundle && !(await unlockKeyBundle(result.keyBundle, password))) {
        throw new Error('Unable to unlock encrypted chats. Check your password and try again.')
      } else if (mode === 'sign-up' && !isKeyBundleUnlocked()) {
        throw new Error('Unable to unlock the new account’s encryption key.')
      }
      onSignedIn(result.user)
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Unable to sign in.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story" aria-label="About SyncUp">
        <div className="story-topline"><BrandMark /><span>SyncUp</span></div>
        <div className="story-copy">
          <p className="eyebrow">A better place to work together</p>
          <h1>Good work<br />happens when<br /><em>we’re in sync.</em></h1>
          <p className="story-subtitle">A calm, shared space for the conversations and decisions that move work forward.</p>
        </div>
        <div className="story-note"><span className="status-dot" /> Private chats. Shared rooms. Less scattered work.</div>
        <div className="story-orbit orbit-one" />
        <div className="story-orbit orbit-two" />
      </section>

      <section className="auth-panel">
        <div className="auth-panel-inner">
          <div className="mobile-brand"><BrandMark small /><span>SyncUp</span></div>
          <p className="eyebrow">{mode === 'sign-up' ? 'YOUR WORK, IN GOOD COMPANY' : 'WELCOME BACK'}</p>
          <h2>{mode === 'sign-up' ? 'Create your account' : 'Sign in to SyncUp'}</h2>
          <p className="form-intro">
            {mode === 'sign-up'
              ? 'Start with a private account. Invite your people when you’re ready.'
              : 'Pick up right where your conversations left off.'}
          </p>

          <form className="auth-form" onSubmit={submit}>
            {mode === 'sign-up' && (
              <>
                <label>
                  <span>Your name</span>
                  <input name="displayName" type="text" autoComplete="name" placeholder="Ava Morgan" maxLength={60} required />
                </label>
                <label>
                  <span>Username</span>
                  <div className="username-input"><span>@</span><input name="username" type="text" autoComplete="username" placeholder="yourname" minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" required /></div>
                  <small>3–24 letters, numbers, or underscores</small>
                </label>
              </>
            )}
            <label>
              <span>Email</span>
              <input name="email" type="email" autoComplete="email" placeholder="you@example.com" maxLength={254} required />
            </label>
            <label>
              <span>Password</span>
              <input name="password" type="password" autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} placeholder={mode === 'sign-up' ? 'At least 10 characters' : 'Your password'} minLength={mode === 'sign-up' ? 10 : 1} maxLength={128} required />
            </label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className="primary-button" type="submit" disabled={loading}>
              {loading ? 'Please wait…' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
              {!loading && <ArrowRight size={14} aria-hidden="true" />}
            </button>
          </form>
          <p className="auth-switch">
            {mode === 'sign-up' ? 'Already have an account?' : 'New to SyncUp?'}
            {' '}
            <button type="button" onClick={() => { setError(''); setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up') }}>
              {mode === 'sign-up' ? 'Sign in' : 'Create an account'}
            </button>
          </p>
          <p className="privacy-note"><LockKeyhole size={13} aria-hidden="true" /> Your account is private. Your chats stay yours.</p>
        </div>
      </section>
    </main>
  )
}
