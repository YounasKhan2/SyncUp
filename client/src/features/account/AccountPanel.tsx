import { AccountSessionsSection } from './components/AccountSessionsSection'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Camera, Trash2, X } from 'lucide-react'
import { getCurrentUser, listSessions, removeAvatar as removeAccountAvatar, revokeSession as revokeAccountSession, updateProfile, uploadAvatar } from './api'
import type { Session, User } from '../../shared/types'
import { Avatar } from '../../shared/components/Avatar'
import { Button } from '../../shared/components/Button'
import { IconButton } from '../../shared/components/IconButton'
import { Dialog } from '../../shared/components/Dialog'
import { SafetySettings } from './SafetySettings'
import type { AppearancePreference } from '../../shared/appearance'
export function AccountPanel({ user, appearance, onAppearanceChange, onClose, onSaved }: {
  user: User
  appearance: AppearancePreference
  onAppearanceChange: (preference: AppearancePreference) => void
  onClose: () => void
  onSaved: (user: User) => void
}) {
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSessionId, setCurrentSessionId] = useState('')
  const [sessionsError, setSessionsError] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [avatarBusy, setAvatarBusy] = useState(false)
  const avatarInput = useRef<HTMLInputElement>(null)

  useEffect(() => () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
  }, [avatarPreview])

  async function loadSessions() {
    setSessionsError('')
    const result = await listSessions()
    setSessions(result.sessions)
    setCurrentSessionId(result.currentSessionId)
  }

  useEffect(() => {
    let mounted = true
    listSessions()
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
      await revokeAccountSession(sessionId)
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
      const result = await updateProfile({
        displayName: String(form.get('displayName') ?? ''),
        username: String(form.get('username') ?? ''),
        about: String(form.get('about') ?? ''),
        discoverable: form.get('discoverable') === 'on',
        readReceiptsEnabled: form.get('readReceiptsEnabled') === 'on',
      })
      onSaved(result.user)
      setSaved('Profile saved.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save changes.')
    } finally {
      setLoading(false)
    }
  }

  function selectAvatar(file: File | undefined) {
    setError('')
    setSaved('')
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPEG, PNG, or WebP image.')
      if (avatarInput.current) avatarInput.current.value = ''
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Profile photos must be 2 MB or smaller.')
      if (avatarInput.current) avatarInput.current.value = ''
      return
    }
    setAvatarPreview(URL.createObjectURL(file))
    setAvatarFile(file)
  }

  async function saveAvatar() {
    if (!avatarFile) return
    setError('')
    setSaved('')
    setAvatarBusy(true)
    try {
      const bytes = await avatarFile.arrayBuffer()
      const result = await (async () => {
        await uploadAvatar(bytes, avatarFile.type)
        return getCurrentUser()
      })()
      onSaved(result.user)
      setAvatarFile(null)
      setAvatarPreview('')
      if (avatarInput.current) avatarInput.current.value = ''
      setSaved('Profile photo updated.')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Unable to upload your profile photo.')
    } finally {
      setAvatarBusy(false)
    }
  }

  async function removeAvatar() {
    setError('')
    setSaved('')
    setAvatarBusy(true)
    try {
      const result = await removeAccountAvatar()
      onSaved(result.user)
      setAvatarFile(null)
      setAvatarPreview('')
      if (avatarInput.current) avatarInput.current.value = ''
      setSaved('Profile photo removed.')
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Unable to remove your profile photo.')
    } finally {
      setAvatarBusy(false)
    }
  }

  return (
    <Dialog className="account-settings-dialog ui:bg-surface ui:text-primary" aria-labelledby="account-title" onBackdropMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
        <div className="dialog-heading account-settings-heading">
          <div><p className="eyebrow">YOUR ACCOUNT</p><h2 id="account-title">Profile & settings</h2></div>
          <IconButton type="button" onClick={onClose} aria-label="Close profile"><X size={15} aria-hidden="true" /></IconButton>
        </div>
        <form className="profile-form account-profile-form" onSubmit={saveProfile}>
          <div className="profile-avatar-editor">
            <Avatar name={user.display_name} src={avatarPreview || user.avatar_url} className="profile-avatar" />
            <div className="profile-avatar-actions">
              <strong>Profile photo</strong>
              <span>JPEG, PNG, or WebP · up to 2 MB</span>
              <div>
                <input
                  ref={avatarInput}
                  className="visually-hidden"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Choose a profile photo"
                  onChange={(event) => selectAvatar(event.currentTarget.files?.[0])}
                />
                <button type="button" className="secondary-button" disabled={avatarBusy} onClick={() => avatarInput.current?.click()}>
                  <Camera size={13} aria-hidden="true" /> Choose photo
                </button>
                {avatarFile && <button type="button" className="secondary-button" disabled={avatarBusy} onClick={() => void saveAvatar()}>
                  {avatarBusy ? 'Uploading…' : 'Upload photo'}
                </button>}
                {!avatarFile && user.avatar_url && <button type="button" className="secondary-button account-danger-action" disabled={avatarBusy} onClick={() => void removeAvatar()}>
                  <Trash2 size={13} aria-hidden="true" /> Remove
                </button>}
              </div>
            </div>
          </div>
          <label><span>Display name</span><input name="displayName" defaultValue={user.display_name} maxLength={60} required /></label>
          <label><span>Username</span><div className="username-input account-username-input"><span>@</span><input name="username" defaultValue={user.username} minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" required /></div></label>
          <label><span>About</span><textarea name="about" defaultValue={user.about ?? ''} rows={3} maxLength={160} placeholder="A little about you" /></label>
          <label className="profile-checkbox">
            <input type="checkbox" name="discoverable" defaultChecked={user.discoverable ?? true} />
            <span><strong>Username discoverability</strong><small>Let people find you by username and send you a message request.</small></span>
          </label>
          <label className="profile-checkbox">
            <input type="checkbox" name="readReceiptsEnabled" defaultChecked={user.read_receipts_enabled ?? true} />
            <span><strong>Read receipts</strong><small>Let other members know when you have read their messages.</small></span>
          </label>
          <label><span>Appearance</span><select value={appearance} onChange={(event) => {
            const preference = event.currentTarget.value
            try {
              if (preference === 'system' || preference === 'light' || preference === 'dark') {
                onAppearanceChange(preference)
              }
              setError('')
            } catch (appearanceError) {
              setError(appearanceError instanceof Error ? appearanceError.message : 'Unable to save appearance preference.')
            }
          }}>
            <option value="system">Use device setting</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select><small className="appearance-caption">Saved on this device.</small></label>
          <label><span>Email</span><input value={user.email} readOnly /></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          {saved && <p className="form-success" role="status">{saved}</p>}
          <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save profile'}{!loading && <ArrowRight size={14} aria-hidden="true" />}</Button>
        </form>
        <AccountSessionsSection
          rows={sessions.map((session) => ({
            id: session.id,
            deviceName: session.device_name,
            activeLabel: new Date(session.last_active_at).toLocaleString(),
            isCurrent: session.id === currentSessionId,
            onRevoke: () => void revokeSession(session.id),
          }))}
          error={sessionsError}
          onRefresh={() => void loadSessions()}
        />
        <SafetySettings />
    </Dialog>
  )
}
