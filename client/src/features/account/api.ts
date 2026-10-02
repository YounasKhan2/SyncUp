import { api, apiUpload } from '../../shared/api'
import type { Session, User } from '../../shared/types'

type SessionsResponse = { sessions: Session[]; currentSessionId: string }
export type UpdateProfileInput = {
  displayName: string
  username: string
  about: string
  discoverable: boolean
  readReceiptsEnabled: boolean
}

export function listSessions() {
  return api<SessionsResponse>('/api/auth/sessions')
}

export function revokeSession(sessionId: string) {
  return api<void>(`/api/auth/sessions/${encodeURIComponent(sessionId)}/revoke`, { method: 'POST' })
}

export function updateProfile(input: UpdateProfileInput) {
  return api<{ user: User }>('/api/auth/me', { method: 'PATCH', body: JSON.stringify(input) })
}

export function getCurrentUser() {
  return api<{ user: User }>('/api/auth/me')
}

export function uploadAvatar(bytes: ArrayBuffer, contentType: string) {
  return apiUpload('/api/auth/me/avatar', bytes, contentType)
}

export function removeAvatar() {
  return api<{ user: User }>('/api/auth/me/avatar', { method: 'DELETE' })
}
