import { AccessToken } from 'livekit-server-sdk'
import { rateLimit } from 'express-rate-limit'
import { Router } from 'express'
import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'
import { requireAuth, type AuthenticatedRequest } from '../auth/middleware.js'
import { pool } from '../../db.js'
import { closeLiveKitRoom, removeGroupCallParticipant } from './groupCallService.js'

const limiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => (request as AuthenticatedRequest).auth!.userId,
  message: { error: { code: 'rate_limited', message: 'Too many group-call requests. Try again shortly.' } },
})

const wrappedKeySchema = z.string().min(500).max(600).regex(/^[A-Za-z0-9_-]+$/u)
const startSchema = z.object({
  chatId: z.uuid(),
  callType: z.enum(['audio', 'video']),
  keyEnvelopes: z.record(z.uuid(), wrappedKeySchema),
})

export const groupCallsRouter = Router()
groupCallsRouter.use(requireAuth)

function liveKitSettings() {
  const url = process.env.LIVEKIT_URL
  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  if (!url || !apiKey || !apiSecret) return null
  return { url, apiKey, apiSecret }
}

groupCallsRouter.post('/group-calls', limiter, async (request: AuthenticatedRequest, response, next) => {
  const input = startSchema.safeParse(request.body)
  if (!input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Choose a group and call type, and include encrypted key envelopes for every current member.' } })
    return
  }
  if (!liveKitSettings()) {
    response.status(503).json({ error: { code: 'service_unavailable', message: 'Calls are not configured on this server.' } })
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const group = await client.query<{ kind: string }>(
      `SELECT c.kind
       FROM chats c
       JOIN chat_members me ON me.chat_id = c.id AND me.user_id = $2 AND me.left_at IS NULL
       WHERE c.id = $1
       FOR UPDATE OF c`,
      [input.data.chatId, request.auth!.userId],
    )
    if (group.rows[0]?.kind !== 'group') {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Group not found.' } })
      return
    }

    const members = await client.query<{ user_id: string; public_key: unknown }>(
      `SELECT cm.user_id, u.encryption_public_key AS public_key
       FROM chat_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.chat_id = $1 AND cm.left_at IS NULL
       ORDER BY cm.user_id`,
      [input.data.chatId],
    )
    const memberIds = members.rows.map((member) => member.user_id)
    const envelopeIds = Object.keys(input.data.keyEnvelopes)
    if (memberIds.length < 2 || memberIds.length > 32
      || members.rows.some((member) => member.public_key === null)
      || memberIds.length !== envelopeIds.length
      || memberIds.some((id) => !Object.hasOwn(input.data.keyEnvelopes, id))) {
      await client.query('ROLLBACK')
      response.status(409).json({ error: { code: 'conflict', message: 'Group membership changed or a member is missing an encryption key. Refresh the group and try again.' } })
      return
    }

    await client.query(
      `UPDATE group_call_participants p SET status = 'missed', left_at = now()
       FROM group_calls c
       WHERE c.id = p.call_id AND c.chat_id = $1 AND c.status = 'active'
         AND p.status = 'ringing' AND p.invited_at <= now() - interval '60 seconds'`,
      [input.data.chatId],
    )
    const active = await client.query(
      `SELECT 1 FROM group_calls WHERE chat_id = $1 AND status = 'active'`,
      [input.data.chatId],
    )
    if (active.rowCount) {
      await client.query('ROLLBACK')
      response.status(409).json({ error: { code: 'conflict', message: 'A group call is already active in this chat.' } })
      return
    }

    const callId = uuidv7()
    const room = `syncup-group-call-${callId}`
    await client.query(
      `INSERT INTO group_calls (id, chat_id, started_by, sfu_room, call_type, status)
       VALUES ($1, $2, $3, $4, $5, 'active')`,
      [callId, input.data.chatId, request.auth!.userId, room, input.data.callType],
    )
    for (const memberId of memberIds) {
      await client.query(
        `INSERT INTO group_call_participants (call_id, user_id, status, key_envelope, joined_at)
         VALUES ($1, $2, $3, $4, CASE WHEN $3 = 'joined' THEN now() ELSE NULL END)`,
        [callId, memberId, memberId === request.auth!.userId ? 'joined' : 'ringing', input.data.keyEnvelopes[memberId]],
      )
    }
    await client.query('COMMIT')
    response.status(201).json({ call: { id: callId, chat_id: input.data.chatId, call_type: input.data.callType, status: 'active', is_group: true } })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})

groupCallsRouter.get('/group-calls/incoming', async (request: AuthenticatedRequest, response, next) => {
  try {
    await pool.query(
      `UPDATE group_call_participants p SET status = 'missed', left_at = now()
       FROM group_calls c
       WHERE c.id = p.call_id AND p.user_id = $1 AND c.status = 'active'
         AND p.status = 'ringing' AND p.invited_at <= now() - interval '60 seconds'`,
      [request.auth!.userId],
    )
    const result = await pool.query(
      `SELECT c.id, c.chat_id, c.call_type, c.created_at, c.started_by AS caller_id,
              g.title AS group_title, caller.display_name AS caller_name,
              caller.avatar_url AS caller_avatar_url,
              caller.username AS caller_username, true AS is_group
       FROM group_call_participants p
       JOIN group_calls c ON c.id = p.call_id
       JOIN chats g ON g.id = c.chat_id
       JOIN users caller ON caller.id = c.started_by
       JOIN chat_members cm ON cm.chat_id = c.chat_id AND cm.user_id = p.user_id AND cm.left_at IS NULL
       WHERE p.user_id = $1 AND p.status = 'ringing' AND c.status = 'active'
         AND p.invited_at > now() - interval '60 seconds'
       ORDER BY c.created_at DESC`,
      [request.auth!.userId],
    )
    response.json({ calls: result.rows })
  } catch (error) {
    next(error)
  }
})

groupCallsRouter.get('/group-calls', async (request: AuthenticatedRequest, response, next) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.chat_id, c.call_type, c.status, c.end_reason,
              c.started_by AS caller_id, c.started_by AS callee_id, c.created_at,
              (SELECT min(p.joined_at) FROM group_call_participants p
               WHERE p.call_id = c.id AND p.user_id <> c.started_by AND p.joined_at IS NOT NULL) AS accepted_at,
              c.ended_at, caller.display_name AS caller_name, g.title AS group_title,
              g.title AS other_name,
              (SELECT count(*)::int FROM group_call_participants p
               WHERE p.call_id = c.id AND p.status = 'joined') AS participant_count,
              true AS is_group
       FROM group_calls c
       JOIN chats g ON g.id = c.chat_id
       JOIN users caller ON caller.id = c.started_by
       JOIN group_call_participants mine ON mine.call_id = c.id AND mine.user_id = $1
       JOIN chat_members cm ON cm.chat_id = c.chat_id AND cm.user_id = $1 AND cm.left_at IS NULL
       WHERE c.status = 'ended'
       ORDER BY c.created_at DESC LIMIT 100`,
      [request.auth!.userId],
    )
    response.json({ calls: result.rows })
  } catch (error) {
    next(error)
  }
})

groupCallsRouter.get('/chats/:id/group-calls', async (request: AuthenticatedRequest, response, next) => {
  const chatId = z.uuid().safeParse(request.params.id)
  if (!chatId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid chat id.' } })
    return
  }
  try {
    const result = await pool.query(
      `SELECT c.id, c.chat_id, c.call_type, c.status, c.end_reason,
              c.started_by AS caller_id, c.started_by AS callee_id, c.created_at,
              (SELECT min(p.joined_at) FROM group_call_participants p
               WHERE p.call_id = c.id AND p.user_id <> c.started_by AND p.joined_at IS NOT NULL) AS accepted_at,
              c.ended_at, caller.display_name AS caller_name, g.title AS group_title,
              g.title AS callee_name,
              (SELECT count(*)::int FROM group_call_participants p
               WHERE p.call_id = c.id AND p.status = 'joined') AS participant_count,
              true AS is_group
       FROM group_calls c
       JOIN chats g ON g.id = c.chat_id
       JOIN users caller ON caller.id = c.started_by
       JOIN chat_members cm ON cm.chat_id = c.chat_id AND cm.user_id = $2 AND cm.left_at IS NULL
       WHERE c.chat_id = $1 AND c.status = 'ended'
       ORDER BY c.created_at DESC LIMIT 50`,
      [chatId.data, request.auth!.userId],
    )
    response.json({ calls: result.rows })
  } catch (error) {
    next(error)
  }
})

groupCallsRouter.post('/group-calls/:id/answer', limiter, async (request: AuthenticatedRequest, response, next) => {
  const callId = z.uuid().safeParse(request.params.id)
  if (!callId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid group call id.' } })
    return
  }
  try {
    const result = await pool.query(
      `UPDATE group_call_participants p SET status = 'joined', joined_at = COALESCE(p.joined_at, now()), left_at = NULL
       FROM group_calls c
       WHERE c.id = p.call_id AND c.id = $1 AND p.user_id = $2
         AND c.status = 'active' AND p.status = 'ringing'
         AND p.invited_at > now() - interval '60 seconds'
         AND EXISTS (
           SELECT 1 FROM chat_members cm
           WHERE cm.chat_id = c.chat_id AND cm.user_id = $2 AND cm.left_at IS NULL
         )
       RETURNING c.id, c.chat_id, c.call_type, c.status, p.key_envelope`,
      [callId.data, request.auth!.userId],
    )
    if (!result.rows[0]) {
      response.status(404).json({ error: { code: 'not_found', message: 'Incoming group call not found or has expired.' } })
      return
    }
    response.json({ call: { ...result.rows[0], is_group: true } })
  } catch (error) {
    next(error)
  }
})

groupCallsRouter.post('/group-calls/:id/decline', limiter, async (request: AuthenticatedRequest, response, next) => {
  const callId = z.uuid().safeParse(request.params.id)
  if (!callId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid group call id.' } })
    return
  }
  try {
    const result = await pool.query(
      `UPDATE group_call_participants p SET status = 'declined', left_at = now()
       FROM group_calls c
       WHERE c.id = p.call_id AND c.id = $1 AND p.user_id = $2
         AND c.status = 'active' AND p.status = 'ringing'
         AND EXISTS (
           SELECT 1 FROM chat_members cm
           WHERE cm.chat_id = c.chat_id AND cm.user_id = $2 AND cm.left_at IS NULL
         )
       RETURNING p.user_id`,
      [callId.data, request.auth!.userId],
    )
    if (!result.rows[0]) {
      response.status(404).json({ error: { code: 'not_found', message: 'Incoming group call not found.' } })
      return
    }
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

groupCallsRouter.get('/group-calls/:id/status', async (request: AuthenticatedRequest, response, next) => {
  const callId = z.uuid().safeParse(request.params.id)
  if (!callId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid group call id.' } })
    return
  }
  try {
    await pool.query(
      `UPDATE group_call_participants p SET status = 'missed', left_at = now()
       FROM group_calls c
       WHERE c.id = p.call_id AND c.id = $1 AND c.status = 'active'
         AND p.status = 'ringing' AND p.invited_at <= now() - interval '60 seconds'`,
      [callId.data],
    )
    const call = await pool.query(
      `SELECT c.status, c.started_by, mine.status AS my_status
       FROM group_calls c
       JOIN group_call_participants mine ON mine.call_id = c.id AND mine.user_id = $2
       JOIN chat_members cm ON cm.chat_id = c.chat_id AND cm.user_id = $2 AND cm.left_at IS NULL
       WHERE c.id = $1`,
      [callId.data, request.auth!.userId],
    )
    if (!call.rows[0]) {
      response.status(404).json({ error: { code: 'not_found', message: 'Group call not found.' } })
      return
    }
    const participants = await pool.query(
      `SELECT p.user_id, u.display_name, p.status
       FROM group_call_participants p JOIN users u ON u.id = p.user_id
       WHERE p.call_id = $1 ORDER BY p.invited_at, p.user_id`,
      [callId.data],
    )
    response.json({ ...call.rows[0], participants: participants.rows })
  } catch (error) {
    next(error)
  }
})

groupCallsRouter.post('/group-calls/:id/token', limiter, async (request: AuthenticatedRequest, response, next) => {
  const callId = z.uuid().safeParse(request.params.id)
  if (!callId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid group call id.' } })
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
       FROM group_calls c
       JOIN group_call_participants p ON p.call_id = c.id AND p.user_id = $2 AND p.status = 'joined'
       JOIN users u ON u.id = $2
       JOIN chat_members cm ON cm.chat_id = c.chat_id AND cm.user_id = $2 AND cm.left_at IS NULL
       WHERE c.id = $1 AND c.status = 'active'`,
      [callId.data, request.auth!.userId],
    )
    if (!result.rows[0]) {
      response.status(404).json({ error: { code: 'not_found', message: 'Active group call participation not found.' } })
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

groupCallsRouter.post('/group-calls/:id/leave', limiter, async (request: AuthenticatedRequest, response, next) => {
  const callId = z.uuid().safeParse(request.params.id)
  if (!callId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid group call id.' } })
    return
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const call = await client.query<{ sfu_room: string; call_status: string; participant_status: string }>(
      `SELECT c.sfu_room, c.status AS call_status, p.status AS participant_status FROM group_calls c
       JOIN group_call_participants p ON p.call_id = c.id AND p.user_id = $2
       JOIN chat_members cm ON cm.chat_id = c.chat_id AND cm.user_id = $2 AND cm.left_at IS NULL
       WHERE c.id = $1
       FOR UPDATE OF c, p`,
      [callId.data, request.auth!.userId],
    )
    if (!call.rows[0]) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Active group-call participation not found.' } })
      return
    }
    if (call.rows[0].call_status !== 'active' || call.rows[0].participant_status !== 'joined') {
      await client.query('COMMIT')
      response.status(204).end()
      return
    }
    await removeGroupCallParticipant(call.rows[0].sfu_room, request.auth!.userId)
    await client.query(
      `UPDATE group_call_participants SET status = 'left', left_at = now()
       WHERE call_id = $1 AND user_id = $2 AND status = 'joined'`,
      [callId.data, request.auth!.userId],
    )
    const remaining = await client.query(
      `SELECT 1 FROM group_call_participants WHERE call_id = $1 AND status = 'joined'`,
      [callId.data],
    )
    if (remaining.rowCount === 0) {
      await closeLiveKitRoom(call.rows[0].sfu_room)
      await client.query(
        `UPDATE group_calls SET status = 'ended', end_reason = 'completed', ended_at = now()
         WHERE id = $1 AND status = 'active'`,
        [callId.data],
      )
      await client.query(
        `UPDATE group_call_participants SET status = 'missed', left_at = now()
         WHERE call_id = $1 AND status = 'ringing'`,
        [callId.data],
      )
    }
    await client.query('COMMIT')
    response.status(204).end()
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})

groupCallsRouter.post('/group-calls/:id/end', limiter, async (request: AuthenticatedRequest, response, next) => {
  const callId = z.uuid().safeParse(request.params.id)
  if (!callId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid group call id.' } })
    return
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const call = await client.query<{ sfu_room: string; call_status: string; participant_status: string }>(
      `SELECT c.sfu_room, c.status AS call_status, p.status AS participant_status FROM group_calls c
       JOIN group_call_participants p ON p.call_id = c.id AND p.user_id = $2
       JOIN chat_members cm ON cm.chat_id = c.chat_id AND cm.user_id = $2 AND cm.left_at IS NULL
       WHERE c.id = $1 AND c.started_by = $2
       FOR UPDATE OF c`,
      [callId.data, request.auth!.userId],
    )
    if (!call.rows[0]) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Active group call not found.' } })
      return
    }
    if (call.rows[0].call_status !== 'active') {
      await client.query('COMMIT')
      response.status(204).end()
      return
    }
    if (call.rows[0].participant_status !== 'joined') {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Active group call not found.' } })
      return
    }
    await closeLiveKitRoom(call.rows[0].sfu_room)
    await client.query(
      `UPDATE group_calls SET status = 'ended', end_reason = 'completed', ended_at = now()
       WHERE id = $1 AND status = 'active'`,
      [callId.data],
    )
    await client.query(
      `UPDATE group_call_participants SET status = 'missed', left_at = now()
       WHERE call_id = $1 AND status = 'ringing'`,
      [callId.data],
    )
    await client.query('COMMIT')
    response.status(204).end()
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})
