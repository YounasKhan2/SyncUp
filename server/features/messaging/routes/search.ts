import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../../../db.js'
import type { AuthenticatedRequest } from '../../auth/types.js'
import { searchLimiter } from '../limits.js'

export const searchRoutes = Router()

searchRoutes.get('/search', searchLimiter, async (request: AuthenticatedRequest, response, next) => {
  const input = z.string().trim().min(2).max(80).safeParse(request.query.q)
  if (!input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Search needs at least 2 characters.' } })
    return
  }
  const query = input.data.replace(/[\\%_]/gu, '\\$&')
  try {
    const [users, chats] = await Promise.all([
      pool.query(
        `SELECT id, username, display_name, avatar_url
         FROM users
         WHERE id <> $2 AND deleted_at IS NULL AND discoverable = true
           AND encryption_public_key IS NOT NULL
           AND (username ILIKE $1 ESCAPE '\\' OR display_name ILIKE $1 ESCAPE '\\')
           AND NOT EXISTS (
             SELECT 1 FROM contacts blocked
             WHERE blocked.state = 'blocked'
               AND ((blocked.user_id = users.id AND blocked.contact_id = $2)
                 OR (blocked.user_id = $2 AND blocked.contact_id = users.id))
           )
         ORDER BY CASE WHEN username ILIKE $3 THEN 0 ELSE 1 END, lower(username)
         LIMIT 20`,
        [`%${query}%`, request.auth!.userId, query],
      ),
      pool.query(
        `SELECT c.id, c.kind, c.title,
                CASE WHEN c.kind = 'direct' THEN peer.display_name ELSE c.title END AS display_title,
                CASE WHEN c.kind = 'direct' THEN peer.username ELSE NULL END AS peer_username,
                CASE WHEN c.kind = 'direct' THEN peer.avatar_url ELSE NULL END AS peer_avatar_url
         FROM chat_members me
         JOIN chats c ON c.id = me.chat_id
         LEFT JOIN users peer ON c.kind = 'direct'
           AND peer.id = CASE WHEN c.direct_user_low = $2 THEN c.direct_user_high ELSE c.direct_user_low END
         WHERE me.user_id = $2 AND me.left_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM message_requests mr WHERE mr.chat_id = c.id
               AND mr.to_user = $2 AND mr.state IN ('pending', 'ignored')
           )
           AND (c.kind = 'group' AND c.title ILIKE $1 ESCAPE '\\'
             OR c.kind = 'direct' AND (peer.display_name ILIKE $1 ESCAPE '\\' OR peer.username ILIKE $1 ESCAPE '\\'))
         ORDER BY lower(COALESCE(c.title, peer.display_name))
         LIMIT 20`,
        [`%${query}%`, request.auth!.userId],
      ),
    ])
    response.json({
      people: users.rows,
      chats: chats.rows,
      privacy: 'Encrypted message content is searched only on this device, never on the server.',
    })
  } catch (error) {
    next(error)
  }
})
