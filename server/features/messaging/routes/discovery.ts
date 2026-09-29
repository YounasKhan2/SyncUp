import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../../../db.js'
import type { AuthenticatedRequest } from '../../auth/types.js'
import { searchLimiter } from '../limits.js'

export const discoveryRoutes = Router()

discoveryRoutes.get('/users', searchLimiter, async (request: AuthenticatedRequest, response, next) => {
  const username = z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/)
    .safeParse(request.query.username)
  if (!username.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Enter at least 3 letters or numbers to search usernames.' } })
    return
  }
  try {
    const result = await pool.query(
      `SELECT id, username, display_name, avatar_url, encryption_public_key AS "publicKey"
       FROM users
       WHERE left(username, length(lower($1))) = lower($1)
         AND id <> $2 AND discoverable = true AND deleted_at IS NULL
         AND encryption_public_key IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM contacts blocked
           WHERE blocked.state = 'blocked'
             AND ((blocked.user_id = users.id AND blocked.contact_id = $2)
               OR (blocked.user_id = $2 AND blocked.contact_id = users.id))
         )`,
      [username.data, request.auth!.userId],
    )
    response.json({ users: result.rows })
  } catch (error) {
    next(error)
  }
})

discoveryRoutes.get('/contacts', async (request: AuthenticatedRequest, response, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.encryption_public_key AS "publicKey"
       FROM contacts c
       JOIN contacts reciprocal ON reciprocal.user_id = c.contact_id
         AND reciprocal.contact_id = c.user_id AND reciprocal.state = 'accepted'
       JOIN users u ON u.id = c.contact_id AND u.deleted_at IS NULL
       WHERE c.user_id = $1 AND c.state = 'accepted'
         AND NOT EXISTS (
           SELECT 1 FROM contacts blocked
           WHERE blocked.state = 'blocked'
             AND ((blocked.user_id = c.user_id AND blocked.contact_id = c.contact_id)
               OR (blocked.user_id = c.contact_id AND blocked.contact_id = c.user_id))
         )
       ORDER BY lower(u.display_name), u.id`,
      [request.auth!.userId],
    )
    response.json({ contacts: result.rows })
  } catch (error) {
    next(error)
  }
})
