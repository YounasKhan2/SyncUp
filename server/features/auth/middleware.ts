import type { NextFunction, Response } from 'express'
import { pool } from '../../db.js'
import { accessCookie, readAccessToken } from './session.js'
import type { AuthenticatedRequest } from './types.js'

export type { AuthenticatedRequest } from './types.js'

export async function requireAuth(
  request: AuthenticatedRequest,
  response: Response,
  next: NextFunction,
) {
  let claims: ReturnType<typeof readAccessToken>
  try {
    claims = readAccessToken(request.cookies?.[accessCookie])
  } catch (error) {
    next(error)
    return
  }
  if (!claims) {
    response.status(401).json({ error: { code: 'unauthorized', message: 'Sign in required.' } })
    return
  }

  try {
    const result = await pool.query<{ user_id: string; id: string }>(
      `UPDATE sessions
       SET last_active_at = now()
       WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL AND expires_at > now()
       RETURNING user_id, id`,
      [claims.sessionId, claims.userId],
    )
    const session = result.rows[0]
    if (!session) {
      response.status(401).json({ error: { code: 'unauthorized', message: 'Session expired.' } })
      return
    }
    request.auth = { userId: session.user_id, sessionId: session.id }
    next()
  } catch (error) {
    next(error)
  }
}
