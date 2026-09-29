import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'
import { v7 as uuidv7 } from 'uuid'
import { pool } from '../../db.js'

const accessLifetimeSeconds = 15 * 60
export const refreshLifetimeMs = 30 * 24 * 60 * 60 * 1000
export const accessCookie = 'syncup_access'
export const refreshCookie = 'syncup_refresh'
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
export const isProduction = process.env.NODE_ENV === 'production'

export function authSecret() {
  const secret = process.env.AUTH_SECRET
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error('AUTH_SECRET must contain at least 32 bytes.')
  }
  return secret
}

export function createAccessToken(userId: string, sessionId: string) {
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    sid: sessionId,
    exp: Math.floor(Date.now() / 1000) + accessLifetimeSeconds,
  })).toString('base64url')
  const signature = createHmac('sha256', authSecret()).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function readAccessToken(token: unknown) {
  if (typeof token !== 'string') return null
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra !== undefined) return null
  const expected = createHmac('sha256', authSecret()).update(payload).digest()
  let provided: Buffer
  try {
    provided = Buffer.from(signature, 'base64url')
  } catch {
    return null
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub?: unknown
      sid?: unknown
      exp?: unknown
    }
    if (
      typeof claims.sub !== 'string'
      || typeof claims.sid !== 'string'
      || typeof claims.exp !== 'number'
      || claims.exp <= Math.floor(Date.now() / 1000)
    ) return null
    return { userId: claims.sub, sessionId: claims.sid }
  } catch {
    return null
  }
}

export function setAuthCookies(response: Response, accessToken: string, refreshToken: string) {
  response.cookie(accessCookie, accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api',
    maxAge: accessLifetimeSeconds * 1000,
  })
  response.cookie(refreshCookie, refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: refreshLifetimeMs,
  })
}

export async function createSession(request: Request, response: Response, userId: string) {
  authSecret()
  const refreshToken = randomBytes(32).toString('base64url')
  const tokenHash = hashToken(refreshToken)
  const userAgent = request.get('user-agent')?.slice(0, 512) ?? ''
  const expiresAt = new Date(Date.now() + refreshLifetimeMs)
  const sessionId = uuidv7()
  const deviceId = uuidv7()
  const refreshFamily = uuidv7()
  const eventId = uuidv7()

  await pool.query(
    `WITH new_device AS (
       INSERT INTO devices (id, user_id, name, platform)
       VALUES ($1, $2, 'Web browser', 'web')
       RETURNING id
     ), new_session AS (
       INSERT INTO sessions (id, user_id, device_id, refresh_family, token_hash, user_agent, expires_at)
       SELECT $3, $2, id, $4, $5, $6, $7 FROM new_device
       RETURNING id, user_id
     ), new_refresh AS (
       INSERT INTO session_refresh_tokens (token_hash, session_id)
       SELECT $5, id FROM new_session
       RETURNING session_id
     )
     INSERT INTO security_events (id, user_id, type, meta)
     SELECT $8, user_id, 'login', jsonb_build_object('session_id', id)
     FROM new_session`,
    [deviceId, userId, sessionId, refreshFamily, tokenHash, userAgent, expiresAt, eventId],
  )

  setAuthCookies(response, createAccessToken(userId, sessionId), refreshToken)
  return sessionId
}
