import { Router } from 'express'
import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'
import { pool } from '../../../db.js'
import type { AuthenticatedRequest } from '../../auth/types.js'
import { requestLimiter } from '../limits.js'
import { encryptedMessageSchema, matchingEnvelopes } from '../validation.js'
import type { MemberKey } from '../validation.js'

export const requestRoutes = Router()

requestRoutes.post('/requests', requestLimiter, async (request: AuthenticatedRequest, response, next) => {
  const input = z.object({
    username: z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
    message: encryptedMessageSchema,
  }).safeParse(request.body)
  if (!input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'A valid username and encrypted message are required.' } })
    return
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const target = await client.query<MemberKey>(
      `SELECT id AS user_id, encryption_public_key FROM users
       WHERE username = lower($1) AND id <> $2 AND discoverable = true AND deleted_at IS NULL`,
      [input.data.username, request.auth!.userId],
    )
    const peer = target.rows[0]
    if (!peer || !peer.encryption_public_key) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'User not found.' } })
      return
    }
    const blocked = await client.query(
      `SELECT 1 FROM contacts WHERE state = 'blocked'
       AND ((user_id = $1 AND contact_id = $2) OR (user_id = $2 AND contact_id = $1))`,
      [request.auth!.userId, peer.user_id],
    )
    if (blocked.rowCount) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'User not found.' } })
      return
    }
    const contact = await client.query(
      `SELECT 1 FROM contacts a JOIN contacts b
       ON b.user_id = a.contact_id AND b.contact_id = a.user_id
       WHERE a.user_id = $1 AND a.contact_id = $2 AND a.state = 'accepted' AND b.state = 'accepted'`,
      [request.auth!.userId, peer.user_id],
    )
    if (contact.rowCount) {
      await client.query('ROLLBACK')
      response.status(409).json({ error: { code: 'conflict', message: 'This person is already a contact; open a direct chat.' } })
      return
    }
    const requestExists = await client.query<{ id: string; chat_id: string }>(
      `SELECT id, chat_id FROM message_requests
       WHERE from_user = $1 AND to_user = $2 AND state = 'pending'`,
      [request.auth!.userId, peer.user_id],
    )
    let chatId = requestExists.rows[0]?.chat_id
    let requestId = requestExists.rows[0]?.id
    if (chatId) {
      await client.query('ROLLBACK')
      response.status(409).json({ error: { code: 'conflict', message: 'A message request is already pending.' } })
      return
    }
    const members: MemberKey[] = [
      { user_id: request.auth!.userId, encryption_public_key: null },
      peer,
    ]
    const senderKey = await client.query<{ encryption_public_key: JsonWebKey | null }>(
      `SELECT encryption_public_key FROM users WHERE id = $1`,
      [request.auth!.userId],
    )
    members[0].encryption_public_key = senderKey.rows[0]?.encryption_public_key ?? null
    if (!matchingEnvelopes(input.data.message.keyEnvelopes, members)) {
      await client.query('ROLLBACK')
      response.status(400).json({ error: { code: 'validation', message: 'Encrypt the message for both conversation participants.' } })
      return
    }
    chatId = uuidv7()
    requestId = uuidv7()
    const messageId = uuidv7()
    const senderId = request.auth!.userId
    const timestamp = new Date()
    await client.query(
      `INSERT INTO chats (id, kind, created_by, direct_user_low, direct_user_high, last_seq, last_message_at)
       VALUES ($1, 'direct', $2, LEAST($2::uuid, $3::uuid), GREATEST($2::uuid, $3::uuid), 1, $4)`,
      [chatId, senderId, peer.user_id, timestamp],
    )
    await client.query(
      `INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, 'member'), ($1, $3, 'member')`,
      [chatId, senderId, peer.user_id],
    )
    await client.query(
      `INSERT INTO messages (id, chat_id, server_seq, sender_id, idempotency_key,
                             body_ciphertext, body_nonce, key_envelopes)
       VALUES ($1, $2, 1, $3, $4, $5, $6, $7::jsonb)`,
      [
        messageId, chatId, senderId, input.data.message.idempotencyKey,
        input.data.message.bodyCiphertext, input.data.message.bodyNonce,
        JSON.stringify(input.data.message.keyEnvelopes),
      ],
    )
    await client.query(
      `INSERT INTO message_requests (id, chat_id, from_user, to_user)
       VALUES ($1, $2, $3, $4)`,
      [requestId, chatId, senderId, peer.user_id],
    )
    await client.query('COMMIT')
    response.status(201).json({ requestId, chatId, messageId, serverSeq: 1 })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})

requestRoutes.get('/requests', async (request: AuthenticatedRequest, response, next) => {
  try {
    const result = await pool.query(
      `SELECT mr.id, mr.chat_id, mr.from_user, mr.created_at,
              u.username, u.display_name, u.avatar_url,
              m.id AS message_id, m.server_seq, m.body_ciphertext, m.body_nonce,
              m.key_envelopes -> $1::text AS key_envelope, m.created_at AS message_created_at
       FROM message_requests mr
       JOIN users u ON u.id = mr.from_user
       JOIN LATERAL (
         SELECT * FROM messages WHERE chat_id = mr.chat_id ORDER BY server_seq LIMIT 1
       ) m ON true
       WHERE mr.to_user = $1::uuid AND mr.state = 'pending'
       ORDER BY mr.created_at DESC`,
      [request.auth!.userId],
    )
    response.json({ requests: result.rows })
  } catch (error) {
    next(error)
  }
})

requestRoutes.post('/requests/:id/accept', async (request: AuthenticatedRequest, response, next) => {
  const requestId = z.uuid().safeParse(request.params.id)
  if (!requestId.success) {
    response.status(404).json({ error: { code: 'not_found', message: 'Message request not found.' } })
    return
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query<{ from_user: string; to_user: string; chat_id: string }>(
      `UPDATE message_requests
       SET state = 'accepted', resolved_at = now()
       WHERE id = $1 AND to_user = $2 AND state = 'pending'
         AND NOT EXISTS (
           SELECT 1 FROM contacts blocked
           WHERE blocked.state = 'blocked'
             AND ((blocked.user_id = message_requests.from_user AND blocked.contact_id = message_requests.to_user)
               OR (blocked.user_id = message_requests.to_user AND blocked.contact_id = message_requests.from_user))
         )
       RETURNING from_user, to_user, chat_id`,
      [requestId.data, request.auth!.userId],
    )
    const item = result.rows[0]
    if (!item) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Message request not found.' } })
      return
    }
    await client.query(
      `INSERT INTO contacts (user_id, contact_id, state)
       VALUES ($1, $2, 'accepted'), ($2, $1, 'accepted')
       ON CONFLICT (user_id, contact_id) DO UPDATE SET state = 'accepted', created_at = now()`,
      [item.from_user, item.to_user],
    )
    await client.query('COMMIT')
    response.json({ chatId: item.chat_id })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})

requestRoutes.post('/requests/:id/ignore', async (request: AuthenticatedRequest, response, next) => {
  const requestId = z.uuid().safeParse(request.params.id)
  if (!requestId.success) {
    response.status(404).json({ error: { code: 'not_found', message: 'Message request not found.' } })
    return
  }
  try {
    const result = await pool.query(
      `UPDATE message_requests SET state = 'ignored', resolved_at = now()
       WHERE id = $1 AND to_user = $2 AND state = 'pending' RETURNING id`,
      [requestId.data, request.auth!.userId],
    )
    if (result.rowCount === 0) {
      response.status(404).json({ error: { code: 'not_found', message: 'Message request not found.' } })
      return
    }
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})
