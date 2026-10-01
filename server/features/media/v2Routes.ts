import { Router } from 'express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'
import { pool } from '../../db.js'
import { requireAuth, type AuthenticatedRequest } from '../auth/middleware.js'

const MIB = 1024 * 1024
const GIB = 1024 * MIB
const V2_CHUNK_SIZE = 5 * MIB
const maxVideoSourceBytes = 2 * GIB
const maxVoiceSourceBytes = 256 * MIB
const maxCiphertextBytes = 2 * GIB + 64 * MIB
const videoTypes = new Set(['video/mp4', 'video/webm'])
const voiceTypes = new Set(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'])
const envelopesSchema = z.record(z.uuid(), z.string().regex(/^[A-Za-z0-9_-]+$/).min(16).max(16_384))

const limiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => (request as AuthenticatedRequest).auth?.userId ?? ipKeyGenerator(request.ip ?? ''),
  message: { error: { code: 'rate_limited', message: 'Too many media session requests. Try again shortly.' } },
})

const intentSchema = z.object({
  chatId: z.uuid(),
  filename: z.string().trim().min(1).max(200).refine((value) => !/[\\/\u0000-\u001f]/u.test(value)),
  contentType: z.string().min(1).max(120),
  mediaKind: z.enum(['video', 'voice']),
  mediaMode: z.enum(['standard', 'hd', 'original']).nullable().optional(),
  plaintextSize: z.number().int().positive(),
  ciphertextSize: z.number().int().positive().max(maxCiphertextBytes),
  chunkSize: z.literal(V2_CHUNK_SIZE),
  chunkCount: z.number().int().positive().max(512),
  encryptionVersion: z.literal(2),
  keyEnvelopes: envelopesSchema.refine((value) => Object.keys(value).length >= 2 && Object.keys(value).length <= 32),
  durationMs: z.number().int().nonnegative().max(24 * 60 * 60 * 1000).nullable().optional(),
  width: z.number().int().positive().max(16_384).nullable().optional(),
  height: z.number().int().positive().max(16_384).nullable().optional(),
}).superRefine((value, context) => {
  const supported = value.mediaKind === 'video' ? videoTypes.has(value.contentType) : voiceTypes.has(value.contentType)
  if (!supported) context.addIssue({ code: 'custom', message: 'Unsupported media content type.', path: ['contentType'] })
  const sourceLimit = value.mediaKind === 'video' ? maxVideoSourceBytes : maxVoiceSourceBytes
  if (value.plaintextSize > sourceLimit) context.addIssue({ code: 'custom', message: 'Media exceeds the v2 source limit.', path: ['plaintextSize'] })
  if (value.mediaKind === 'voice' && value.mediaMode) context.addIssue({ code: 'custom', message: 'Voice notes do not use a media mode.', path: ['mediaMode'] })
  if (value.mediaKind === 'video' && !value.mediaMode) context.addIssue({ code: 'custom', message: 'Video media mode is required.', path: ['mediaMode'] })
  if (Math.ceil(value.ciphertextSize / value.chunkSize) !== value.chunkCount) {
    context.addIssue({ code: 'custom', message: 'Chunk count does not match ciphertext size.', path: ['chunkCount'] })
  }
})

export const mediaV2Router = Router()
mediaV2Router.use(requireAuth)

mediaV2Router.post('/uploads/v2/intent', limiter, async (request: AuthenticatedRequest, response, next) => {
  const input = intentSchema.safeParse(request.body)
  if (!input.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid encrypted media-v2 upload intent.' } })
    return
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const members = await client.query<{ user_id: string }>(
      `SELECT cm.user_id FROM chat_members cm
       JOIN chats c ON c.id = cm.chat_id
       WHERE cm.chat_id = $1 AND cm.left_at IS NULL
         AND c.kind IN ('direct', 'group')
         AND NOT EXISTS (
           SELECT 1 FROM message_requests mr WHERE mr.chat_id = c.id
             AND mr.to_user = $2 AND mr.state IN ('pending', 'ignored')
         )`,
      [input.data.chatId, request.auth!.userId],
    )
    const allowedMemberIds = members.rows.map((member) => member.user_id).sort()
    const envelopeMemberIds = Object.keys(input.data.keyEnvelopes).sort()
    if (!allowedMemberIds.includes(request.auth!.userId)
      || allowedMemberIds.length < 2
      || allowedMemberIds.length > 32
      || allowedMemberIds.length !== envelopeMemberIds.length
      || allowedMemberIds.some((id, index) => id !== envelopeMemberIds[index])) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Chat not found.' } })
      return
    }

    const attachmentId = uuidv7()
    const sessionId = uuidv7()
    const appwriteFileId = attachmentId
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await client.query(
      `INSERT INTO attachments
        (id, chat_id, uploaded_by, object_key, filename, content_type, size_bytes, nonce, key_envelopes,
         status, expires_at, transport_version, media_kind, encryption_version, plaintext_size,
         ciphertext_size, chunk_size, chunk_count, media_mode, duration_ms, width, height)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, NULL, $8::jsonb, 'pending', $9, 2, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        attachmentId, input.data.chatId, request.auth!.userId, `appwrite:${attachmentId}`,
        input.data.filename, input.data.contentType, input.data.plaintextSize,
        JSON.stringify(input.data.keyEnvelopes), expiresAt, input.data.mediaKind,
        input.data.encryptionVersion, input.data.plaintextSize, input.data.ciphertextSize,
        input.data.chunkSize, input.data.chunkCount, input.data.mediaMode ?? null,
        input.data.durationMs ?? null, input.data.width ?? null, input.data.height ?? null,
      ],
    )
    await client.query(
      `INSERT INTO media_upload_sessions
        (id, attachment_id, uploaded_by, appwrite_file_id, total_ciphertext_bytes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [sessionId, attachmentId, request.auth!.userId, appwriteFileId, input.data.ciphertextSize, expiresAt],
    )
    await client.query('COMMIT')
    response.status(201).json({
      attachmentId,
      uploadSession: {
        id: sessionId,
        transportVersion: 2,
        chunkSize: V2_CHUNK_SIZE,
        totalCiphertextBytes: input.data.ciphertextSize,
        acknowledgedBytes: 0,
        state: 'active',
        expiresAt: expiresAt.toISOString(),
      },
    })
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    next(error)
  } finally {
    client.release()
  }
})

mediaV2Router.get('/uploads/v2/:attachmentId/session', limiter, async (request: AuthenticatedRequest, response, next) => {
  const attachmentId = z.uuid().safeParse(request.params.attachmentId)
  if (!attachmentId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid attachment id.' } })
    return
  }
  try {
    const result = await pool.query(
      `SELECT s.id, s.total_ciphertext_bytes, s.acknowledged_bytes, s.state, s.expires_at,
              a.chunk_size, a.chunk_count, a.transport_version
       FROM media_upload_sessions s
       JOIN attachments a ON a.id = s.attachment_id
       WHERE s.attachment_id = $1 AND s.uploaded_by = $2`,
      [attachmentId.data, request.auth!.userId],
    )
    const session = result.rows[0]
    if (!session) {
      response.status(404).json({ error: { code: 'not_found', message: 'Upload session not found.' } })
      return
    }
    response.json({
      uploadSession: {
        id: session.id,
        transportVersion: Number(session.transport_version),
        chunkSize: Number(session.chunk_size),
        chunkCount: Number(session.chunk_count),
        totalCiphertextBytes: Number(session.total_ciphertext_bytes),
        acknowledgedBytes: Number(session.acknowledged_bytes),
        state: session.state,
        expiresAt: session.expires_at,
      },
    })
  } catch (error) {
    next(error)
  }
})

mediaV2Router.delete('/uploads/v2/:attachmentId/session', limiter, async (request: AuthenticatedRequest, response, next) => {
  const attachmentId = z.uuid().safeParse(request.params.attachmentId)
  if (!attachmentId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid attachment id.' } })
    return
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const cancelled = await client.query(
      `UPDATE media_upload_sessions
       SET state = 'cancelled', updated_at = now()
       WHERE attachment_id = $1 AND uploaded_by = $2 AND state IN ('active', 'finalizing')
       RETURNING id`,
      [attachmentId.data, request.auth!.userId],
    )
    if (!cancelled.rows[0]) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Active upload session not found.' } })
      return
    }
    await client.query(
      `DELETE FROM attachments
       WHERE id = $1 AND uploaded_by = $2 AND transport_version = 2 AND status = 'pending'`,
      [attachmentId.data, request.auth!.userId],
    )
    await client.query('COMMIT')
    response.status(204).end()
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    next(error)
  } finally {
    client.release()
  }
})
