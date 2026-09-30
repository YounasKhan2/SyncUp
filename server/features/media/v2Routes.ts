import express, { Router } from 'express'
import { ipKeyGenerator, rateLimit } from 'express-rate-limit'
import { v7 as uuidv7 } from 'uuid'
import { z } from 'zod'
import { pool } from '../../db.js'
import { createAppwriteStorage, uploadAppwriteRange } from '../../shared/appwrite.js'
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


const rangeLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (request) => (request as AuthenticatedRequest).auth?.userId ?? ipKeyGenerator(request.ip ?? ''),
  message: { error: { code: 'rate_limited', message: 'Too many media range requests. Try again shortly.' } },
})

function parseContentRange(value: string | undefined) {
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/u.exec(value ?? '')
  if (!match) return null
  const start = Number(match[1])
  const end = Number(match[2])
  const total = Number(match[3])
  if (![start, end, total].every(Number.isSafeInteger) || start < 0 || end < start || total <= end) return null
  return { start, end, total, length: end - start + 1 }
}

const intentSchema = z.object({
  attachmentId: z.uuid(),
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

    const attachmentId = input.data.attachmentId
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
        chunkCount: input.data.chunkCount,
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


mediaV2Router.put(
  '/uploads/v2/:attachmentId/range',
  rangeLimiter,
  express.raw({ type: 'application/octet-stream', limit: V2_CHUNK_SIZE }),
  async (request: AuthenticatedRequest, response, next) => {
    const attachmentId = z.uuid().safeParse(request.params.attachmentId)
    const range = parseContentRange(request.header('content-range'))
    if (!attachmentId.success || !range || !Buffer.isBuffer(request.body) || request.body.byteLength !== range.length) {
      response.status(400).json({ error: { code: 'validation', message: 'Invalid encrypted media range.' } })
      return
    }
    if (range.length > V2_CHUNK_SIZE) {
      response.status(413).json({ error: { code: 'payload_too_large', message: 'Media ranges are limited to 5 MiB.' } })
      return
    }

    try {
      const sessionResult = await pool.query<{
        session_id: string
        appwrite_file_id: string
        total_ciphertext_bytes: string
        acknowledged_bytes: string
        state: string
        expires_at: Date
        filename: string
      }>(
        `SELECT s.id AS session_id, s.appwrite_file_id, s.total_ciphertext_bytes, s.acknowledged_bytes,
                s.state, s.expires_at, a.filename
         FROM media_upload_sessions s
         JOIN attachments a ON a.id = s.attachment_id
         WHERE s.attachment_id = $1 AND s.uploaded_by = $2 AND a.transport_version = 2`,
        [attachmentId.data, request.auth!.userId],
      )
      const session = sessionResult.rows[0]
      if (!session || session.state !== 'active' || session.expires_at <= new Date()) {
        response.status(404).json({ error: { code: 'not_found', message: 'Active upload session not found.' } })
        return
      }

      let acknowledged = Number(session.acknowledged_bytes)
      const total = Number(session.total_ciphertext_bytes)

      // Repair the narrow crash window where Appwrite accepted a sequential range but
      // PostgreSQL did not persist its acknowledgement before the process stopped.
      if (acknowledged < total) {
        try {
          const appwrite = createAppwriteStorage()
          const remote = await appwrite.storage.getFile({ bucketId: appwrite.bucketId, fileId: session.appwrite_file_id })
          const remoteAcknowledged = Math.min(total, Number(remote.chunksUploaded) * V2_CHUNK_SIZE)
          if (Number.isSafeInteger(remoteAcknowledged) && remoteAcknowledged > acknowledged) {
            const repaired = await pool.query(
              `UPDATE media_upload_sessions
               SET acknowledged_bytes = $1, updated_at = now()
               WHERE id = $2 AND uploaded_by = $3 AND state = 'active' AND acknowledged_bytes = $4
               RETURNING acknowledged_bytes`,
              [remoteAcknowledged, session.session_id, request.auth!.userId, acknowledged],
            )
            if (repaired.rows[0]) acknowledged = remoteAcknowledged
          }
        } catch {
          // No remote file exists before the first accepted range; normal upload continues.
        }
      }

      if (range.total !== total || range.start !== acknowledged || range.end >= total) {
        response.status(409).json({
          error: { code: 'range_conflict', message: 'Upload range does not match the server acknowledgement.' },
          acknowledgedBytes: acknowledged,
        })
        return
      }

      const object = await uploadAppwriteRange({
        fileId: session.appwrite_file_id,
        filename: `${attachmentId.data}.bin`,
        bytes: request.body,
        start: range.start,
        end: range.end,
        total,
      })
      if (object.$id !== session.appwrite_file_id) throw new Error('Appwrite returned an unexpected file id.')

      const nextAcknowledged = range.end + 1
      const updated = await pool.query(
        `UPDATE media_upload_sessions
         SET acknowledged_bytes = $1, updated_at = now()
         WHERE id = $2 AND uploaded_by = $3 AND state = 'active' AND acknowledged_bytes = $4
         RETURNING acknowledged_bytes`,
        [nextAcknowledged, session.session_id, request.auth!.userId, acknowledged],
      )
      if (!updated.rows[0]) {
        response.status(409).json({
          error: { code: 'range_conflict', message: 'Upload acknowledgement changed. Reconcile before retrying.' },
          acknowledgedBytes: acknowledged,
        })
        return
      }
      response.json({ acknowledgedBytes: nextAcknowledged, complete: nextAcknowledged === total })
    } catch (error) {
      next(error)
    }
  },
)

mediaV2Router.post('/uploads/v2/:attachmentId/finalize', limiter, async (request: AuthenticatedRequest, response, next) => {
  const attachmentId = z.uuid().safeParse(request.params.attachmentId)
  if (!attachmentId.success) {
    response.status(400).json({ error: { code: 'validation', message: 'Invalid attachment id.' } })
    return
  }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await client.query<{
      session_id: string
      appwrite_file_id: string
      total_ciphertext_bytes: string
      acknowledged_bytes: string
      state: string
    }>(
      `SELECT s.id AS session_id, s.appwrite_file_id, s.total_ciphertext_bytes, s.acknowledged_bytes, s.state
       FROM media_upload_sessions s
       JOIN attachments a ON a.id = s.attachment_id
       WHERE s.attachment_id = $1 AND s.uploaded_by = $2 AND a.transport_version = 2
       FOR UPDATE`,
      [attachmentId.data, request.auth!.userId],
    )
    const session = result.rows[0]
    if (!session) {
      await client.query('ROLLBACK')
      response.status(404).json({ error: { code: 'not_found', message: 'Upload session not found.' } })
      return
    }
    if (session.state === 'completed') {
      await client.query('COMMIT')
      response.status(204).end()
      return
    }
    const total = Number(session.total_ciphertext_bytes)
    if (session.state !== 'active' || Number(session.acknowledged_bytes) !== total) {
      await client.query('ROLLBACK')
      response.status(409).json({ error: { code: 'incomplete_upload', message: 'Upload is not complete.' } })
      return
    }

    const appwrite = createAppwriteStorage()
    const object = await appwrite.storage.getFile({ bucketId: appwrite.bucketId, fileId: session.appwrite_file_id })
    if (object.sizeOriginal !== total) {
      await client.query('ROLLBACK')
      response.status(409).json({ error: { code: 'storage_mismatch', message: 'Stored ciphertext size does not match the upload manifest.' } })
      return
    }

    await client.query(
      `UPDATE media_upload_sessions
       SET state = 'completed', acknowledged_bytes = total_ciphertext_bytes, finalized_at = now(), updated_at = now()
       WHERE id = $1`,
      [session.session_id],
    )
    await client.query(
      `UPDATE attachments
       SET status = 'ready', finalized_at = now()
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
