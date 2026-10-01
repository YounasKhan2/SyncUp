import { AccessToken } from 'livekit-server-sdk'
import { Router } from 'express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'
import { requireAuth, type AuthenticatedRequest } from '../auth/middleware.js'
import { pool } from '../../db.js'

const limiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => (request as AuthenticatedRequest).auth?.userId ?? ipKeyGenerator(request.ip ?? ''),
  message: { error: { code: 'rate_limited', message: 'Too many call requests. Try again shortly.' } },
})

export const callsRouter = Router()
callsRouter.use(requireAuth)

function liveKitSettings() {
  const url = process.env.LIVEKIT_URL
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!url || !apiKey || !apiSecret) return null
  return { url, apiKey, apiSecret }
}

callsRouter.post('/calls', limiter, async (request: AuthenticatedRequest, response, next) => {
  const input = z.object({
    chatId: z.uuid(),
    callType: z.enum(['audio', 'video']),
  }).safeParse(request.body)
  if (!input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Choose a direct chat and call type.' } })
    return
  }
  if (!liveKitSettings()) {
    response.status(503).json({ error: { code: 'service_unavailable', message: 'Calls are not configured on this server.' } })
    return
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const participants = await client.query<{ callee_id: string }>(
      `SELECT other.user_id AS callee_id
       FROM chats c
       JOIN chat_members caller ON caller.chat_id = c.id AND caller.user_id = $2 AND caller.left_at IS NULL
       JOIN chat_members other ON other.chat_id = c.id AND other.user_id <> $2 AND other.left_at IS NULL
       WHERE c.id = $1 AND c.kind = 'direct'
         AND NOT EXISTS (
           SELECT 1 FROM message_requests mr WHERE mr.chat_id = c.id
             AND mr.to_user = $2 AND mr.state IN ('pending', 'ignored')
         )
         AND NOT EXISTS (
           SELECT 1 FROM contacts blocked
           WHERE blocked.user_id = $2 AND blocked.contact_id = other.user_id AND blocked.state = 'blocked'
         )
         AND NOT EXISTS (
           SELECT 1 FROM contacts blocked
           WHERE blocked.user_id = other.user_id AND blocked.contact_id = $2 AND blocked.state = 'blocked'
         )
       FOR UPDATE OF c`,
      [input.data.chatId, request.auth!.userId],
    )
    if (!participants.rows[0]) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Direct chat not found.' } })
      return
    }

    await client.query(
      `UPDATE calls SET status = 'missed', end_reason = 'missed', ended_at = now()
       WHERE chat_id = $1 AND status = 'ringing' AND created_at <= now() - interval '60 seconds'`,
      [input.data.chatId],
    )
    const activeCall = await client.query(
      `SELECT 1 FROM calls
       WHERE chat_id = $1 AND status IN ('ringing', 'active')`,
      [input.data.chatId],
    )
    if (activeCall.rowCount) {
      await client.query('ROLLBACK')
      response.status(409).json({ error: { code: 'conflict', message: 'A call is already active in this chat.' } })
      return
    }

    const callId = uuidv7()
    const room = `syncup-call-${callId}`
    const inserted = await client.query(
      `INSERT INTO calls (id, chat_id, caller_id, callee_id, sfu_room, call_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'ringing')
       RETURNING id, chat_id, caller_id, callee_id, call_type, status, created_at`,
      [callId, input.data.chatId, request.auth!.userId, participants.rows[0].callee_id, room, input.data.callType],
    )
    await client.query('COMMIT')
    response.status(201).json({ call: inserted.rows[0] })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})

callsRouter.get('/calls/incoming', async (request: AuthenticatedRequest, response, next) => {
  try {
    await pool.query(
      `UPDATE calls SET status = 'missed', end_reason = 'missed', ended_at = now()
       WHERE callee_id = $1 AND status = 'ringing' AND created_at <= now() - interval '60 seconds'`,
      [request.auth!.userId],
    )
    const result = await pool.query(
      `SELECT c.id, c.chat_id, c.call_type, c.created_at, caller.display_name AS caller_name,
              caller.username AS caller_username, caller.avatar_url AS caller_avatar_url
       FROM calls c
       JOIN users caller ON caller.id = c.caller_id
       JOIN chat_members cm ON cm.chat_id = c.chat_id AND cm.user_id = c.callee_id AND cm.left_at IS NULL
       WHERE c.callee_id = $1 AND c.status = 'ringing'
         AND c.created_at > now() - interval '60 seconds'
       ORDER BY c.created_at DESC`,
      [request.auth!.userId],
    )
    response.json({ calls: result.rows })
  } catch (error) {
    next(error)
  }
})

callsRouter.get('/calls', async (request: AuthenticatedRequest, response, next) => {
  try {
    await pool.query(
      `UPDATE calls SET status = 'missed', end_reason = 'missed', ended_at = now()
       WHERE callee_id = $1 AND status = 'ringing' AND created_at <= now() - interval '60 seconds'`,
      [request.auth!.userId],
    )
    const result = await pool.query(
      `SELECT c.id, c.chat_id, c.call_type, c.status, c.end_reason,
              c.caller_id, c.callee_id, c.created_at, c.accepted_at, c.ended_at,
              other.display_name AS other_name, other.username AS other_username,
              other.avatar_url AS other_avatar_url
       FROM calls c
       JOIN users other ON other.id = CASE WHEN c.caller_id = $1 THEN c.callee_id ELSE c.caller_id END
       WHERE (c.caller_id = $1 OR c.callee_id = $1)
         AND EXISTS (
           SELECT 1 FROM chat_members cm
           WHERE cm.chat_id = c.chat_id AND cm.user_id = $1 AND cm.left_at IS NULL
         )
       ORDER BY c.created_at DESC
       LIMIT 100`,
      [request.auth!.userId],
    )
    response.json({ calls: result.rows })
  } catch (error) {
    next(error)
  }
})

callsRouter.get('/calls/:id/status', async (request: AuthenticatedRequest, response, next) => {
  const callId = z.uuid().safeParse(request.params.id)
  if (!callId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid call id.' } })
    return
  }
  try {
    const result = await pool.query<{ status: string }>(
      `SELECT c.status FROM calls c
       JOIN chat_members cm ON cm.chat_id = c.chat_id AND cm.user_id = $2 AND cm.left_at IS NULL
       WHERE c.id = $1 AND (c.caller_id = $2 OR c.callee_id = $2)`,
      [callId.data, request.auth!.userId],
    )
    if (!result.rows[0]) {
      response.status(404).json({ error: { code: 'not_found', message: 'Call not found.' } })
      return
    }
    response.json({ status: result.rows[0].status })
  } catch (error) {
    next(error)
  }
})

callsRouter.get('/chats/:id/calls', async (request: AuthenticatedRequest, response, next) => {
  const chatId = z.uuid().safeParse(request.params.id)
  if (!chatId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid chat id.' } })
    return
  }
  try {
    const result = await pool.query(
      `SELECT c.id, c.call_type, c.status, c.end_reason, c.caller_id, c.callee_id,
              c.created_at, c.accepted_at, c.ended_at,
              caller.display_name AS caller_name, callee.display_name AS callee_name
       FROM calls c
       JOIN users caller ON caller.id = c.caller_id
       JOIN users callee ON callee.id = c.callee_id
       JOIN chat_members cm ON cm.chat_id = c.chat_id AND cm.user_id = $2 AND cm.left_at IS NULL
       WHERE c.chat_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM message_requests mr WHERE mr.chat_id = c.chat_id
             AND mr.to_user = $2 AND mr.state IN ('pending', 'ignored')
         )
       ORDER BY c.created_at DESC
       LIMIT 50`,
      [chatId.data, request.auth!.userId],
    )
    response.json({ calls: result.rows })
  } catch (error) {
    next(error)
  }
})

callsRouter.post('/calls/:id/accept', limiter, async (request: AuthenticatedRequest, response, next) => {
  const callId = z.uuid().safeParse(request.params.id)
  if (!callId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid call id.' } })
    return
  }
  try {
    const result = await pool.query(
      `UPDATE calls c SET status = 'active', accepted_at = COALESCE(accepted_at, now())
       WHERE c.id = $1 AND c.callee_id = $2 AND c.status = 'ringing'
         AND c.created_at > now() - interval '60 seconds'
         AND EXISTS (
           SELECT 1 FROM chat_members cm WHERE cm.chat_id = c.chat_id
             AND cm.user_id = $2 AND cm.left_at IS NULL
         )
       RETURNING c.id, c.chat_id, c.call_type, c.status, c.created_at, c.accepted_at`,
      [callId.data, request.auth!.userId],
    )
    if (!result.rows[0]) {
      response.status(404).json({ error: { code: 'not_found', message: 'Incoming call not found.' } })
      return
    }
    response.json({ call: result.rows[0] })
  } catch (error) {
    next(error)
  }
})

callsRouter.post('/calls/:id/decline', limiter, async (request: AuthenticatedRequest, response, next) => {
  const callId = z.uuid().safeParse(request.params.id)
  if (!callId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid call id.' } })
    return
  }
  try {
    const result = await pool.query(
      `UPDATE calls c SET status = 'declined', end_reason = 'declined', ended_at = now()
       WHERE c.id = $1 AND c.callee_id = $2 AND c.status = 'ringing'
         AND EXISTS (
           SELECT 1 FROM chat_members cm WHERE cm.chat_id = c.chat_id
             AND cm.user_id = $2 AND cm.left_at IS NULL
         )
       RETURNING c.id`,
      [callId.data, request.auth!.userId],
    )
    if (!result.rows[0]) {
      response.status(404).json({ error: { code: 'not_found', message: 'Incoming call not found.' } })
      return
    }
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

callsRouter.post('/calls/:id/token', limiter, async (request: AuthenticatedRequest, response, next) => {
  const callId = z.uuid().safeParse(request.params.id)
  if (!callId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid call id.' } })
    return
  }
  const settings = liveKitSettings()
  if (!settings) {
    response.status(503).json({ error: { code: 'service_unavailable', message: 'Calls are not configured on this server.' } })
    return
  }
  try {
    const result = await pool.query<{ sfu_room: string; display_name: string }>(
      `SELECT c.sfu_room, u.display_name
       FROM calls c
       JOIN users u ON u.id = $2
       JOIN chat_members cm ON cm.chat_id = c.chat_id AND cm.user_id = $2 AND cm.left_at IS NULL
       WHERE c.id = $1 AND (c.caller_id = $2 OR c.callee_id = $2)
         AND c.status IN ('ringing', 'active')
         AND NOT EXISTS (
           SELECT 1 FROM message_requests mr WHERE mr.chat_id = c.chat_id
             AND mr.to_user = $2 AND mr.state IN ('pending', 'ignored')
         )`,
      [callId.data, request.auth!.userId],
    )
    if (!result.rows[0]) {
      response.status(404).json({ error: { code: 'not_found', message: 'Call not found.' } })
      return
    }
    const token = new AccessToken(settings.apiKey, settings.apiSecret, {
      identity: request.auth!.userId,
      name: result.rows[0].display_name,
      ttl: '10m',
    })
    token.addGrant({
      roomJoin: true,
      room: result.rows[0].sfu_room,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })
    response.json({ url: settings.url, token: await token.toJwt() })
  } catch (error) {
    next(error)
  }
})

callsRouter.post('/calls/:id/end', limiter, async (request: AuthenticatedRequest, response, next) => {
  const callId = z.uuid().safeParse(request.params.id)
  if (!callId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid call id.' } })
    return
  }
  try {
    const result = await pool.query(
      `UPDATE calls SET status = 'ended', end_reason = CASE WHEN status = 'ringing' THEN 'cancelled' ELSE 'completed' END,
                        ended_at = COALESCE(ended_at, now())
       WHERE id = $1 AND (caller_id = $2 OR callee_id = $2)
         AND status IN ('ringing', 'active')
         AND EXISTS (
           SELECT 1 FROM chat_members cm WHERE cm.chat_id = calls.chat_id
             AND cm.user_id = $2 AND cm.left_at IS NULL
         )
       RETURNING id`,
      [callId.data, request.auth!.userId],
    )
    if (!result.rows[0]) {
      const ended = await pool.query(
        `SELECT 1 FROM calls c
         JOIN chat_members cm ON cm.chat_id = c.chat_id AND cm.user_id = $2 AND cm.left_at IS NULL
         WHERE c.id = $1 AND (c.caller_id = $2 OR c.callee_id = $2)
           AND c.status IN ('declined', 'missed', 'ended')`,
        [callId.data, request.auth!.userId],
      )
      if (ended.rows[0]) {
        response.status(204).end()
        return
      }
      response.status(404).json({ error: { code: 'not_found', message: 'Call not found.' } })
      return
    }
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})
