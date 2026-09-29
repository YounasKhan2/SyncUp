import { Router } from 'express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'
import { pool } from '../../../db.js'
import type { AuthenticatedRequest } from '../../auth/types.js'

const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => (request as AuthenticatedRequest).auth?.userId ?? ipKeyGenerator(request.ip ?? ''),
  message: { error: { code: 'rate_limited', message: 'Too many reports. Try again later.' } },
})

const usernameSchema = z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/)
const reportSchema = z.object({
  username: usernameSchema.optional(),
  messageId: z.uuid().optional(),
  reason: z.enum(['spam', 'harassment', 'threats', 'inappropriate_content', 'impersonation', 'other']),
  details: z.string().trim().max(1000).default(''),
}).refine((value) => value.username !== undefined || value.messageId !== undefined)

export const safetyRoutes = Router()

safetyRoutes.get('/blocks', async (request: AuthenticatedRequest, response, next) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.username, u.display_name, c.created_at AS blocked_at
       FROM contacts c JOIN users u ON u.id = c.contact_id
       WHERE c.user_id = $1 AND c.state = 'blocked' AND u.deleted_at IS NULL
       ORDER BY c.created_at DESC`,
      [request.auth!.userId],
    )
    response.json({ blockedUsers: result.rows })
  } catch (error) {
    next(error)
  }
})

safetyRoutes.post('/blocks', async (request: AuthenticatedRequest, response, next) => {
  const input = z.object({ username: usernameSchema }).safeParse(request.body)
  if (!input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Enter a valid username to block.' } })
    return
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const targetResult = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE username = lower($1) AND deleted_at IS NULL
       AND id <> $2 FOR UPDATE`,
      [input.data.username, request.auth!.userId],
    )
    const targetId = targetResult.rows[0]?.id
    if (!targetId) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'User not found.' } })
      return
    }
    await client.query(
      `INSERT INTO contacts (user_id, contact_id, state)
       VALUES ($1, $2, 'blocked')
       ON CONFLICT (user_id, contact_id) DO UPDATE SET state = 'blocked'`,
      [request.auth!.userId, targetId],
    )
    await client.query(
      `UPDATE message_requests SET state = 'ignored', resolved_at = now()
       WHERE state = 'pending' AND (
         (from_user = $1 AND to_user = $2) OR (from_user = $2 AND to_user = $1)
       )`,
      [request.auth!.userId, targetId],
    )
    await client.query(
      `UPDATE chat_members cm SET left_at = now()
       FROM chats c
       WHERE cm.chat_id = c.id AND c.kind = 'direct'
         AND (c.direct_user_low = $1 AND c.direct_user_high = $2
           OR c.direct_user_low = $2 AND c.direct_user_high = $1)
         AND cm.left_at IS NULL`,
      [request.auth!.userId, targetId],
    )
    await client.query(
      `UPDATE calls SET status = 'ended', end_reason = 'cancelled', ended_at = now()
       WHERE status IN ('ringing', 'active')
         AND ((caller_id = $1 AND callee_id = $2) OR (caller_id = $2 AND callee_id = $1))`,
      [request.auth!.userId, targetId],
    )
    await client.query(
      `INSERT INTO security_events (id, user_id, type, meta)
       VALUES ($1, $2, 'user_blocked', jsonb_build_object('target_user_id', $3::uuid))`,
      [uuidv7(), request.auth!.userId, targetId],
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

safetyRoutes.delete('/blocks/:id', async (request: AuthenticatedRequest, response, next) => {
  const targetId = z.uuid().safeParse(request.params.id)
  if (!targetId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid blocked user.' } })
    return
  }
  try {
    const result = await pool.query(
      `DELETE FROM contacts WHERE user_id = $1 AND contact_id = $2 AND state = 'blocked'
       RETURNING contact_id`,
      [request.auth!.userId, targetId.data],
    )
    if (!result.rowCount) {
      response.status(404).json({ error: { code: 'not_found', message: 'Blocked user not found.' } })
      return
    }
    response.status(204).end()
  } catch (error) {
    next(error)
  }
})

safetyRoutes.post('/reports', reportLimiter, async (request: AuthenticatedRequest, response, next) => {
  const input = reportSchema.safeParse(request.body)
  if (!input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Choose a report reason and a user or message.' } })
    return
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    let reportedUserId: string | null = null
    let messageId: string | null = null
    if (input.data.username) {
      const target = await client.query<{ id: string }>(
        `SELECT id FROM users WHERE username = lower($1) AND deleted_at IS NULL
         AND id <> $2`,
        [input.data.username, request.auth!.userId],
      )
      reportedUserId = target.rows[0]?.id ?? null
      if (!reportedUserId) {
        await client.query('ROLLBACK')
        response.status(404).json({ error: { code: 'not_found', message: 'User not found.' } })
        return
      }
    }
    if (input.data.messageId) {
      const target = await client.query<{ sender_id: string }>(
        `SELECT m.sender_id FROM messages m JOIN chat_members cm
         ON cm.chat_id = m.chat_id AND cm.user_id = $2 AND cm.left_at IS NULL
         WHERE m.id = $1 AND m.deleted_at IS NULL`,
        [input.data.messageId, request.auth!.userId],
      )
      if (!target.rows[0] || target.rows[0].sender_id === request.auth!.userId) {
        await client.query('ROLLBACK')
        response.status(404).json({ error: { code: 'not_found', message: 'Message not found.' } })
        return
      }
      messageId = input.data.messageId
      if (reportedUserId && reportedUserId !== target.rows[0].sender_id) {
        await client.query('ROLLBACK')
        response.status(400).json({ error: { code: 'validation', message: 'The reported user must have sent this message.' } })
        return
      }
      reportedUserId ??= target.rows[0].sender_id
    }
    const reportId = uuidv7()
    await client.query(
      `INSERT INTO safety_reports (id, reporter_id, reported_user_id, message_id, reason, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [reportId, request.auth!.userId, reportedUserId, messageId, input.data.reason, input.data.details],
    )
    await client.query(
      `INSERT INTO security_events (id, user_id, type, meta)
       VALUES ($1, $2, 'safety_report_submitted', jsonb_build_object('report_id', $3::uuid))`,
      [uuidv7(), request.auth!.userId, reportId],
    )
    await client.query('COMMIT')
    response.status(201).json({ reportId })
  } catch (error) {
    await client.query('ROLLBACK')
    next(error)
  } finally {
    client.release()
  }
})
