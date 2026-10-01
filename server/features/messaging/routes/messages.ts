import { Router } from 'express'
import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'
import { pool } from '../../../db.js'
import type { AuthenticatedRequest } from '../../auth/types.js'
import { messageLimiter } from '../limits.js'
import { encryptedMessageSchema, matchingEnvelopes } from '../validation.js'
import type { MemberKey } from '../validation.js'
import { publishChatEvent } from '../../realtime/routes.js'

export const messageRoutes = Router()

messageRoutes.get('/chats/:id/messages', async (request: AuthenticatedRequest, response, next) => {
  const chatId = z.uuid().safeParse(request.params.id)
  const afterSeq = request.query.after_seq === undefined
    ? { success: true as const, data: undefined }
    : z.coerce.number().int().min(0).safeParse(request.query.after_seq)
  const beforeSeq = request.query.before_seq === undefined
    ? { success: true as const, data: undefined }
    : z.coerce.number().int().min(1).safeParse(request.query.before_seq)
  const limit = z.coerce.number().int().min(1).max(100).default(50).safeParse(request.query.limit)
  if (!chatId.success || !afterSeq.success || !beforeSeq.success || !limit.success
    || (afterSeq.data !== undefined && beforeSeq.data !== undefined)) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid chat history cursor.' } })
    return
  }
  try {
    const result = await pool.query(
      `SELECT m.id, m.chat_id, m.server_seq, m.sender_id, m.idempotency_key,
              m.body_ciphertext, m.body_nonce,
              m.key_envelopes -> $2::text AS key_envelope,
              m.reply_to_id, m.edited_at, m.deleted_at, m.deleted_for, m.created_at,
              (state.hidden_at IS NOT NULL) AS hidden_by_me,
              (state.pinned_at IS NOT NULL) AS pinned_by_me,
              CASE WHEN m.sender_id = $2::uuid THEN COALESCE((
                SELECT jsonb_agg(DISTINCT delivery_device.user_id)
                FROM message_device_deliveries delivery
                JOIN devices delivery_device ON delivery_device.id = delivery.device_id
                WHERE delivery.message_id = m.id
              ), '[]'::jsonb) ELSE '[]'::jsonb END AS delivery_receipts,
              CASE WHEN m.sender_id = $2::uuid THEN COALESCE((
                SELECT jsonb_agg(reader.user_id ORDER BY reader.user_id)
                FROM chat_members reader
                JOIN users reader_user ON reader_user.id = reader.user_id
                WHERE reader.chat_id = m.chat_id AND reader.left_at IS NULL
                  AND reader.user_id <> m.sender_id
                  AND reader.last_read_seq >= m.server_seq
                  AND reader_user.read_receipts_enabled
              ), '[]'::jsonb) ELSE '[]'::jsonb END AS read_by,
              COALESCE(
                jsonb_agg(DISTINCT jsonb_build_object('user_id', r.user_id, 'emoji', r.emoji))
                  FILTER (WHERE r.message_id IS NOT NULL),
                '[]'::jsonb
              ) AS reactions,
              COALESCE(
                jsonb_agg(DISTINCT jsonb_build_object(
                  'id', a.id,
                  'filename', a.filename,
                  'content_type', a.content_type,
                  'size_bytes', a.size_bytes,
                  'nonce', a.nonce,
                  'key_envelope', a.key_envelopes -> $2::text,
                  'transport_version', a.transport_version,
                  'duration_ms', a.duration_ms,
                  'waveform', a.waveform,
                  'width', a.width,
                  'height', a.height,
                  'poster_attachment_id', a.poster_attachment_id,
                  'is_preview', EXISTS (
                    SELECT 1 FROM attachments parent
                    WHERE parent.poster_attachment_id = a.id
                  ),
                  'preview', CASE
                    WHEN p.id IS NOT NULL AND EXISTS (
                      SELECT 1 FROM message_attachments pma
                      WHERE pma.message_id = m.id AND pma.attachment_id = p.id
                    ) THEN jsonb_build_object(
                      'id', p.id,
                      'filename', p.filename,
                      'content_type', p.content_type,
                      'size_bytes', p.size_bytes,
                      'nonce', p.nonce,
                      'key_envelope', p.key_envelopes -> $2::text,
                      'transport_version', p.transport_version
                    )
                    ELSE NULL
                  END
                )) FILTER (WHERE a.id IS NOT NULL),
                '[]'::jsonb
              ) AS attachments
       FROM messages m
       LEFT JOIN message_user_states state ON state.message_id = m.id AND state.user_id = $2
       LEFT JOIN message_reactions r ON r.message_id = m.id
       LEFT JOIN message_attachments ma ON ma.message_id = m.id
       LEFT JOIN attachments a ON a.id = ma.attachment_id AND a.status = 'ready'
       LEFT JOIN attachments p ON p.id = a.poster_attachment_id AND p.status = 'ready'
       WHERE m.chat_id = $1
         AND ($3::bigint IS NULL OR m.server_seq > $3)
         AND ($5::bigint IS NULL OR m.server_seq < $5)
         AND EXISTS (
           SELECT 1 FROM chat_members cm WHERE cm.chat_id = m.chat_id
             AND cm.user_id = $2::uuid AND cm.left_at IS NULL
         )
         AND NOT EXISTS (
           SELECT 1 FROM message_requests mr WHERE mr.chat_id = m.chat_id
             AND mr.to_user = $2::uuid AND mr.state IN ('pending', 'ignored')
         )
         AND state.hidden_at IS NULL
       GROUP BY m.id, state.hidden_at, state.pinned_at
       ORDER BY CASE WHEN $3::bigint IS NOT NULL THEN m.server_seq END ASC,
                CASE WHEN $3::bigint IS NULL THEN m.server_seq END DESC
       LIMIT $4 + 1`,
      [chatId.data, request.auth!.userId, afterSeq.data ?? null, limit.data, beforeSeq.data ?? null],
    )
    const hasMore = result.rows.length > limit.data
    const page = result.rows.slice(0, limit.data)
    const receivedMessageIds = page
      .filter((message) => message.sender_id !== request.auth!.userId && !message.deleted_at)
      .map((message) => message.id)
    if (receivedMessageIds.length > 0 && request.auth!.deviceId) {
      const delivered = await pool.query<{ message_id: string }>(
        `INSERT INTO message_device_deliveries (message_id, device_id)
         SELECT m.id, $2
         FROM messages m
         WHERE m.id = ANY($1::uuid[]) AND m.chat_id = $3
           AND m.sender_id <> $4 AND m.deleted_at IS NULL
         ON CONFLICT (message_id, device_id) DO NOTHING
         RETURNING message_id`,
        [receivedMessageIds, request.auth!.deviceId, chatId.data, request.auth!.userId],
      )
      if (delivered.rows.length > 0) {
        await publishChatEvent(chatId.data, {
          type: 'message.delivered',
          data: {
            userId: request.auth!.userId,
            messageIds: delivered.rows.map((receipt) => receipt.message_id),
          },
        }, request.auth!.userId)
      }
    }
    response.json({
      messages: afterSeq.data !== undefined ? page : page.reverse(),
      hasMore,
    })
  } catch (error) {
    next(error)
  }
})

messageRoutes.post('/chats/:id/messages', messageLimiter, async (request: AuthenticatedRequest, response, next) => {
  const chatId = z.uuid().safeParse(request.params.id)
  const input = encryptedMessageSchema.safeParse(request.body)
  if (!chatId.success || !input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid encrypted message.' } })
    return
  }
  const client = await pool.connect()
  try {
    const existing = await client.query(
      `SELECT id, chat_id, server_seq FROM messages WHERE sender_id = $1 AND idempotency_key = $2`,
      [request.auth!.userId, input.data.idempotencyKey],
    )
    if (existing.rows[0]) {
      if (existing.rows[0].chat_id !== chatId.data) {
        response.status(409).json({ error: { code: 'conflict', message: 'Idempotency key was already used for another chat.' } })
        return
      }
      response.status(200).json({ messageId: existing.rows[0].id, serverSeq: existing.rows[0].server_seq, duplicate: true })
      return
    }

    await client.query('BEGIN')
    const membership = await client.query<{ kind: string }>(
      `SELECT c.kind FROM chats c JOIN chat_members cm ON cm.chat_id = c.id
       WHERE c.id = $1 AND cm.user_id = $2 AND cm.left_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM message_requests mr WHERE mr.chat_id = c.id AND mr.to_user = $2
             AND mr.state IN ('pending', 'ignored')
         )
       FOR UPDATE OF c`,
      [chatId.data, request.auth!.userId],
    )
    if (!membership.rows[0]) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Chat not found.' } })
      return
    }
    const members = await client.query<MemberKey>(
      `SELECT cm.user_id, u.encryption_public_key
       FROM chat_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.chat_id = $1 AND cm.left_at IS NULL`,
      [chatId.data],
    )
    if (!matchingEnvelopes(input.data.keyEnvelopes, members.rows)) {
      await client.query('ROLLBACK')
      response.status(400).json({ error: { code: 'validation', message: 'Encrypt the message for every active chat member.' } })
      return
    }
    if (input.data.attachmentIds.length) {
      const attachments = await client.query<{
        id: string
        key_envelopes: Record<string, string>
        poster_attachment_id: string | null
        is_preview: boolean
      }>(
        `SELECT a.id, a.key_envelopes, a.poster_attachment_id,
                EXISTS (
                  SELECT 1 FROM attachments parent
                  WHERE parent.poster_attachment_id = a.id
                ) AS is_preview
         FROM attachments a
         WHERE a.id = ANY($1::uuid[]) AND a.chat_id = $2 AND a.uploaded_by = $3
           AND a.status = 'ready' AND a.expires_at > now()
         FOR UPDATE OF a`,
        [input.data.attachmentIds, chatId.data, request.auth!.userId],
      )
      const expectedMembers = members.rows.map((member) => member.user_id).sort()
      const submittedAttachmentIds = new Set(input.data.attachmentIds)
      if (attachments.rowCount !== input.data.attachmentIds.length
        || attachments.rows.some((attachment) => {
          const recipients = Object.keys(attachment.key_envelopes).sort()
          return recipients.length !== expectedMembers.length
            || recipients.some((recipient, index) => recipient !== expectedMembers[index])
            || (attachment.poster_attachment_id !== null
              && !submittedAttachmentIds.has(attachment.poster_attachment_id))
            || attachment.is_preview
              && !attachments.rows.some((parent) => parent.poster_attachment_id === attachment.id)
        })) {
        await client.query('ROLLBACK')
        response.status(400).json({ error: { code: 'validation', message: 'One or more encrypted attachments are unavailable.' } })
        return
      }
    }
    if (input.data.replyToId) {
      const parent = await client.query(
        `SELECT 1 FROM messages WHERE id = $1 AND chat_id = $2`,
        [input.data.replyToId, chatId.data],
      )
      if (parent.rowCount === 0) {
        await client.query('ROLLBACK')
        response.status(400).json({ error: { code: 'validation', message: 'Reply target is not in this chat.' } })
        return
      }
    }
    const messageId = uuidv7()
    const inserted = await client.query<{ server_seq: string }>(
      `WITH next_seq AS (
         UPDATE chats SET last_seq = last_seq + 1, last_message_at = now()
         WHERE id = $1 RETURNING last_seq
       )
       INSERT INTO messages (id, chat_id, server_seq, sender_id, idempotency_key,
                             body_ciphertext, body_nonce, key_envelopes, reply_to_id)
       SELECT $2, $1, next_seq.last_seq, $3, $4, $5, $6, $7::jsonb, $8
       FROM next_seq
       RETURNING server_seq`,
      [
        chatId.data, messageId, request.auth!.userId, input.data.idempotencyKey,
        input.data.bodyCiphertext, input.data.bodyNonce,
        JSON.stringify(input.data.keyEnvelopes), input.data.replyToId ?? null,
      ],
    )
    if (input.data.attachmentIds.length) {
      await client.query(
        `INSERT INTO message_attachments (message_id, attachment_id)
         SELECT $1, attachment_id FROM unnest($2::uuid[]) AS attachment_id`,
        [messageId, input.data.attachmentIds],
      )
    }
    await client.query('COMMIT')
    response.status(201).json({ messageId, serverSeq: Number(inserted.rows[0].server_seq), duplicate: false })
  } catch (error) {
    await client.query('ROLLBACK')
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
      const existing = await pool.query(
        `SELECT id, chat_id, server_seq FROM messages WHERE sender_id = $1 AND idempotency_key = $2`,
        [request.auth!.userId, input.data.idempotencyKey],
      )
      if (existing.rows[0]?.chat_id === chatId.data) {
        response.status(200).json({ messageId: existing.rows[0].id, serverSeq: existing.rows[0].server_seq, duplicate: true })
        return
      }
    }
    next(error)
  } finally {
    client.release()
  }
})

messageRoutes.patch('/messages/:id', messageLimiter, async (request: AuthenticatedRequest, response, next) => {
  const messageId = z.uuid().safeParse(request.params.id)
  const input = z.object({
    bodyCiphertext: z.string().regex(/^[A-Za-z0-9_-]+$/).min(16).max(20_000),
    bodyNonce: z.string().regex(/^[A-Za-z0-9_-]{16}$/),
    keyEnvelopes: z.record(z.uuid(), z.string().regex(/^[A-Za-z0-9_-]+$/).min(16).max(16_384)),
  }).safeParse(request.body)
  if (!messageId.success || !input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid encrypted message edit.' } })
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const message = await client.query<{ chat_id: string; created_at: Date; deleted_at: Date | null }>(
      `SELECT m.chat_id, m.created_at, m.deleted_at FROM messages m
       JOIN chat_members cm ON cm.chat_id = m.chat_id AND cm.user_id = $2 AND cm.left_at IS NULL
       WHERE m.id = $1 AND m.sender_id = $2 FOR UPDATE OF m`,
      [messageId.data, request.auth!.userId],
    )
    const target = message.rows[0]
    if (!target) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Message not found.' } })
      return
    }
    if (target.deleted_at || Date.now() - target.created_at.getTime() > 15 * 60_000) {
      await client.query('ROLLBACK')
      response.status(409).json({ error: { code: 'conflict', message: 'This message can no longer be edited.' } })
      return
    }
    const attachment = await client.query(
      'SELECT 1 FROM message_attachments WHERE message_id = $1 LIMIT 1',
      [messageId.data],
    )
    if (attachment.rowCount) {
      await client.query('ROLLBACK')
      response.status(409).json({ error: { code: 'conflict', message: 'Messages with attachments cannot be edited.' } })
      return
    }
    const members = await client.query<MemberKey>(
      `SELECT cm.user_id, u.encryption_public_key
       FROM chat_members cm JOIN users u ON u.id = cm.user_id
       WHERE cm.chat_id = $1 AND cm.left_at IS NULL`,
      [target.chat_id],
    )
    if (!matchingEnvelopes(input.data.keyEnvelopes, members.rows)) {
      await client.query('ROLLBACK')
      response.status(400).json({ error: { code: 'validation', message: 'Encrypt the edit for every active chat member.' } })
      return
    }
    await client.query(
      `UPDATE messages
       SET body_ciphertext = $1, body_nonce = $2, key_envelopes = $3::jsonb, edited_at = now()
       WHERE id = $4`,
      [input.data.bodyCiphertext, input.data.bodyNonce, JSON.stringify(input.data.keyEnvelopes), messageId.data],
    )
    await client.query(
      `SELECT pg_notify('syncup_chat_messages', json_build_object('chatId', $1::uuid, 'messageId', $2::uuid)::text)`,
      [target.chat_id, messageId.data],
    )
    await client.query('COMMIT')
    response.json({ updated: true })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})

messageRoutes.post('/messages/:id/delete', async (request: AuthenticatedRequest, response, next) => {
  const messageId = z.uuid().safeParse(request.params.id)
  const input = z.object({ scope: z.enum(['me', 'everyone']) }).safeParse(request.body)
  if (!messageId.success || !input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Choose a valid delete option.' } })
    return
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const message = await client.query<{
      chat_id: string
      sender_id: string
      created_at: Date
      deleted_at: Date | null
      role: string
    }>(
      `SELECT m.chat_id, m.sender_id, m.created_at, m.deleted_at, cm.role
       FROM messages m JOIN chat_members cm ON cm.chat_id = m.chat_id
       WHERE m.id = $1 AND cm.user_id = $2 AND cm.left_at IS NULL
       FOR UPDATE OF m`,
      [messageId.data, request.auth!.userId],
    )
    const target = message.rows[0]
    if (!target) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Message not found.' } })
      return
    }
    if (input.data.scope === 'me') {
      await client.query(
        `INSERT INTO message_user_states (message_id, user_id, hidden_at)
         VALUES ($1, $2, now())
         ON CONFLICT (message_id, user_id)
         DO UPDATE SET hidden_at = now()`,
        [messageId.data, request.auth!.userId],
      )
      await client.query('COMMIT')
      response.json({ deleted: true, scope: 'me' })
      return
    }
    if (target.deleted_at) {
      await client.query('COMMIT')
      response.json({ deleted: true, scope: 'everyone' })
      return
    }
    if (Date.now() - target.created_at.getTime() > 15 * 60_000
      || (target.sender_id !== request.auth!.userId && !['owner', 'admin'].includes(target.role))) {
      await client.query('ROLLBACK')
      response.status(403).json({ error: { code: 'forbidden', message: 'You cannot delete this message for everyone.' } })
      return
    }
    await client.query(
      `UPDATE messages
       SET body_ciphertext = '', body_nonce = '', key_envelopes = '{}'::jsonb,
           deleted_at = now(), deleted_for = 'all'
       WHERE id = $1`,
      [messageId.data],
    )
    await client.query(
      `SELECT pg_notify('syncup_chat_messages', json_build_object('chatId', $1::uuid, 'messageId', $2::uuid)::text)`,
      [target.chat_id, messageId.data],
    )
    await client.query('COMMIT')
    response.json({ deleted: true, scope: 'everyone' })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})

messageRoutes.post('/messages/:id/pin', async (request: AuthenticatedRequest, response, next) => {
  const messageId = z.uuid().safeParse(request.params.id)
  if (!messageId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid message.' } })
    return
  }
  try {
    const access = await pool.query<{ chat_id: string }>(
      `SELECT m.chat_id FROM messages m JOIN chat_members cm ON cm.chat_id = m.chat_id
       WHERE m.id = $1 AND cm.user_id = $2 AND cm.left_at IS NULL AND m.deleted_at IS NULL`,
      [messageId.data, request.auth!.userId],
    )
    if (!access.rows[0]) {
      response.status(404).json({ error: { code: 'not_found', message: 'Message not found.' } })
      return
    }
    const removed = await pool.query(
      `UPDATE message_user_states SET pinned_at = NULL
       WHERE message_id = $1 AND user_id = $2 AND pinned_at IS NOT NULL
       RETURNING message_id`,
      [messageId.data, request.auth!.userId],
    )
    const pinned = removed.rowCount === 0
    if (pinned) {
      await pool.query(
        `INSERT INTO message_user_states (message_id, user_id, pinned_at)
         VALUES ($1, $2, now())
         ON CONFLICT (message_id, user_id)
         DO UPDATE SET pinned_at = now()`,
        [messageId.data, request.auth!.userId],
      )
    }
    response.json({ pinned })
  } catch (error) {
    next(error)
  }
})

messageRoutes.post('/chats/:id/read', async (request: AuthenticatedRequest, response, next) => {
  const chatId = z.uuid().safeParse(request.params.id)
  const lastSeq = z.coerce.number().int().min(0).safeParse(request.body?.lastSeq)
  if (!chatId.success || !lastSeq.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid read cursor.' } })
    return
  }
  try {
    const result = await pool.query<{
      last_read_seq: string
      advanced: boolean
      read_receipts_enabled: boolean
    }>(
      `WITH target AS (
         SELECT cm.chat_id, cm.user_id, cm.last_read_seq AS previous_seq,
                LEAST($3::bigint, c.last_seq) AS next_seq, u.read_receipts_enabled
         FROM chat_members cm
         JOIN chats c ON c.id = cm.chat_id
         JOIN users u ON u.id = cm.user_id
         WHERE cm.chat_id = $1 AND cm.user_id = $2 AND cm.left_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM message_requests mr
             WHERE mr.chat_id = cm.chat_id AND mr.to_user = cm.user_id
               AND mr.state IN ('pending', 'ignored')
           )
       ), updated AS (
         UPDATE chat_members cm
         SET last_read_seq = target.next_seq
         FROM target
         WHERE cm.chat_id = target.chat_id AND cm.user_id = target.user_id
           AND cm.left_at IS NULL AND target.next_seq > cm.last_read_seq
         RETURNING cm.last_read_seq
       )
       SELECT COALESCE(updated.last_read_seq, target.previous_seq) AS last_read_seq,
              target.next_seq > target.previous_seq AS advanced,
              target.read_receipts_enabled
       FROM target LEFT JOIN updated ON true`,
      [chatId.data, request.auth!.userId, lastSeq.data],
    )
    if (result.rowCount === 0) {
      response.status(404).json({ error: { code: 'not_found', message: 'Chat not found.' } })
      return
    }
    if (result.rows[0].advanced && result.rows[0].read_receipts_enabled) {
      await publishChatEvent(chatId.data, {
        type: 'chat.read',
        data: { userId: request.auth!.userId, lastReadSeq: result.rows[0].last_read_seq },
      }, request.auth!.userId)
    }
    response.json({ lastReadSeq: result.rows[0].last_read_seq })
  } catch (error) {
    next(error)
  }
})

messageRoutes.post('/messages/:id/reactions', async (request: AuthenticatedRequest, response, next) => {
  const messageId = z.uuid().safeParse(request.params.id)
  const input = z.object({ emoji: z.string().min(1).max(16) }).safeParse(request.body)
  if (!messageId.success || !input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Choose a valid reaction.' } })
    return
  }
  try {
    const access = await pool.query<{ chat_id: string }>(
      `SELECT m.chat_id FROM messages m JOIN chat_members cm ON cm.chat_id = m.chat_id
       WHERE m.id = $1 AND cm.user_id = $2 AND cm.left_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM message_requests mr WHERE mr.chat_id = m.chat_id
           AND mr.to_user = $2 AND mr.state IN ('pending', 'ignored'))`,
      [messageId.data, request.auth!.userId],
    )
    if (!access.rows[0]) {
      response.status(404).json({ error: { code: 'not_found', message: 'Message not found.' } })
      return
    }
    const existing = await pool.query(
      `DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3
       RETURNING message_id`,
      [messageId.data, request.auth!.userId, input.data.emoji],
    )
    const active = existing.rowCount === 0
    if (active) {
      await pool.query(
        `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)`,
        [messageId.data, request.auth!.userId, input.data.emoji],
      )
    }
    response.json({ active })
  } catch (error) {
    next(error)
  }
})
