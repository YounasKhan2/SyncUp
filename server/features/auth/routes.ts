import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { rateLimit } from 'express-rate-limit'
import { v7 as uuidv7 } from 'uuid'
import { pool } from '../../db.js'
import { requireAuth } from './middleware.js'
import { authSecret, accessCookie, refreshCookie, refreshLifetimeMs, hashToken, createAccessToken, setAuthCookies, createSession, isProduction } from './session.js'
import { initializeKeysSchema, profileSchema, signInSchema, signUpSchema } from './schemas.js'
import type { AuthenticatedRequest } from './types.js'

export const authRouter = Router()
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'rate_limited', message: 'Too many authentication attempts.' } },
})

authRouter.post('/sign-up', authLimiter, async (request, response, next) => {
  const parsed = signUpSchema.safeParse(request.body)
  if (!parsed.success) {
    response.status(400).json({
      error: { code: 'validation', message: 'Check your email, username, name, and password.' },
    })
    return
  }

  try {
    authSecret()
    const passwordHash = await bcrypt.hash(parsed.data.password, 12)
    const userId = uuidv7()
    const refreshToken = randomBytes(32).toString('base64url')
    const userAgent = request.get('user-agent')?.slice(0, 512) ?? ''
    const expiresAt = new Date(Date.now() + refreshLifetimeMs)
    const sessionId = uuidv7()
    const deviceId = uuidv7()
    const refreshFamily = uuidv7()
    const tokenHash = hashToken(refreshToken)
    const eventId = uuidv7()
    const result = await pool.query<{
      id: string
      email: string
      username: string
      display_name: string
      session_id: string
    }>(
      `WITH new_user AS (
         INSERT INTO users (
           id, email, username, display_name, password_hash, encryption_public_key,
           encrypted_private_key, private_key_iv, key_vault_salt, encryption_key_version
         )
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, 1)
         RETURNING id, email, username, display_name
       ), new_device AS (
         INSERT INTO devices (id, user_id, name, platform)
         SELECT $10, id, 'Web browser', 'web' FROM new_user
         RETURNING id, user_id
       ), new_session AS (
         INSERT INTO sessions (id, user_id, device_id, refresh_family, token_hash, user_agent, expires_at)
         SELECT $11, user_id, id, $12, $13, $14, $15 FROM new_device
         RETURNING id
       ), new_refresh AS (
         INSERT INTO session_refresh_tokens (token_hash, session_id)
         SELECT $13, id FROM new_session
         RETURNING session_id
       ), new_event AS (
         INSERT INTO security_events (id, user_id, type)
         SELECT $16, id, 'sign_up' FROM new_user
         RETURNING user_id
       )
       SELECT new_user.*, new_refresh.session_id
       FROM new_user CROSS JOIN new_refresh CROSS JOIN new_event`,
      [
        userId, parsed.data.email, parsed.data.username, parsed.data.displayName, passwordHash,
        JSON.stringify(parsed.data.keyBundle.publicKey), parsed.data.keyBundle.encryptedPrivateKey,
        parsed.data.keyBundle.privateKeyIv, parsed.data.keyBundle.vaultSalt,
        deviceId, sessionId, refreshFamily, tokenHash, userAgent, expiresAt, eventId,
      ],
    )
    const user = result.rows[0]
    setAuthCookies(response, createAccessToken(user.id, user.session_id), refreshToken)
    response.status(201).json({
      user: { id: user.id, email: user.email, username: user.username, display_name: user.display_name },
      sessionId: user.session_id,
    })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      response.status(409).json({
        error: { code: 'conflict', message: 'That email or username is already in use.' },
      })
      return
    }
    next(error)
  }
})

authRouter.post('/sign-in', authLimiter, async (request, response, next) => {
  const parsed = signInSchema.safeParse(request.body)
  if (!parsed.success) {
    response.status(400).json({
      error: { code: 'validation', message: 'Enter a valid email and password.' },
    })
    return
  }

  try {
    authSecret()
    const result = await pool.query<{
      id: string
      email: string
      username: string
      display_name: string
      password_hash: string
      encryption_public_key: JsonWebKey
      encrypted_private_key: string
      private_key_iv: string
      key_vault_salt: string
    }>(
      `SELECT id, email, username, display_name, password_hash,
              encryption_public_key, encrypted_private_key, private_key_iv, key_vault_salt
       FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [parsed.data.email],
    )
    const user = result.rows[0]
    const passwordMatches = user
      ? await bcrypt.compare(parsed.data.password, user.password_hash)
      : (await bcrypt.hash(parsed.data.password, 12), false)
    if (!user || !passwordMatches) {
      response.status(401).json({
        error: { code: 'unauthorized', message: 'Email or password is incorrect.' },
      })
      return
    }

    const sessionId = await createSession(request, response, user.id)
    response.json({
      user: { id: user.id, email: user.email, username: user.username, display_name: user.display_name },
      sessionId,
      keyBundle: {
        publicKey: user.encryption_public_key,
        encryptedPrivateKey: user.encrypted_private_key,
        privateKeyIv: user.private_key_iv,
        vaultSalt: user.key_vault_salt,
      },
    })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/refresh', async (request, response, next) => {
  try {
    authSecret()
  } catch (error) {
    next(error)
    return
  }
  const refreshToken = request.cookies?.[refreshCookie]
  if (typeof refreshToken !== 'string' || refreshToken.length < 32) {
    response.status(401).json({ error: { code: 'unauthorized', message: 'Session expired.' } })
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const found = await client.query<{
      id: string
      user_id: string
      refresh_family: string
      used_at: Date | null
      revoked_at: Date | null
      expires_at: Date
    }>(
      `SELECT s.id, s.user_id, s.refresh_family, rt.used_at, s.revoked_at, s.expires_at
       FROM session_refresh_tokens rt
       JOIN sessions s ON s.id = rt.session_id
       WHERE rt.token_hash = $1
       FOR UPDATE OF s, rt`,
      [hashToken(refreshToken)],
    )
    const session = found.rows[0]
    if (!session) {
      await client.query('ROLLBACK')
      response.status(401).json({ error: { code: 'unauthorized', message: 'Session expired.' } })
      return
    }
    if (session.used_at) {
      const revoked = await client.query<{ id: string; user_id: string }>(
        `UPDATE sessions SET revoked_at = now()
         WHERE refresh_family = $1 AND revoked_at IS NULL
         RETURNING id, user_id`,
        [session.refresh_family],
      )
      for (const item of revoked.rows) {
        await client.query(
          `INSERT INTO security_events (id, user_id, type, meta)
           VALUES ($1, $2, 'refresh_token_reuse', jsonb_build_object('session_id', $3::uuid))`,
          [uuidv7(), item.user_id, item.id],
        )
      }
      await client.query('COMMIT')
      response.clearCookie(accessCookie, { httpOnly: true, secure: isProduction, sameSite: 'strict', path: '/api' })
      response.clearCookie(refreshCookie, { httpOnly: true, secure: isProduction, sameSite: 'strict', path: '/api/auth' })
      response.status(401).json({ error: { code: 'unauthorized', message: 'Session revoked after token reuse.' } })
      return
    }
    if (session.revoked_at || session.expires_at.getTime() <= Date.now()) {
      await client.query('ROLLBACK')
      response.status(401).json({ error: { code: 'unauthorized', message: 'Session expired.' } })
      return
    }

    const nextRefreshToken = randomBytes(32).toString('base64url')
    const nextTokenHash = hashToken(nextRefreshToken)
    await client.query(
      `UPDATE session_refresh_tokens SET used_at = now() WHERE token_hash = $1`,
      [hashToken(refreshToken)],
    )
    await client.query(
      `INSERT INTO session_refresh_tokens (token_hash, session_id) VALUES ($1, $2)`,
      [nextTokenHash, session.id],
    )
    await client.query(
      `UPDATE sessions SET token_hash = $1, last_active_at = now() WHERE id = $2`,
      [nextTokenHash, session.id],
    )
    await client.query('COMMIT')
    setAuthCookies(response, createAccessToken(session.user_id, session.id), nextRefreshToken)
    response.status(204).end()
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})

authRouter.get('/me', requireAuth, async (request: AuthenticatedRequest, response, next) => {
  try {
    const result = await pool.query<{
      id: string
      email: string
      username: string
      display_name: string
      avatar_url: string | null
      about: string
    }>(
      `SELECT id, email, username, display_name, avatar_url, about
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [request.auth!.userId],
    )
    const user = result.rows[0]
    if (!user) {
      response.status(401).json({ error: { code: 'unauthorized', message: 'Account unavailable.' } })
      return
    }
    response.json({ user })
  } catch (error) {
    next(error)
  }
})

authRouter.get('/key-bundle', requireAuth, async (request: AuthenticatedRequest, response, next) => {
  try {
    const result = await pool.query(
      `SELECT encryption_public_key AS "publicKey",
              encrypted_private_key AS "encryptedPrivateKey",
              private_key_iv AS "privateKeyIv",
              key_vault_salt AS "vaultSalt"
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [request.auth!.userId],
    )
    response.json({ keyBundle: result.rows[0]?.publicKey ? result.rows[0] : null })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/encryption/initialize', requireAuth, async (request: AuthenticatedRequest, response, next) => {
  const parsed = initializeKeysSchema.safeParse(request.body)
  if (!parsed.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Valid password and encrypted key material are required.' } })
    return
  }
  try {
    const account = await pool.query<{ password_hash: string }>(
      `SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [request.auth!.userId],
    )
    if (!account.rows[0] || !(await bcrypt.compare(parsed.data.password, account.rows[0].password_hash))) {
      response.status(401).json({ error: { code: 'unauthorized', message: 'Email or password is incorrect.' } })
      return
    }
    const initialized = await pool.query(
      `WITH key_owner AS (
         UPDATE users
         SET encryption_public_key = $1::jsonb, encrypted_private_key = $2,
             private_key_iv = $3, key_vault_salt = $4, encryption_key_version = 1
         WHERE id = $5 AND encryption_public_key IS NULL
         RETURNING id
       )
       INSERT INTO security_events (id, user_id, type)
       SELECT $6, id, 'encryption_keys_initialized' FROM key_owner
       RETURNING user_id`,
      [
        JSON.stringify(parsed.data.keyBundle.publicKey),
        parsed.data.keyBundle.encryptedPrivateKey,
        parsed.data.keyBundle.privateKeyIv,
        parsed.data.keyBundle.vaultSalt,
        request.auth!.userId,
        uuidv7(),
      ],
    )
    if (initialized.rowCount === 0) {
      response.status(409).json({ error: { code: 'conflict', message: 'Encryption keys are already configured for this account.' } })
      return
    }
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

authRouter.patch('/me', requireAuth, async (request: AuthenticatedRequest, response, next) => {
  const parsed = profileSchema.safeParse(request.body)
  if (!parsed.success) {
    response.status(400).json({
      error: { code: 'validation', message: 'Check your username, display name, and about text.' },
    })
    return
  }

  try {
    const result = await pool.query(
      `UPDATE users
       SET username = $1, display_name = $2, about = $3
       WHERE id = $4 AND deleted_at IS NULL
       RETURNING id, email, username, display_name, avatar_url, about`,
      [parsed.data.username, parsed.data.displayName, parsed.data.about, request.auth!.userId],
    )
    response.json({ user: result.rows[0] })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      response.status(409).json({ error: { code: 'conflict', message: 'That username is already in use.' } })
      return
    }
    next(error)
  }
})

authRouter.get('/sessions', requireAuth, async (request: AuthenticatedRequest, response, next) => {
  try {
    const result = await pool.query(
      `SELECT s.id, d.name AS device_name, d.platform, s.user_agent, s.ip_region,
              s.created_at, s.last_active_at, s.expires_at
       FROM sessions s
       LEFT JOIN devices d ON d.id = s.device_id
       WHERE s.user_id = $1 AND s.revoked_at IS NULL AND s.expires_at > now()
       ORDER BY s.last_active_at DESC`,
      [request.auth!.userId],
    )
    response.json({ sessions: result.rows, currentSessionId: request.auth!.sessionId })
  } catch (error) {
    next(error)
  }
})

authRouter.post('/sessions/:id/revoke', requireAuth, async (request: AuthenticatedRequest, response, next) => {
  try {
    const result = await pool.query<{ id: string }>(
      `WITH revoked AS (
         UPDATE sessions SET revoked_at = now()
         WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
         RETURNING id, user_id
       )
       INSERT INTO security_events (id, user_id, type, meta)
       SELECT $3, user_id, 'session_revoked', jsonb_build_object('session_id', id)
       FROM revoked
       RETURNING meta ->> 'session_id' AS id`,
      [request.params.id, request.auth!.userId, uuidv7()],
    )
    if (result.rowCount === 0) {
      response.status(404).json({ error: { code: 'not_found', message: 'Session not found.' } })
      return
    }
    if (request.params.id === request.auth!.sessionId) {
      response.clearCookie(accessCookie, { httpOnly: true, secure: isProduction, sameSite: 'strict', path: '/api' })
      response.clearCookie(refreshCookie, { httpOnly: true, secure: isProduction, sameSite: 'strict', path: '/api/auth' })
    }
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

authRouter.post('/sign-out', requireAuth, async (request: AuthenticatedRequest, response, next) => {
  try {
    await pool.query(
      `WITH revoked AS (
         UPDATE sessions SET revoked_at = now()
         WHERE id = $1 AND revoked_at IS NULL
         RETURNING id, user_id
       )
       INSERT INTO security_events (id, user_id, type, meta)
       SELECT $2, user_id, 'logout', jsonb_build_object('session_id', id)
       FROM revoked`,
      [request.auth!.sessionId, uuidv7()],
    )
    response.clearCookie(accessCookie, { httpOnly: true, secure: isProduction, sameSite: 'strict', path: '/api' })
    response.clearCookie(refreshCookie, { httpOnly: true, secure: isProduction, sameSite: 'strict', path: '/api/auth' })
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})
